// Globální proměnná pro uchování ID aktuálně zobrazeného vlákna.
// Umožňuje různým funkcím (např. přidání příspěvku) vědět, ve kterém vlákně se nacházíme.
let currentThreadId = null;
// Lokální mezipaměť pro všechna vlákna, aby se minimalizovaly dotazy na API.
let allThreadsCache = [];

/**
 * Vykreslí seznam vláken do levého panelu na základě poskytnutých dat.
 * @param {Array<object>} threads - Pole objektů vláken k vykreslení.
 */
function renderThreadsList(threads) {
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
}

async function fetchAndRenderThreads() {
    try {
        allThreadsCache = await apiRequest("/threads");
        renderThreadsList(allThreadsCache);
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
    const a = document.createElement("a");
    a.href = "#";
    a.className = "list-group-item list-group-item-action";
    a.setAttribute("data-thread-id", thread.id);

    const displayTitle = thread.is_closed ? `${thread.title} (uzavřeno)` : thread.title;

    a.innerHTML = `
        <div class="d-flex w-100 justify-content-between">
            <h6 class="mb-1">${displayTitle}</h6>
            <small class="text-muted">${new Date(thread.created_at).toLocaleDateString()}</small>
        </div>
        <div class="d-flex w-100 justify-content-between">
            <small class="mb-1 text-muted">Autor: ${thread.author_full_name || 'Neznámý'} (@${thread.author_username})</small>
            <small class="mb-1 text-muted">Příspěvků: ${thread.post_count}</small>
        </div>
    `;
    a.addEventListener('click', (e) => {
        e.preventDefault();
        loadThreadContent(thread.id);
    });
    return a;
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
    panel.innerHTML = `<div class="card-body text-center p-5"><div class="spinner-border" role="status"><span class="visually-hidden">Načítám...</span></div></div>`;

    // Zvýraznění aktivního vlákna v levém panelu
    // Nejprve odstraníme zvýraznění ze všech, pak přidáme na to správné.
    document.querySelectorAll('.list-group-item').forEach(el => {
        el.classList.remove('active');
        if (el.getAttribute('data-thread-id') == threadId) {
            el.classList.add('active', 'bg-primary-subtle');
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
        panel.innerHTML = `<div class="card-body text-center text-danger p-5">Nepodařilo se načíst obsah vlákna.</div>`;
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
    panel.innerHTML = /*html*/`
        <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">${thread.title}</h5>
            <div class="d-flex gap-2">${threadActionsHtml}</div>
        </div>
        <div class="card-body" style="max-height: 70vh; overflow-y: auto;">
            <div id="posts">${postsHtml}</div>
        </div>
        <div class="card-footer">
            ${postFormHtml}
        </div>`;

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
        html += `<button data-action="toggle-close" class="btn btn-sm btn-outline-secondary">${thread.is_closed ? '🔓 Otevřít' : '🔒 Uzavřít'}</button>`;
    }
    if (canDeleteThread) {
        html += `<button data-action="delete-thread" class="btn btn-sm btn-outline-danger">🗑️ Smazat</button>`;
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
        return `<p class="text-muted text-center fst-italic m-0">Toto vlákno je uzavřené.</p>`;
    }
    return `
        <h6 class="mb-2">Přidat příspěvek</h6>
        <form id="postForm">
            <textarea id="content" class="form-control mb-2" placeholder="Tvůj příspěvek" required rows="3"></textarea>
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="is_anonymous"> <label class="form-check-label" for="is_anonymous">Publikovat anonymně</label>
            </div>
            <button type="submit" class="btn btn-primary">Odeslat</button>
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
            rolePrefix = '<span class="badge bg-danger me-1">Admin</span> ';
        } else if (post.author_role === 'politician') {
            rolePrefix = '<span class="badge bg-primary me-1">Politik</span> ';
        }
    }

    // Uživatel může smazat příspěvek, pokud je admin, nebo pokud je autorem příspěvku a ten nemá žádné odpovědi.
    const canDelete = !post.is_deleted && (userRole === 'admin' || (post.author_id === currentUserId && post.replies.length === 0));
    
    const likeButtonClass = post.liked_by_current_user ? 'btn-primary' : 'btn-outline-primary';

    // Sestavení tlačítek akcí pro příspěvek
    const postActions = /*html*/`
        <div class="d-flex gap-2">
            ${!post.is_deleted && !isFirstPost ? `<button class="btn btn-sm btn-outline-secondary" data-action="show-reply" data-post-id="${post.id}">↪️ Odpovědět</button>` : ''}
            ${canDelete ? `<button class="btn btn-sm btn-outline-danger" data-action="delete-post" data-post-id="${post.id}">🗑️ Smazat</button>` : ''}
            ${!post.is_deleted ? `<button class="btn btn-sm ${likeButtonClass}" data-action="like-post" data-post-id="${post.id}">👍 Lajk <span class="badge bg-secondary">${post.likes || 0}</span></button>` : ''}
        </div>
    `;

    const repliesHtml = post.replies.map(reply => generatePostHtml(reply, userRole, currentUserId)).join('');

    return `
        <div class="card mb-3 ${post.is_deleted ? 'bg-light' : ''}" id="post-${post.id}">
            <div class="card-header d-flex justify-content-between align-items-center py-2">
                <div class="fw-bold small">${rolePrefix}${post.author}</div>
                ${postActions}
            </div>
            <div class="card-body py-2">
                <p class="card-text ${post.is_deleted ? 'fst-italic text-muted' : ''}">${post.content}</p>
            </div>
            <div class="card-footer text-muted small py-1">${new Date(post.created_at).toLocaleString()}</div>
            <div class="ps-4 pt-3">
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
        <form id="replyForm" class="p-3 bg-light-subtle rounded mt-2" data-parent-id="${parentPostId}">
            <textarea id="replyContent" class="form-control form-control-sm mb-2" placeholder="Vaše odpověď..." required rows="2"></textarea>
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="reply_is_anonymous"> <label class="form-check-label small" for="reply_is_anonymous">Publikovat anonymně</label>
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Odeslat odpověď</button>
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
        case 'like-post':
            toggleLike(postId);
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
        e.target.reset();
        await fetchAndRenderThreads(); // Znovu načteme seznam vláken, aby se zobrazilo to nové.
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
        // 1. Znovu načteme seznam vláken vlevo z API.
        await fetchAndRenderThreads();
        // 2. Vyčistíme pravý panel a zobrazíme zástupný text.
        document.getElementById("thread-content-panel").innerHTML = `<div class="card-body text-center text-muted p-5">Vyberte vlákno ze seznamu vlevo.</div>`;
        // 3. Resetujeme ID aktuálního vlákna.
        currentThreadId = null;
    } catch (err) {
        alert(`Chyba při mazání vlákna: ${err.message}`);
    }
}

async function toggleLike(postId) {
    try {
        await apiRequest(`/posts/${postId}/like`, "POST");
        await loadThreadContent(currentThreadId); // Znovu načteme vlákno pro aktualizaci počtu lajků
    } catch (err) {
        alert(`Chyba při lajkování: ${err.message}`);
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
 * Nastaví posluchač pro vyhledávací pole.
 * Filtruje lokálně uložená vlákna.
 */
function setupSearch() {
    const searchInput = document.getElementById('thread-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        
        // Filtrujeme vlákna z lokální mezipaměti
        const filteredThreads = allThreadsCache.filter(thread => 
            thread.title.toLowerCase().includes(query)
        );

        // Vykreslíme vyfiltrovaný seznam
        renderThreadsList(filteredThreads);
    });
}

/**
 * Inicializační funkce, která se spustí po načtení stránky.
 */
async function initializeForum() {
    // Nastavení vyhledávání
    setupSearch();

    // Načteme všechna vlákna z API a vykreslíme je.
    await fetchAndRenderThreads();

    // Zkontrolujeme, zda je v URL specifikováno ID vlákna k načtení.
    const params = new URLSearchParams(window.location.search);
    const threadIdFromUrl = params.get('thread_id');
    if (threadIdFromUrl) {
        await loadThreadContent(threadIdFromUrl);
    }
}

// Spuštění inicializace fóra.
initializeForum();
