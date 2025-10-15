// Přidání posluchače události 'submit' na formulář pro změnu hesla.
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
        alert(`Chyba při změně hesla: ${err.message}`);
    }
});