let currentThreadId = null;

async function loadThreads() {
    try {
        const threads = await apiRequest("/threads");
        const container = document.getElementById("threads-list");
        container.innerHTML = "";

        threads.forEach(t => {
            const div = document.createElement("div");
            div.className = "thread";
            div.setAttribute("data-thread-id", t.id);
            div.innerHTML = `
                <h3>${t.title}</h3>
                <p>Autor: ${t.author}, ${new Date(t.created_at).toLocaleString()}</p>
            `;
            div.addEventListener("click", () => loadThreadContent(t.id));
            container.appendChild(div);
        });
    } catch (err) {
        console.error("Chyba při načítání vláken:", err);
        alert("Chyba při načítání vláken.");
    }
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
        let postsHtml = thread.posts.map(p => `
            <div class="post">
                <p><strong>${p.author}</strong> <span class="post-date">(${new Date(p.created_at).toLocaleString()})</span></p>
                <p>${p.content}</p>
            </div>
        `).join('');

        panel.innerHTML = `
            <h2>${thread.title}</h2>
            <div id="posts">${postsHtml}</div>
            <hr>
            <h3>Přidat příspěvek</h3>
            <form id="postForm" class="form">
                <textarea id="content" placeholder="Tvůj příspěvek" required></textarea>
                <button type="submit" class="btn">Odeslat</button>
            </form>
        `;

        document.getElementById("postForm").addEventListener("submit", addPost);

    } catch (err) {
        console.error(`Chyba při načítání vlákna ${threadId}:`, err);
        panel.innerHTML = `<p class="error">Nepodařilo se načíst obsah vlákna.</p>`;
    }
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

    const content = document.getElementById("content").value;
    if (!content) return;

    try {
        await apiRequest(`/threads/${currentThreadId}/posts`, "POST", { content });
        // Znovu načteme obsah vlákna, aby se zobrazil nový příspěvek
        await loadThreadContent(currentThreadId);
    } catch (err) {
        alert(`Chyba při přidávání příspěvku: ${err.message}`);
    }
}

loadThreads();
