let passwordPolicy = null;

document.getElementById("changePasswordForm").addEventListener("submit", async (e) => {
    // Zabrání výchozí akci formuláře (odeslání a znovunačtení stránky).
    e.preventDefault();

    // Načtení hodnot z formulářových polí.
    const old_password = document.getElementById("old_password").value;
    const new_password = document.getElementById("new_password").value;
    const confirm_password = document.getElementById("confirm_password").value;

    // Kontrola, zda se nové heslo a jeho potvrzení shodují.
    if (new_password !== confirm_password) {
        alert("Nová hesla se neshodují!");
        return;
    }

    try {
        // Odeslání požadavku na API pro změnu hesla.
        // Používá se metoda PUT a posílají se staré a nové heslo.
        const data = await apiRequest("/users/change_password", "PUT", {
            old_password: old_password,
            new_password: new_password
        });
        // Pokud je změna úspěšná, zobrazí se upozornění a uživatel je přesměrován na fórum.
        alert("Heslo bylo úspěšně změněno.");
        window.location.href = "forum.html";
    } catch (err) {
        // V případě chyby (např. špatné staré heslo) se zobrazí chybová hláška.
        let errorMessage = `Chyba při změně hesla: ${err.message}`;
        if (err.details && Array.isArray(err.details)) {
            errorMessage += "\n\n" + err.details.join("\n");
        }
        alert(errorMessage);
    }
});

function validatePasswordConfirmation() {
    const password = document.getElementById("new_password").value;
    const confirmPassword = document.getElementById("confirm_password").value;
    const errorElement = document.getElementById("password-match-error");
    const passwordsMatch = password === confirmPassword;

    errorElement.style.display = passwordsMatch ? "none" : "block";
    return passwordsMatch;
}

function validateForm() {
    const form = document.getElementById("changePasswordForm");
    const button = document.getElementById("changePasswordButton");
    const inputs = form.querySelectorAll("input[required]");

    let allFilled = true;
    for (const input of inputs) {
        if (!input.value.trim()) {
            allFilled = false;
            break;
        }
    }
    const passwordsMatch = validatePasswordConfirmation();
    button.disabled = !allFilled || !passwordsMatch;
}

// Načtení politiky hesel při načtení stránky
document.addEventListener("DOMContentLoaded", async () => {
    // Načteme politiku a uložíme si ji pro kontrolu síly
    passwordPolicy = await displayPasswordPolicy('password-policy-info');

    const newPasswordInput = document.getElementById('new_password');
    const formInputs = document.querySelectorAll("#changePasswordForm input[required]");

    newPasswordInput.addEventListener('input', (e) => checkPasswordStrength(e.target.value, passwordPolicy));

    formInputs.forEach(input => input.addEventListener('input', validateForm));
    validateForm();
});