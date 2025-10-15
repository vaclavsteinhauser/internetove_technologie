// Globální proměnná pro uchování ID aktuálně zobrazeného vlákna.
// Umožňuje různým funkcím (např. přidání příspěvku) vědět, ve kterém vlákně se nacházíme.
let currentThreadId = null;

/**
 * Načte všechna vlákna z API a rozdělí je na otevřená a uzavřená.
 * Vloží je do příslušných sekcí v levém panelu.
 */
async function loadThreads() {
    try {
        const threads = await apiRequest("/threads");
        const currentUserId = parseInt(localStorage.getItem("user_id"), 10);

        const openThreadsContainer = document.getElementById("open-threads-content");
        const closedThreadsContainer = document.getElementById("closed-threads-content");
        const myThreadsContainer = document.getElementById("my-threads-content");

        openThreadsContainer.innerHTML = "";
        closedThreadsContainer.innerHTML = "";
        myThreadsContainer.innerHTML = "";

        // Rozdělení vláken podle stavu a autora
        const openThreads = threads.filter(t => !t.is_closed);
        const closedThreads = threads.filter(t => t.is_closed);
        const myThreads = threads.filter(t => t.author_id === currentUserId);

        // Vytvoření a vložení DOM elementů pro každé vlákno
        openThreads.forEach(t => openThreadsContainer.appendChild(createThreadElement(t)));
        closedThreads.forEach(t => closedThreadsContainer.appendChild(createThreadElement(t)));
        myThreads.forEach(t => myThreadsContainer.appendChild(createThreadElement(t)));

    } catch (err) {
        console.error("Chyba při načítání vláken:", err);
        alert("Chyba při načítání vláken.");
    }
}

/**
 * Vytvoří DOM element pro jedno vlákno v seznamu.
 * @param {object} thread - Objekt s daty vlákna z API.
 * @returns {HTMLElement} - Div element reprezentující vlákno.
 */
function createThreadElement(thread) {
    const div = document.createElement("div");
    div.className = "thread";
    div.setAttribute("data-thread-id", thread.id);

    const displayTitle = thread.is_closed ? `${thread.title} (uzavřeno)` : thread.title;

    div.innerHTML = `
        <div class="thread-summary">
            <div class="collapser-wrapper">
                <span class="collapser-icon"></span>
            </div>
            <h3 class="thread-title">${displayTitle}</h3> 
        </div>
        <div class="thread-details">
            <p><strong>Autor:</strong> ${thread.author_full_name || 'Neznámý'}</p>
            <p><strong>Uživ. jméno:</strong> @${thread.author_username}</p>
            <p><strong>Vytvořeno:</strong> ${new Date(thread.created_at).toLocaleString()}</p>
        </div>
    `;
    
    const summary = div.querySelector('.thread-summary');
    // Přidání posluchače událostí na hlavičku vlákna
    summary.addEventListener('click', (e) => {
        // Pokud bylo kliknuto na ikonu nebo její obal, rozbalí/sbalí se detaily vlákna.
        if (e.target.closest('.collapser-wrapper')) {
            div.classList.toggle('expanded');
        } else {
            // Jinak se načte obsah celého vlákna do pravého panelu.
            loadThreadContent(thread.id);
        }
    });
    return div;
}

async function loadThreadContent(threadId) {
    // Aktualizujeme URL, aby odrážela aktuálně zobrazené vlákno.
    // To umožní setrvání na vlákně i po obnovení stránky.
    const url = new URL(window.location);
    url.searchParams.set('thread_id', threadId);
    // `replaceState` mění URL bez nutnosti znovunačtení stránky.
    window.history.replaceState({}, '', url);

    currentThreadId = threadId;
    const panel = document.getElementById("thread-content-panel");
    panel.innerHTML = `<p>Načítám vlákno...</p>`;

    // Zvýraznění aktivního vlákna v levém panelu
    // Nejprve odstraníme zvýraznění ze všech, pak přidáme na to správné.
    document.querySelectorAll('.threads-list-panel .thread').forEach(el => {
        el.classList.remove('active');
        if (el.getAttribute('data-thread-id') == threadId) {
            el.classList.add('active');
        }
    });

    try {
        // Načtení detailů vlákna a jeho příspěvků z API
        const thread = await apiRequest(`/threads/${threadId}`);
        const currentUserId = parseInt(localStorage.getItem("user_id"), 10);
        const userRole = localStorage.getItem("role");

        // Vykreslení celého obsahu pravého panelu
        renderThreadContent(panel, thread, userRole, currentUserId);

    } catch (err) {
        console.error(`Chyba při načítání vlákna ${threadId}:`, err);
        panel.innerHTML = `<p class="error">Nepodařilo se načíst obsah vlákna.</p>`;
    }
}

