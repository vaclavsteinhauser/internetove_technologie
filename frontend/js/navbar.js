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
        nav.innerHTML = /*html*/`
            <li class="nav-item">
                <a class="nav-link" href="login.html">Přihlásit se</a>
            </li>
            <li class="nav-item">
                <a class="btn btn-outline-light" href="register.html">Registrovat se</a>
            </li>
        `;
    } else {
        // Pokud token existuje, uživatel je přihlášený.
        const adminLinks = role === 'admin'
            ? {
                desktop: /*html*/`
                    <li class="nav-item d-none d-lg-block"><a class="nav-link" href="admin.html">Administrace</a></li>
                    <li class="nav-item d-none d-lg-block"><a class="nav-link" href="audit_log.html">Audit Log</a></li>`,
                mobile: /*html*/`
                    <li class="nav-item d-lg-none"><a class="nav-link" href="admin.html">Administrace</a></li>
                    <li class="nav-item d-lg-none"><a class="nav-link" href="audit_log.html">Audit Log</a></li>`
            }
            : '';

        nav.innerHTML = /*html*/`
            ${adminLinks ? adminLinks.desktop : ''}
            <li class="nav-item dropdown d-none d-lg-block">
                <a class="nav-link dropdown-toggle" href="#" id="navbarUserDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                    ${fullName || username}
                </a>
                <ul class="dropdown-menu dropdown-menu-end dropdown-menu-dark" aria-labelledby="navbarUserDropdown">
                    <li><a class="dropdown-item" href="change_password.html">Změna hesla</a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item" href="#" onclick="logout()">Odhlásit</a></li>
                </ul>
            </li>
            <!-- Odkazy pro mobilní zobrazení -->
            ${adminLinks ? adminLinks.mobile : ''}
            <li class="nav-item d-lg-none"><a class="nav-link" href="change_password.html">Změna hesla</a></li>
            <li class="nav-item d-lg-none"><a class="nav-link" href="#" onclick="logout()">Odhlásit (${fullName || username})</a></li>
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
