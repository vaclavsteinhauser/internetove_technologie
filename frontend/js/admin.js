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
    await loadGlobalSettings();
    await loadUsers();

});

/**
 * Načte globální nastavení a nastaví přepínač.
 */
async function loadGlobalSettings() {
    try {
        const settings = await apiRequest("/admin/settings/registration_approval");
        document.getElementById('requireApprovalSwitch').checked = settings.require_registration_approval;
    } catch (err) {
        console.error("Chyba při načítání globálních nastavení:", err);
    }
}

/**
 * Uloží aktuální stav přepínače pro schvalování registrací.
 */
async function handleSaveSettings() {
    const newValue = document.getElementById('requireApprovalSwitch').checked;
    try {
        await apiRequest("/admin/settings/registration_approval", "PUT", { require_registration_approval: newValue });
        alert("Nastavení bylo úspěšně uloženo.");
        // Není potřeba nic znovu načítat, změna se projeví při příští registraci
    } catch (err) {
        alert(`Chyba při ukládání nastavení: ${err.message}`);
    }
}

/**
 * Načte seznam všech uživatelů z API a vykreslí je do tabulky.
 */
async function loadUsers() {
    try {
        // Získání dat o uživatelích z API.
        const users = await apiRequest("/admin/users");
        const currentUserId = parseInt(localStorage.getItem("user_id"), 10);
        const tbody = document.querySelector("#users-table tbody");
        // Vyprázdnění těla tabulky před novým vykreslením.
        tbody.innerHTML = "";
        // Pro každého uživatele vytvoří řádek v tabulce.
        users.forEach(user => {
            // Vytvoření HTML pro statusové odznaky
            const statusBadges = `
                ${user.is_blocked ? '<span class="badge bg-danger">Blokován</span>' : ''}
                ${!user.is_approved ? '<span class="badge bg-warning text-dark">Čeká na schválení</span>' : ''}
            `;

            // Vytvoření HTML pro tlačítka akcí
            // Tlačítko pro smazání se nezobrazí pro aktuálně přihlášeného admina
            const actionButtons = `
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-primary" onclick="updateRole(${user.id})">Uložit roli</button>
                    <button class="btn ${user.is_blocked ? 'btn-success' : 'btn-warning'}" onclick="toggleBlock(${user.id})">
                        ${user.is_blocked ? 'Odblokovat' : 'Blokovat'}
                    </button>
                    ${!user.is_approved ? `<button class="btn btn-info" onclick="approveUser(${user.id})">Schválit</button>` : ''}
                    ${user.id !== currentUserId ? `
                        <button class="btn btn-danger" onclick="deleteUser(${user.id})">Smazat</button>
                    ` : ''}
                </div>
            `;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${user.id}</td>
                <td>${user.full_name}</td>
                <td>${user.username}</td>
                <td>
                    <select data-user-id="${user.id}" class="form-select form-select-sm role-select">
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>Uživatel</option>
                        <option value="politician" ${user.role === 'politician' ? 'selected' : ''}>Politik</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td>
                    ${statusBadges}
                </td>
                <td>
                    ${actionButtons}
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Přidání posluchače na tlačítko pro uložení nastavení (musí být zde, aby se obnovil po překreslení)
        document.getElementById('saveSettingsBtn').addEventListener('click', handleSaveSettings);
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
    if (!select) {
        console.error("Select element not found for user", userId);
        return;
    }
    const newRole = select.value;
    try {
        // Odešle požadavek na API pro aktualizaci role.
        await apiRequest(`/admin/users/${userId}/role`, "PUT", { role: newRole });
        alert("Role uživatele byla aktualizována.");
        await loadUsers(); // Znovu načte uživatele pro aktualizaci zobrazení
    } catch (err) {
        alert(`Chyba při aktualizaci role: ${err.message}`);
    }
}

/**
 * Přepne stav blokace pro daného uživatele.
 * @param {number} userId - ID uživatele.
 */
async function toggleBlock(userId) {
    try {
        await apiRequest(`/admin/users/${userId}/block`, "PUT");
        await loadUsers();
    } catch (err) {
        alert(`Chyba při změně stavu blokace: ${err.message}`);
    }
}

/**
 * Schválí registraci uživatele.
 * @param {number} userId - ID uživatele.
 */
async function approveUser(userId) {
    await apiRequest(`/admin/users/${userId}/approve`, "PUT");
    alert("Uživatel byl schválen.");
    await loadUsers();
}

/**
 * Smaže uživatele po potvrzení.
 * @param {number} userId - ID uživatele ke smazání.
 */
async function deleteUser(userId) {
    if (confirm(`Opravdu si přejete trvale smazat uživatele s ID ${userId}? Tato akce je nevratná.`)) {
        try {
            await apiRequest(`/admin/users/${userId}`, "DELETE");
            await loadUsers();
        } catch (err) {
            alert(`Chyba při mazání uživatele: ${err.message}`);
        }
    }
}