/**
 * Vykreslí kompletní obsah pravého panelu pro dané vlákno.
 * @param {HTMLElement} panel - Cílový element, kam se má obsah vykreslit.
 * @param {object} thread - Objekt vlákna.
 * @param {string} userRole - Role přihlášeného uživatele.
 * @param {number} currentUserId - ID přihlášeného uživatele.
 */
function renderThreadContent(panel, thread, userRole, currentUserId) {
    // Generování HTML pro jednotlivé části panelu
    const postsHtml = thread.posts.map(p => generatePostHtml(p, userRole, currentUserId, p.id === thread.posts[0]?.id)).join('');
    const threadActionsHtml = generateThreadActionsHtml(thread, userRole, currentUserId);
    const postFormHtml = generatePostFormHtml(thread);

    // Sestavení finálního HTML a vložení do panelu
    panel.innerHTML = `
        <div class="thread-header">
            <h2>${thread.title}</h2>
            <div class="thread-actions">${threadActionsHtml}</div>
        </div>
        <div id="posts">${postsHtml}</div>
        <div class="post-form-container">
            <hr>
            <h3>Přidat příspěvek</h3>
            ${postFormHtml}
        </div>
    `;

    // Přidání posluchačů událostí na nově vytvořené prvky
    // Používáme delegaci událostí na panelu, abychom nemuseli přidávat posluchače na každý prvek zvlášť.
    panel.addEventListener('click', handlePanelClick);
    const postForm = panel.querySelector("#postForm");
    if (postForm) {
        postForm.addEventListener("submit", addPost);
    }
}

/**
 * Generuje HTML pro akce vlákna (uzavření, smazání).
 * @param {object} thread - Objekt vlákna.
 * @param {string} userRole - Role přihlášeného uživatele.
 * @param {number} currentUserId - ID přihlášeného uživatele.
 * @returns {string} HTML řetězec s tlačítky.
 */
function generateThreadActionsHtml(thread, userRole, currentUserId) {
    const canClose = (currentUserId === thread.author_id || userRole === 'admin');
    const canDeleteThread = (currentUserId === thread.author_id || userRole === 'admin');

    let html = '';
    if (canClose) {
        html += `<button data-action="toggle-close" class="btn-small btn-secondary">${thread.is_closed ? '🔓 Otevřít' : '🔒 Uzavřít'} vlákno</button>`;
    }
    if (canDeleteThread) {
        html += `<button data-action="delete-thread" class="btn-small btn-danger">🗑️ Smazat vlákno</button>`;
    }
    return html;
}

/**
 * Generuje HTML pro formulář pro přidání příspěvku nebo zprávu o uzavření.
 * @param {object} thread - Objekt vlákna.
 * @returns {string} HTML řetězec s formulářem nebo zprávou.
 */
function generatePostFormHtml(thread) {
    if (thread.is_closed) {
        return `<p class="thread-closed-msg">Toto vlákno je uzavřené.</p>`;
    }
    return `
        <form id="postForm" class="form">
            <textarea id="content" placeholder="Tvůj příspěvek" required></textarea>
            <div class="form-options">
                <input type="checkbox" id="is_anonymous"> <label for="is_anonymous">Publikovat anonymně</label>
            </div>
            <button type="submit" class="btn">Odeslat</button>
        </form>
    `;
}

/**
 * Generuje HTML pro jeden příspěvek (včetně jeho odpovědí).
 * @param {object} post - Objekt příspěvku.
 * @param {string} userRole - Role přihlášeného uživatele.
 * @param {number} currentUserId - ID přihlášeného uživatele.
 * @param {boolean} isFirstPost - Zda se jedná o první příspěvek ve vlákně.
 * @returns {string} HTML řetězec pro příspěvek.
 */
