let currentThreadId = null;

async function loadThreads() {
    try {
        const threads = await apiRequest("/threads");
        const openThreadsContainer = document.getElementById("open-threads-content");
        const closedThreadsContainer = document.getElementById("closed-threads-content");
        openThreadsContainer.innerHTML = "";
        closedThreadsContainer.innerHTML = "";

        const openThreads = threads.filter(t => !t.is_closed);
        const closedThreads = threads.filter(t => t.is_closed);

        openThreads.forEach(t => openThreadsContainer.appendChild(createThreadElement(t)));
        closedThreads.forEach(t => closedThreadsContainer.appendChild(createThreadElement(t)));

    } catch (err) {
        console.error("Chyba při načítání vláken:", err);
        alert("Chyba při načítání vláken.");
    }
}

function createThreadElement(thread) {
    const div = document.createElement("div");
    div.className = "thread";
    div.setAttribute("data-thread-id", thread.id);
    div.innerHTML = `
        <div class="thread-summary">
            <span class="collapser-icon"></span>
            <h3 class="thread-title">${thread.title}</h3>
        </div>
        <div class="thread-details">
            <p><strong>Autor:</strong> ${thread.author_full_name || 'Neznámý'}</p>
            <p><strong>Uživ. jméno:</strong> @${thread.author_username}</p>
            <p><strong>Vytvořeno:</strong> ${new Date(thread.created_at).toLocaleString()}</p>
        </div>
    `;
    
    const summary = div.querySelector('.thread-summary');
    summary.addEventListener('click', (e) => {
        // Kliknutí na ikonu rozbalí detaily, kliknutí kamkoliv jinam načte vlákno
        if (e.target.classList.contains('collapser-icon')) {
            div.classList.toggle('expanded');
        } else {
            loadThreadContent(thread.id);
        }
    });
    return div;
}

async function loadThreadContent(threadId) {
    currentThreadId = threadId;
    const panel = document.getElementById("thread-content-panel");
    panel.innerHTML = `<p>Načítám vlákno...</p>`;

    // Zvýraznění aktivního vlákna
    document.querySelectorAll('.threads-list-panel .thread').forEach(el => {
        el.classList.remove('active');
        if (el.getAttribute('data-thread-id') == threadId) {
            el.classList.add('active');
        }
    });

    try {
        const thread = await apiRequest(`/threads/${threadId}`);
        const currentUserId = parseInt(localStorage.getItem("user_id"), 10);
        const userRole = localStorage.getItem("role");

        // Zobrazení příspěvků
        let firstPostHtml = '';
        let otherPostsHtml = '';

        if (thread.posts && thread.posts.length > 0) {
            const firstPost = thread.posts[0];
            firstPostHtml = generatePostHtml(firstPost, userRole, currentUserId, true);

            // Ostatní příspěvky budou ve scrollable kontejneru
            if (thread.posts.length > 1) {
                otherPostsHtml = thread.posts.slice(1).map(p => generatePostHtml(p, userRole, currentUserId, false)).join('');
            }
        }

        // Tlačítko pro uzavření vlákna
        const canClose = (currentUserId === thread.author_id || userRole === 'admin');
        const canDeleteThread = (currentUserId === thread.author_id || userRole === 'admin');
        const threadActionsHtml = `
            ${canClose ? `<button id="closeThreadBtn" class="btn-small">${thread.is_closed ? 'Otevřít' : 'Uzavřít'} vlákno</button>` : ''}
            ${canDeleteThread ? `<button id="deleteThreadBtn" class="btn-small btn-danger">Smazat vlákno</button>` : ''}
        `;

        // Formulář pro přidání příspěvku nebo zpráva o uzavření
        const postFormHtml = thread.is_closed ?
            `<p class="thread-closed-msg">Toto vlákno je uzavřené.</p>` :
            `<form id="postForm" class="form">
                <textarea id="content" placeholder="Tvůj příspěvek" required></textarea>
                <div class="form-options">
                    <input type="checkbox" id="is_anonymous"> <label for="is_anonymous">Publikovat anonymně</label>
                </div>
                <button type="submit" class="btn">Odeslat</button>
            </form>`;

        panel.innerHTML = `
            <div class="thread-header">
                <h2>${thread.title}</h2>
                <div class="thread-actions">${threadActionsHtml}</div>
            </div>
            <div id="posts">
                ${firstPostHtml}
                ${otherPostsHtml ? `<div class="other-posts-container">${otherPostsHtml}</div>` : ''}
            </div>
            <div class="post-form-container">
                <hr>
                <h3>Přidat příspěvek</h3>
                ${postFormHtml}
            </div>
        `;

        if (!thread.is_closed) {
            document.getElementById("postForm").addEventListener("submit", addPost);
        }
        if (canClose) {
            document.getElementById("closeThreadBtn").addEventListener("click", () => toggleCloseThread(threadId));
        }
        if (canDeleteThread) {
            document.getElementById("deleteThreadBtn").addEventListener("click", () => deleteThread(threadId));
        }
    } catch (err) {
        console.error(`Chyba při načítání vlákna ${threadId}:`, err);
        panel.innerHTML = `<p class="error">Nepodařilo se načíst obsah vlákna.</p>`;
    }
}

