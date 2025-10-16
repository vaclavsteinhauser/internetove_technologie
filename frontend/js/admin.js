// Spustí se po úplném načtení DOM struktury stránky.
document.addEventListener("DOMContentLoaded", async () => {
    // Získá roli přihlášeného uživatele z localStorage.
    const userRole = localStorage.getItem("role");
    // Zkontroluje, zda uživatel NENÍ admin.
    if (userRole !== 'admin') {
        // Pokud není admin, zobrazí upozornění a přesměruje ho pryč.
        alert("Přístup odepřen.");
        window.location.href = "forum.html";
        return;
    }
    // Pokud je uživatel admin, načte seznam uživatelů.
    await loadUsers();
});

/**
 * Načte seznam všech uživatelů z API a vykreslí je do tabulky.
 */
async function loadUsers() {
    try {
        // Získání dat o uživatelích z API.
        const users = await apiRequest("/admin/users");
        const tbody = document.querySelector("#users-table tbody");
        // Vyprázdnění těla tabulky před novým vykreslením.
        tbody.innerHTML = "";
        // Pro každého uživatele vytvoří řádek v tabulce.
        users.forEach(user => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${user.id}</td>
                <td>${user.full_name}</td>
                <td>${user.username}</td>
                <td>
                    <!-- Select box pro změnu role. Aktuální role je předvybrána. -->
                    <select data-user-id="${user.id}" class="form-select form-select-sm">
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>Uživatel</option>
                        <option value="politician" ${user.role === 'politician' ? 'selected' : ''}>Politik</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <!-- Tlačítko pro uložení změny role. Volá funkci updateRole s ID uživatele. -->
                <td><button class="btn btn-sm btn-primary" onclick="updateRole(${user.id})">Uložit</button></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        // Zobrazení chyby, pokud se nepodaří načíst uživatele.
        alert(`Chyba při načítání uživatelů: ${err.message}`);
    }
}

/**
 * Aktualizuje roli vybraného uživatele.
 * @param {number} userId - ID uživatele, jehož role se má změnit.
 */
async function updateRole(userId) {
    // Najde správný select box podle data atributu.
    const select = document.querySelector(`.role-select[data-user-id='${userId}']`);
    const newRole = select.value;
    // Odešle požadavek na API pro aktualizaci role.
    await apiRequest(`/admin/users/${userId}/role`, "PUT", { role: newRole });
    alert("Role uživatele byla aktualizována.");
}