function generatePostHtml(post, userRole, currentUserId, isFirstPost = false) {
    let rolePrefix = '';
    if (!post.is_deleted) {
        if (post.author_role === 'admin') {
            rolePrefix = '<span class="role-prefix admin">(Admin)</span> ';
        } else if (post.author_role === 'politician') {
            rolePrefix = '<span class="role-prefix politician">(Politik)</span> ';
        }
    }

    // Uživatel může smazat příspěvek, pokud je admin, nebo pokud je autorem příspěvku a ten nemá žádné odpovědi.
    const canDelete = !post.is_deleted && (userRole === 'admin' || (post.author_id === currentUserId && post.replies.length === 0));
    
    // Sestavení tlačítek akcí pro příspěvek s novými ikonami a třídami
    const postActions = /*html*/`
        <div class="post-actions">
            ${!post.is_deleted && !isFirstPost ? `<button class="btn-small btn-reply btn-secondary" data-action="show-reply" data-post-id="${post.id}">↪️ Odpovědět</button>` : ''}
            ${canDelete ? `<button class="btn-small btn-danger" data-action="delete-post" data-post-id="${post.id}">🗑️ Smazat</button>` : ''}
        </div>
    `;

    const repliesHtml = post.replies.map(reply => generatePostHtml(reply, userRole, currentUserId)).join('');

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

/**
 * Zobrazí formulář pro odpověď pod daným příspěvkem.
 * @param {number} parentPostId - ID příspěvku, na který se odpovídá.
 */
function showReplyForm(parentPostId) {
    // Odstraníme jakýkoli existující formulář pro odpověď, aby byl na stránce vždy jen jeden.
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
    // Formulář pro odpověď používá stejnou odesílací funkci jako hlavní formulář.
    document.getElementById('replyForm').addEventListener('submit', addPost);
    document.getElementById('replyContent').focus(); // Automaticky zaostří na textové pole
}

/**
 * Zpracovává kliknutí v pravém panelu pomocí delegace událostí.
 * @param {Event} e - Objekt události.
 */
function handlePanelClick(e) {
    const target = e.target.closest('button[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const postId = target.dataset.postId;

    switch (action) {
        case 'show-reply':
            showReplyForm(postId);
            break;
        case 'delete-post':
            deletePost(postId);
            break;
        case 'toggle-close':
            toggleCloseThread(currentThreadId);
            break;
        case 'delete-thread':
            deleteThread(currentThreadId);
            break;
    }
}

/**
 * Posluchač pro odeslání formuláře pro vytvoření nového vlákna.
 */
document.getElementById("threadForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("title").value;

    try {
        await apiRequest("/threads", "POST", { title });
        document.getElementById("title").value = "";
        await loadThreads(); // Znovu načteme seznam vláken, aby se zobrazilo to nové.
    } catch (err) {
        alert(`Chyba při vytváření vlákna: ${err.message}`);
    }
});

/**
 * Zpracovává odeslání formuláře pro přidání příspěvku nebo odpovědi.
 * @param {Event} e - Objekt události.
 */
async function addPost(e) {
    e.preventDefault();
    if (!currentThreadId) return;

    // Rozlišení, zda jde o nový příspěvek nebo odpověď na existující.
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
        // Znovu načteme obsah vlákna, aby se zobrazil nový příspěvek/odpověď.
        await loadThreadContent(currentThreadId);
    } catch (err) {
        alert(`Chyba při přidávání příspěvku: ${err.message}`);
    }
}

async function deletePost(postId) {
    if (!confirm("Opravdu si přejete smazat tento příspěvek?")) {
        return;
    }

    try {
        await apiRequest(`/posts/${postId}`, "DELETE");
        // Znovu načteme obsah vlákna, aby se zobrazil smazaný příspěvek.
        await loadThreadContent(currentThreadId);
    } catch (err) {
        alert(`Chyba při mazání příspěvku: ${err.message}`);
    }
}

async function deleteThread(threadId) {
    if (!confirm("Opravdu si přejete smazat toto vlákno? Všechny příspěvky budou odstraněny.")) return;

    try {
        await apiRequest(`/threads/${threadId}`, "DELETE");
        // Po smazání vlákna:
        // 1. Znovu načteme seznam vláken vlevo.
        await loadThreads();
        // 2. Vyčistíme pravý panel a zobrazíme zástupný text.
        document.getElementById("thread-content-panel").innerHTML = `<p class="placeholder">Vyberte vlákno ze seznamu.</p>`;
        // 3. Resetujeme ID aktuálního vlákna.
        currentThreadId = null;
    } catch (err) {
        alert(`Chyba při mazání vlákna: ${err.message}`);
    }
}

async function toggleCloseThread(threadId) {
    try {
        await apiRequest(`/threads/${threadId}/close`, "PUT");
        // Požadavek na obnovení celé stránky.
        // Díky uložení ID vlákna do URL se po obnovení načte správné vlákno.
        window.location.reload();
    } catch (err) {
        alert(`Chyba při změně stavu vlákna: ${err.message}`);
    }
}

/**
 * Přidá posluchače událostí na hlavičky sekcí (Otevřená/Uzavřená vlákna)
 * pro jejich sbalování a rozbalování.
 */
document.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', () => {
        const section = header.closest('.threads-section');
        section.classList.toggle('collapsed');
    });
});

/**
 * Inicializační funkce, která se spustí po načtení stránky.
 */
async function initializeForum() {
    // Nejprve načteme seznam všech vláken do levého panelu.
    await loadThreads();

    // Zkontrolujeme, zda je v URL specifikováno ID vlákna k načtení.
    const params = new URLSearchParams(window.location.search);
    const threadIdFromUrl = params.get('thread_id');
    if (threadIdFromUrl) {
        await loadThreadContent(threadIdFromUrl);
    }
}

// Spuštění inicializace fóra.
initializeForum();
