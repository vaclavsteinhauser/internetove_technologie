// Přidání posluchače události 'submit' na registrační formulář.
document.getElementById("registerForm").addEventListener("submit", async (e) => {
    // Zabrání výchozí akci formuláře (odeslání a znovunačtení stránky).
    e.preventDefault();
    // Načtení hodnot z formulářových polí.
    const full_name = document.getElementById("full_name").value;
    const username = document.getElementById("username").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        // Odeslání požadavku na API pro registraci nového uživatele.
        // Autorizace (auth: false) není potřeba.
        await apiRequest("/auth/register", "POST", { full_name, username, email, password }, false);
        // Po úspěšné registraci se zobrazí upozornění a uživatel je přesměrován na přihlašovací stránku.
        alert("Registrace úspěšná, můžeš se přihlásit.");
        window.location.href = "login.html";
    } catch (err) {
        // V případě chyby (např. uživatelské jméno již existuje) se zobrazí chybová hláška.
        alert("Chyba při registraci!");
    }
});
