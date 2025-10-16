/**
 * Načte a zobrazí aktuální politiku hesel.
 */
async function displayPasswordPolicy() {
    try {
        const policy = await apiRequest("/auth/password-policy", "GET", null, false);
        const rules = [];
        rules.push(`Minimální délka: ${policy.min_length} znaků.`);
        if (policy.require_uppercase) rules.push("Musí obsahovat velké písmeno.");
        if (policy.require_number) rules.push("Musí obsahovat číslici.");
        if (policy.require_special) rules.push("Musí obsahovat speciální znak.");

        document.getElementById('password-policy-info').innerHTML = `<strong>Požadavky na heslo:</strong><br>${rules.join('<br>')}`;
    } catch (err) {
        console.error("Failed to load password policy:", err);
    }
}

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
displayPasswordPolicy();