function generatePostHtml(post, userRole, currentUserId, isFirstPost = false) {
    let rolePrefix = '';
    if (!post.is_deleted) {
        if (post.author_role === 'admin') {
            rolePrefix = '<span class="role-prefix admin">(Admin)</span> ';
        } else if (post.author_role === 'politician') {
            rolePrefix = '<span class="role-prefix politician">(Politik)</span> ';
        }
    }

    const canDelete = !post.is_deleted && (userRole === 'admin' || (post.author_id === currentUserId && post.replies.length === 0));
    const postActions = `
        <div class="post-actions">
            ${!post.is_deleted && !isFirstPost ? `<button class="btn-small btn-reply" onclick="showReplyForm(${post.id})">Odpovědět</button>` : ''}
            ${canDelete ? `<button class="btn-small btn-danger" onclick="deletePost(${post.id})">Smazat</button>` : ''}
        </div>
    `;

    const repliesHtml = post.replies.map(reply => generatePostHtml(reply, userRole, currentUserId, false)).join('');

    return `
        <div class="post ${post.is_deleted ? 'deleted' : ''}" id="post-${post.id}">
            <div class="post-header">
                <p class="post-author">${rolePrefix}<strong>${post.author}</strong> <span class="post-date">(${new Date(post.created_at).toLocaleString()})</span></p>
                ${postActions}
            </div>
            <p class="post-content">${post.content}</p>
            <div class="replies">
                ${repliesHtml}
            </div>
        </div>
    `;
}

function showReplyForm(parentPostId) {
    // Remove existing reply forms
    const existingForm = document.getElementById('replyForm');
    if (existingForm) existingForm.remove();

    const parentPost = document.getElementById(`post-${parentPostId}`);
    const formHtml = `
        <form id="replyForm" class="form reply-form" data-parent-id="${parentPostId}">
            <textarea id="replyContent" placeholder="Vaše odpověď..." required></textarea>
            <div class="form-options">
                <input type="checkbox" id="reply_is_anonymous"> <label for="reply_is_anonymous">Publikovat anonymně</label>
            </div>
            <button type="submit" class="btn">Odeslat odpověď</button>
        </form>
    `;
    parentPost.insertAdjacentHTML('beforeend', formHtml);
    document.getElementById('replyForm').addEventListener('submit', addPost);
}

document.getElementById("threadForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("title").value;

    try {
        await apiRequest("/threads", "POST", { title });
        document.getElementById("title").value = "";
        await loadThreads(); // Znovu načteme seznam vláken
    } catch (err) {
        alert(`Chyba při vytváření vlákna: ${err.message}`);
    }
});

async function addPost(e) {
    e.preventDefault();
    if (!currentThreadId) return;

    const isReply = e.target.id === 'replyForm';
    const content = isReply ? document.getElementById("replyContent").value : document.getElementById("content").value;
    const is_anonymous = isReply ? document.getElementById("reply_is_anonymous").checked : document.getElementById("is_anonymous").checked;
    const parent_post_id = isReply ? e.target.getAttribute('data-parent-id') : null;

    if (!content) return;

    try {
        await apiRequest(`/threads/${currentThreadId}/posts`, "POST", { 
            content, 
            is_anonymous,
            parent_post_id
        });
        // Znovu načteme obsah vlákna, aby se zobrazil nový příspěvek
        await loadThreadContent(currentThreadId);
    } catch (err) {
        alert(`Chyba při přidávání příspěvku: ${err.message}`);
    }
}

async function deletePost(postId) {
    if (!confirm("Opravdu si přejete smazat tento příspěvek?")) return;

    try {
        await apiRequest(`/posts/${postId}`, "DELETE");
        await loadThreadContent(currentThreadId); // Znovu načteme vlákno
    } catch (err) {
        alert(`Chyba při mazání příspěvku: ${err.message}`);
    }
}

async function deleteThread(threadId) {
    if (!confirm("Opravdu si přejete smazat toto vlákno? Všechny příspěvky budou odstraněny.")) return;

    try {
        await apiRequest(`/threads/${threadId}`, "DELETE");
        window.location.reload(); // Reload the forum page
    } catch (err) {
        alert(`Chyba při mazání vlákna: ${err.message}`);
    }
}

async function toggleCloseThread(threadId) {
    try {
        await apiRequest(`/threads/${threadId}/close`, "PUT");
        await loadThreadContent(threadId); // Znovu načteme vlákno pro aktualizaci stavu
    } catch (err) {
        alert(`Chyba při změně stavu vlákna: ${err.message}`);
    }
}

document.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', () => {
        const targetId = header.getAttribute('data-target');
        const section = document.getElementById(targetId).closest('.threads-section');
        
        section.classList.toggle('collapsed');

        const openSection = document.querySelector('.open-threads');
        const closedSection = document.querySelector('.closed-threads');

        const isOpenCollapsed = openSection.classList.contains('collapsed');
        const isClosedCollapsed = closedSection.classList.contains('collapsed');

        if (!isOpenCollapsed && !isClosedCollapsed) {
            openSection.style.flex = '1 1 50%';
            closedSection.style.flex = '1 1 50%';
        } else {
            openSection.style.flex = ''; // Reset to default behavior
            closedSection.style.flex = ''; // Reset to default behavior
        }
    });
});

loadThreads();
