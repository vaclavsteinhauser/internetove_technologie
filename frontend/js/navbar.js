async function loadNavbar() {
    const container = document.getElementById("navbar-container");
    if (!container) return;

    // načti HTML navbaru
    const res = await fetch("navbar.html");
    const html = await res.text();
    container.innerHTML = html;

    renderNavbar();
}

function renderNavbar() {
    const nav = document.getElementById("nav-links");
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    const fullName = localStorage.getItem("full_name");
    const role = localStorage.getItem("role");

    if (!token) {
        // odhlášený
        nav.innerHTML = `
      <a href="login.html">Přihlášení</a>
      <a href="register.html">Registrace</a>
    `;
    } else {
        // přihlášený
        const adminLink = role === 'admin' ? '<a href="admin.html">Správa uživatelů</a>' : '';
        nav.innerHTML = `
      <div class="user-info">
        <span class="user-fullname">${fullName || username || "Uživatel"}</span>
        <span class="user-username">@${username || "uživatel"}</span>
      </div>
      <div class="nav-actions">
        ${adminLink}
        <a href="change_password.html">Změna hesla</a>
        <a href="#" onclick="logout()">Odhlásit</a>
      </div>
    `;
    }
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");
    localStorage.removeItem("full_name");
    localStorage.removeItem("role");
    window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", loadNavbar);
