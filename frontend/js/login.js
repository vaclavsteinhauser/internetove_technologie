// Přidání posluchače události 'submit' na přihlašovací formulář.
document.getElementById("loginForm").addEventListener("submit", async (e) => {
    // Zabrání výchozí akci formuláře (odeslání a znovunačtení stránky).
    e.preventDefault();
    // Načtení hodnot z formulářových polí.
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        // Odeslání požadavku na API pro přihlášení.
        // Posílá se uživatelské jméno a heslo, autorizace (auth: false) není potřeba.
        const data = await apiRequest("/auth/login", "POST", { username, password }, false);
        
        // Po úspěšném přihlášení se do localStorage uloží potřebné informace:
        // - JWT token pro autorizaci dalších požadavků.
        // - Informace o uživateli (ID, jméno, role) pro zobrazení v UI a řízení přístupu.
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        localStorage.setItem("user_id", data.user.id);
        localStorage.setItem("username", data.user.username);
        localStorage.setItem("full_name", data.user.full_name);
        localStorage.setItem("role", data.user.role);
        // Přesměrování na hlavní stránku fóra.
        window.location.href = "forum.html";
    } catch (err) {
        // V případě chyby (špatné jméno/heslo) se zobrazí chybová hláška.
        alert(`Chyba přihlášení: ${err.message}`);
    }
});
