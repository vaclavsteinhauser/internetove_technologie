/**
 * Získá ID vlákna z URL query parametrů (např. z ?id=123).
 * @returns {string|null} - ID vlákna jako řetězec, nebo null, pokud není přítomno.
 */
function getThreadId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
}

/**
 * Načte a zobrazí obsah jednoho konkrétního vlákna na základě ID z URL.
 */
async function loadThread() {
    const threadId = getThreadId();
    try {
        // Načtení dat o vlákně a jeho příspěvcích z API.
        const thread = await apiRequest(`/threads/${threadId}`);
        // Vložení názvu vlákna a autora do příslušných HTML elementů.
        document.getElementById("threadTitle").innerText = thread.title;
        document.getElementById("threadAuthor").innerText = thread.author_id;

        const postsDiv = document.getElementById("posts");
        // Vyprázdnění kontejneru s příspěvky před novým vykreslením.
        postsDiv.innerHTML = "";
        // Pro každý příspěvek ve vlákně se vytvoří a přidá nový DOM element.
        thread.posts.forEach(p => {
            const div = document.createElement("div");
            div.className = "post";
            div.innerHTML = `
                <p><strong>${p.author}</strong> (${new Date(p.created_at).toLocaleString()})</p>
                <p>${p.content}</p>
            `;
            postsDiv.appendChild(div);
        });
    } catch (err) {
        // Zobrazení chyby, pokud se nepodaří vlákno načíst.
        alert("Chyba při načítání vlákna");
    }
}

// Přidání posluchače události 'submit' na formulář pro přidání příspěvku.
document.getElementById("postForm").addEventListener("submit", async (e) => {
    // Zabrání výchozí akci formuláře.
    e.preventDefault();
    // Získání obsahu z textového pole a ID vlákna.
    const content = document.getElementById("content").value;
    const threadId = getThreadId();

    try {
        // Odeslání požadavku na API pro vytvoření nového příspěvku.
        await apiRequest(`/threads/${threadId}/posts`, "POST", { content });
        // Vymazání textového pole a znovunačtení celého vlákna pro zobrazení nového příspěvku.
        document.getElementById("content").value = "";
        loadThread();
    } catch (err) {
        // Zobrazení chyby, pokud se nepodaří příspěvek přidat.
        alert("Chyba při přidávání příspěvku");
    }
});

// Spuštění načítání vlákna ihned po načtení skriptu.
loadThread();
