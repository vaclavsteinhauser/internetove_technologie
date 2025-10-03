document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const full_name = document.getElementById("full_name").value;
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        await apiRequest("/auth/register", "POST", { full_name, username, password }, false);
        alert("Registrace úspěšná, můžeš se přihlásit.");
        window.location.href = "login.html";
    } catch (err) {
        alert("Chyba při registraci!");
    }
});
