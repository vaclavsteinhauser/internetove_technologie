/**
 * Načte HTML obsah navigační lišty ze souboru `navbar.html` a vloží ho do
 * elementu `#navbar-container`. Poté zavolá funkci pro vykreslení obsahu lišty.
 */
async function loadNavbar() {
    const container = document.getElementById("navbar-container");
    if (!container) return;

    // Načtení externího HTML souboru.
    const res = await fetch("navbar.html");
    const html = await res.text();
    container.innerHTML = html;

    // Po vložení HTML struktury se zavolá funkce, která doplní dynamický obsah.
    renderNavbar();
}

/**
 * Vykreslí dynamický obsah navigační lišty podle toho, zda je uživatel
 * přihlášený nebo odhlášený.
 */
function renderNavbar() {
    const nav = document.getElementById("nav-links");
    // Kontrolujeme přítomnost access tokenu pro zjištění stavu přihlášení.
    const token = localStorage.getItem("accessToken");
    const username = localStorage.getItem("username");
    const fullName = localStorage.getItem("full_name");
    const role = localStorage.getItem("role");

    // Pokud token neexistuje, uživatel je odhlášený.
    if (!token) {
        // Zobrazí se odkazy pro přihlášení a registraci.
        nav.innerHTML = `
      <a href="login.html">Přihlášení</a>
      <a href="register.html">Registrace</a>
    `;
    } else {
        // Pokud token existuje, uživatel je přihlášený.
        // Zobrazí se odkaz na administraci, pokud má uživatel roli 'admin'.
        const adminLinks = role === 'admin' 
            ? `<a href="admin.html">Správa uživatelů</a>
               <a href="audit_log.html">Audit Log</a>` 
            : '';
        // Sestavení HTML pro přihlášeného uživatele.
        nav.innerHTML = `
      <div class="user-info">
        <span class="user-fullname">${fullName || username || "Uživatel"}</span>
        <span class="user-username">@${username || "uživatel"}</span>
      </div>
      <div class="nav-actions">
        ${adminLinks} <!-- Vloží se odkazy na admin stránky, nebo prázdný řetězec -->
        <a href="change_password.html">Změna hesla</a>
        <a href="#" onclick="logout()">Odhlásit</a> <!-- Odkaz spouští funkci pro odhlášení -->
      </div>
    `;
    }
}

/**
 * Odhlásí uživatele smazáním všech souvisejících dat z localStorage a přesměruje ho na úvodní stránku.
 */
function logout() {
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken) {
        // Pokusíme se odhlásit i na serveru. `finally` blok zajistí, že se lokální odhlášení provede vždy.
        apiRequest("/auth/logout", "POST", { refreshToken })
            .catch(err => {
                console.error("Server-side logout failed, proceeding with client-side logout.", err);
            })
            .finally(() => {
                clearLocalDataAndRedirect();
        });
    }
    // Smažeme všechna data z localStorage a přesměrujeme
    localStorage.clear();
    window.location.href = "index.html"; 
}

/**
 * Vymaže lokální úložiště a přesměruje na úvodní stránku.
 */
function clearLocalDataAndRedirect() {
    localStorage.clear();
    window.location.href = "index.html";
}

// Po načtení DOM se automaticky spustí načítání navigační lišty.
document.addEventListener("DOMContentLoaded", loadNavbar);
