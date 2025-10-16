// Globální proměnná pro uložení politiky hesel
let passwordPolicy = null;

function checkPasswordStrength(password) {
    if (!passwordPolicy || !password) {
        updateStrengthUI(0, "Zadejte heslo", "bg-secondary");
        return;
    }

    let score = 0;
    if (password.length >= passwordPolicy.min_length) score++;
    if (passwordPolicy.require_uppercase && /[A-Z]/.test(password)) score++;
    if (passwordPolicy.require_number && /[0-9]/.test(password)) score++;
    if (passwordPolicy.require_special && /[\W_]/.test(password)) score++;

    const strengthLevels = {
        0: { text: "Velmi slabé", color: "bg-danger", width: "25%" },
        1: { text: "Velmi slabé", color: "bg-danger", width: "25%" },
        2: { text: "Slabé", color: "bg-warning", width: "50%" },
        3: { text: "Střední", color: "bg-info", width: "75%" },
        4: { text: "Silné", color: "bg-success", width: "100%" },
    };

    const level = strengthLevels[score] || strengthLevels[0];
    updateStrengthUI(level.width, level.text, level.color);
}

function updateStrengthUI(width, text, colorClass) {
    const strengthBar = document.getElementById('password-strength-bar');
    const strengthText = document.getElementById('password-strength-text');

    if (strengthBar) {
        strengthBar.style.width = width;
        strengthBar.className = 'progress-bar'; // Reset barev
        strengthBar.classList.add(colorClass);
    }
    if (strengthText) {
        strengthText.textContent = text;
    }
}

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

// Načtení politiky hesel při načtení stránky
document.addEventListener("DOMContentLoaded", () => {
    // Načteme politiku a uložíme si ji pro kontrolu síly
    passwordPolicy = await displayPasswordPolicy('password-policy-info');

    const newPasswordInput = document.getElementById('new_password');
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', (e) => checkPasswordStrength(e.target.value));
    }
});