document.addEventListener("DOMContentLoaded", async () => {
    const userRole = localStorage.getItem("role");
    if (userRole !== 'admin') {
        alert("Přístup odepřen.");
        window.location.href = "forum.html";
        return;
    }
    await loadUsers();
});

async function loadUsers() {
    try {
        const users = await apiRequest("/admin/users");
        const tbody = document.querySelector("#users-table tbody");
        tbody.innerHTML = "";
        users.forEach(user => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${user.id}</td>
                <td>${user.full_name}</td>
                <td>${user.username}</td>
                <td>
                    <select data-user-id="${user.id}" class="role-select">
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>Uživatel</option>
                        <option value="politician" ${user.role === 'politician' ? 'selected' : ''}>Politik</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td><button class="btn-small" onclick="updateRole(${user.id})">Uložit</button></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        alert(`Chyba při načítání uživatelů: ${err.message}`);
    }
}

async function updateRole(userId) {
    const select = document.querySelector(`.role-select[data-user-id='${userId}']`);
    const newRole = select.value;
    await apiRequest(`/admin/users/${userId}/role`, "PUT", { role: newRole });
    alert("Role uživatele byla aktualizována.");
}