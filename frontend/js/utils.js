/**
 * Načte a zobrazí aktuální politiku hesel v zadaném elementu.
 * @param {string} elementId - ID elementu, kam se mají pravidla vykreslit.
 * @returns {Promise<object|null>} - Promise, která se resolvuje s objektem politiky, nebo null při chybě.
 */
async function displayPasswordPolicy(elementId) {
    try {
        const policy = await apiRequest("/auth/password-policy", "GET", null, false);
        const rules = [];
        rules.push(`Minimální délka: ${policy.min_length} znaků.`);
        if (policy.require_uppercase) rules.push("Musí obsahovat velké písmeno.");
        if (policy.require_number) rules.push("Musí obsahovat číslici.");
        if (policy.require_special) rules.push("Musí obsahovat speciální znak.");

        const policyInfoElement = document.getElementById(elementId);
        if (policyInfoElement) {
            policyInfoElement.innerHTML = `<strong>Požadavky na heslo:</strong><br>${rules.join('<br>')}`;
        }
        return policy; // Vrátíme politiku pro další použití
    } catch (err) {
        console.error("Failed to load password policy:", err);
        return null;
    }
}