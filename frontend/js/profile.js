document.addEventListener("DOMContentLoaded", async () => {
    // Zkontrolujeme, zda je uživatel přihlášen
    if (!localStorage.getItem("accessToken")) {
        window.location.href = "login.html";
        return;
    }

    // Načteme politiku hesel a data profilu
    await displayPasswordPolicy('password-policy-info');
    await loadProfileData();

    // Nastavíme posluchače událostí
    const form = document.getElementById("profileForm");
    form.addEventListener("submit", handleProfileUpdate);
    form.addEventListener("input", validateForm);

    validateForm(); // Počáteční validace
});

/**
 * Načte data profilu z API a vyplní formulář.
 */
async function loadProfileData() {
    try {
        const profile = await apiRequest("/profile");
        document.getElementById("full_name").value = profile.full_name || '';
        document.getElementById("username").value = profile.username || '';
        document.getElementById("email").value = profile.email || '';
        validateForm(); // Po načtení dat znovu validujeme
    } catch (error) {
        alert(`Chyba při načítání profilu: ${error.message}`);
        // Případně přesměrovat na login, pokud je token neplatný
        if (error.message.includes("401")) {
            logout();
        }
    }
}

/**
 * Zpracuje odeslání formuláře pro aktualizaci profilu.
 */
async function handleProfileUpdate(e) {
    e.preventDefault();
    const saveButton = document.getElementById("saveProfileButton");
    saveButton.disabled = true;

    const data = {
        full_name: document.getElementById("full_name").value,
        old_password: document.getElementById("old_password").value,
        new_password: document.getElementById("new_password").value,
    };

    // Pokud nové heslo není vyplněno, neposíláme hesla vůbec
    if (!data.new_password.trim()) {
        delete data.old_password;
        delete data.new_password;
    }

    try {
        const response = await apiRequest("/profile", "PUT", data);
        alert(response.message || "Profil byl úspěšně aktualizován.");
        // Aktualizujeme jméno v localStorage, aby se projevilo v navbaru
        localStorage.setItem("full_name", data.full_name);
        window.location.reload(); // Znovu načteme stránku pro zobrazení změn
    } catch (error) {
        alert(`Chyba při aktualizaci profilu: ${error.message}`);
    } finally {
        saveButton.disabled = false;
    }
}

/**
 * Validuje formulář a (de)aktivuje tlačítko pro uložení.
 */
function validateForm() {
    const fullName = document.getElementById("full_name").value.trim();
    document.getElementById("saveProfileButton").disabled = !fullName;
}