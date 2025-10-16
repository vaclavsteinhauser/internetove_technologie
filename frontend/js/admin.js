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
        const approvalContainer = document.getElementById('approval-queue-container');
        const passwordPolicy = await apiRequest("/admin/settings/password_policy");

        document.getElementById('requireApprovalSwitch').checked = settings.require_registration_approval;

        document.getElementById('passwordMinLength').value = passwordPolicy.min_length;
        document.getElementById('passwordRequireUppercase').checked = passwordPolicy.require_uppercase;
        document.getElementById('passwordRequireNumber').checked = passwordPolicy.require_number;
        document.getElementById('passwordRequireSpecial').checked = passwordPolicy.require_special;
    } catch (err) {
        // Zde je třeba ošetřit chybu, pokud se nepodaří načíst nastavení
        const approvalContainer = document.getElementById('approval-queue-container');
        if(approvalContainer) {
            approvalContainer.innerHTML = `<div class="alert alert-danger">Chyba při načítání nastavení.</div>`;
            approvalContainer.style.display = 'block';
        }
        console.error("Chyba při načítání globálních nastavení:", err);
    }
}

/**
 * Uloží aktuální stav přepínače pro schvalování registrací.
 */
async function handleSaveSettings() {
    const requireApprovalSwitch = document.getElementById('requireApprovalSwitch');
    const isDisablingApproval = requireApprovalSwitch.checked === false && (await apiRequest("/admin/settings/registration_approval")).require_registration_approval === true;

    if (isDisablingApproval) {
        if (!confirm("Opravdu chcete vypnout vyžadování schválení? Všichni čekající uživatelé budou automaticky schváleni.")) {
            return; // Uživatel zrušil akci
        }
    }
    const approvalValue = requireApprovalSwitch.checked;
    const passwordPolicy = {
        min_length: parseInt(document.getElementById('passwordMinLength').value, 10),
        require_uppercase: document.getElementById('passwordRequireUppercase').checked,
        require_number: document.getElementById('passwordRequireNumber').checked,
        require_special: document.getElementById('passwordRequireSpecial').checked
    };

    try {
        // Uložení obou nastavení paralelně
        await Promise.all([
            apiRequest("/admin/settings/registration_approval", "PUT", { require_registration_approval: approvalValue }),
            apiRequest("/admin/settings/password_policy", "PUT", passwordPolicy)
        ]);

        alert("Nastavení bylo úspěšně uloženo.");
        // Znovu načteme vše, aby se projevil nový stav (např. zmizení fronty ke schválení)
        await loadGlobalSettings();
        await loadUsers();
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
        const allUsers = await apiRequest("/admin/users");
        const currentUserId = parseInt(localStorage.getItem("user_id"), 10);

        // Rozdělení uživatelů
        const approvedUsers = allUsers.filter(u => u.is_approved);
        const pendingUsers = allUsers.filter(u => !u.is_approved);

        // Vykreslení hlavní tabulky
        const mainTbody = document.querySelector("#users-table tbody");
        // Vyprázdnění těla tabulky před novým vykreslením.
        mainTbody.innerHTML = "";
        // Pro každého uživatele vytvoří řádek v tabulce.
        approvedUsers.forEach(user => {
            const isCurrentUser = user.id === currentUserId;

            // Vytvoření HTML pro statusové odznaky
            // Odznak "Čeká na schválení" zde již není potřeba, protože tito uživatelé jsou schválení
            const statusBadges = `
                ${user.is_blocked ? '<span class="badge bg-danger">Blokován</span>' : ''}
            `;

            // Vytvoření HTML pro tlačítka akcí
            // Tlačítka pro změnu role, blokování a smazání jsou pro aktuálního uživatele deaktivována/skryta.
            const actionButtons = `
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-primary" onclick="updateRole(${user.id})" ${isCurrentUser ? 'disabled' : ''}>Uložit roli</button>
                    <button class="btn ${user.is_blocked ? 'btn-success' : 'btn-warning'}" onclick="toggleBlock(${user.id})" ${isCurrentUser ? 'disabled' : ''}>
                        ${user.is_blocked ? 'Odblokovat' : 'Blokovat'}
                    </button>
                    ${!isCurrentUser ? `
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
                    <select data-user-id="${user.id}" class="form-select form-select-sm role-select" ${isCurrentUser ? 'disabled' : ''}>
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
            mainTbody.appendChild(tr);
        });

        // Vykreslení tabulky pro schválení
        const approvalTbody = document.querySelector("#approval-queue-table tbody");
        const approvalContainer = document.getElementById('approval-queue-container');
        approvalTbody.innerHTML = "";

        if (pendingUsers.length > 0) {
            approvalContainer.style.display = 'block';
            pendingUsers.forEach(user => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${user.id}</td>
                    <td>${user.full_name}</td>
                    <td>${user.username}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-success" onclick="approveUser(${user.id})">Schválit</button>
                            <button class="btn btn-danger" onclick="deleteUser(${user.id})">Smazat</button>
                        </div>
                    </td>
                `;
                approvalTbody.appendChild(tr);
            });
        } else {
            approvalContainer.style.display = 'none';
        }


        // Přidání posluchače na tlačítko pro uložení nastavení (musí být zde, aby se obnovil po překreslení)
        const saveBtn = document.getElementById('saveSettingsBtn');
        saveBtn.removeEventListener('click', handleSaveSettings); // Odstraníme starý, abychom předešli duplikaci
        saveBtn.addEventListener('click', handleSaveSettings);
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