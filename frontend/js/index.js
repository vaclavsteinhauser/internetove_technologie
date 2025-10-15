// Spustí se po úplném načtení DOM struktury stránky.
document.addEventListener("DOMContentLoaded", () => {
    // Zkontroluje, zda je v localStorage uložen přihlašovací token.
    if (localStorage.getItem("accessToken")) {
        // Pokud ano (uživatel je přihlášen), přesměruje ho rovnou na stránku fóra.
        window.location.href = "forum.html";
    }
});