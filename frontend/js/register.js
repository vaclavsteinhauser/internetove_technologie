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
        const response = await apiRequest("/auth/register", "POST", { full_name, username, email, password }, false);
        // Po úspěšné registraci se zobrazí upozornění a uživatel je přesměrován na přihlašovací stránku.
        alert(response.message || "Registrace úspěšná, můžeš se přihlásit.");
        window.location.href = "login.html";
    } catch (err) {
        // V případě chyby (např. uživatelské jméno již existuje) se zobrazí chybová hláška.
        let errorMessage = `Chyba při registraci: ${err.message}`;
        if (err.details && Array.isArray(err.details)) {
            errorMessage += "\n\n" + err.details.join("\n");
        }
        alert(errorMessage);
    }
});

// Načtení politiky hesel při načtení stránky
displayPasswordPolicy('password-policy-info');
