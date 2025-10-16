let passwordPolicy = null;

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

function validateForm() {
    const form = document.getElementById("registerForm");
    const button = document.getElementById("registerButton");
    const inputs = form.querySelectorAll("input[required]");
    
    let allFilled = true;
    for (const input of inputs) {
        if (input.value.trim() === "") {
            allFilled = false;
            break;
        }
    }
    button.disabled = !allFilled;
}

document.addEventListener("DOMContentLoaded", async () => {
    // Načtení politiky hesel při načtení stránky
    passwordPolicy = await displayPasswordPolicy('password-policy-info');

    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('input', (e) => {
            checkPasswordStrength(e.target.value, passwordPolicy);
        });
    }

    // Nastavení validace pro aktivaci tlačítka
    const formInputs = document.querySelectorAll("#registerForm input[required]");
    formInputs.forEach(input => {
        input.addEventListener('input', validateForm);
    });
    validateForm(); // Zavoláme na začátku pro nastavení výchozího stavu
});
