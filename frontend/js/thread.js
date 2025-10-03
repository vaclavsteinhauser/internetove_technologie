function getThreadId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
}

async function loadThread() {
    const threadId = getThreadId();
    try {
        const thread = await apiRequest(`/threads/${threadId}`);
        document.getElementById("threadTitle").innerText = thread.title;
        document.getElementById("threadAuthor").innerText = thread.author_id;

        const postsDiv = document.getElementById("posts");
        postsDiv.innerHTML = "";
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
        alert("Chyba při načítání vlákna");
    }
}

document.getElementById("postForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = document.getElementById("content").value;
    const threadId = getThreadId();

    try {
        await apiRequest(`/threads/${threadId}/posts`, "POST", { content });
        document.getElementById("content").value = "";
        loadThread();
    } catch (err) {
        alert("Chyba při přidávání příspěvku");
    }
});

loadThread();
