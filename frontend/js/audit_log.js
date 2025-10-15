let currentPage = 1;
let totalPages = 1;

/**
 * Spustí se po úplném načtení DOM struktury stránky.
 */
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

    // Přidání posluchačů na tlačítka pro stránkování
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            loadAuditLog(currentPage - 1);
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        if (currentPage < totalPages) {
            loadAuditLog(currentPage + 1);
        }
    });

    // Načtení první stránky logů
    await loadAuditLog(1);
});

/**
 * Načte a zobrazí auditní záznamy pro danou stránku.
 * @param {number} page - Číslo stránky k načtení.
 */
async function loadAuditLog(page) {
    try {
        // Získání dat z API endpointu s parametrem pro stránkování
        const data = await apiRequest(`/admin/audit-log?page=${page}`);
        const tbody = document.querySelector("#audit-log-table tbody");
        tbody.innerHTML = ""; // Vyprázdnění tabulky

        // Vykreslení každého záznamu do tabulky
        data.logs.forEach(log => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${log.id}</td>
                <td>${log.user_id || 'N/A'}</td>
                <td>${log.username || 'Anonymní'}</td>
                <td>${log.ip_address}</td>
                <td>${log.endpoint}</td>
                <td>${log.method}</td>
                <td>${new Date(log.created_at).toLocaleString()}</td>
            `;
            tbody.appendChild(tr);
        });

        // Aktualizace informací o stránkování
        currentPage = data.page;
        totalPages = Math.ceil(data.total_records / data.per_page);

        document.getElementById('page-info').textContent = `Stránka ${currentPage} z ${totalPages}`;

        // Povolení/zakázání tlačítek pro stránkování
        document.getElementById('prev-page').disabled = currentPage === 1;
        document.getElementById('next-page').disabled = currentPage === totalPages;

    } catch (err) {
        alert(`Chyba při načítání auditních záznamů: ${err.message}`);
    }
}