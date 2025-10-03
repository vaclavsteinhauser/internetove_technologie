document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        const data = await apiRequest("/auth/login", "POST", { username, password }, false);
        localStorage.setItem("token", data.token);
        localStorage.setItem("user_id", data.user.id); // Uložíme ID
        localStorage.setItem("username", data.user.username); // Uložíme username z odpovědi
        localStorage.setItem("full_name", data.user.full_name); // Uložíme full_name z odpovědi
        localStorage.setItem("role", data.user.role); // Uložíme roli
        window.location.href = "forum.html";
    } catch (err) {
        alert(`Chyba přihlášení: ${err.message}`);
    }
});
