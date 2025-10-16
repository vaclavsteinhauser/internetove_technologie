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

        const policyInfoElement = document.getElementById('password-policy-info');
        if (policyInfoElement) {
            policyInfoElement.innerHTML = `<strong>Požadavky na heslo:</strong><br>${rules.join('<br>')}`;
        }
    } catch (err) {
        console.error("Failed to load password policy:", err);
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
    displayPasswordPolicy();
});