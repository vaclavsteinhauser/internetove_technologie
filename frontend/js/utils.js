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

/**
 * Zkontroluje sílu hesla na základě dané politiky.
 * @param {string} password - Heslo ke kontrole.
 * @param {object} policy - Objekt s politikou hesel.
 */
function checkPasswordStrength(password, policy) {
    if (!policy || !password) {
        updateStrengthUI({ width: "0%", text: "", color: "bg-secondary" });
        return;
    }

    let score = 0;
    if (password.length >= policy.min_length) score++;
    if (policy.require_uppercase && /[A-Z]/.test(password)) score++;
    if (policy.require_number && /[0-9]/.test(password)) score++;
    if (policy.require_special && /[\W_]/.test(password)) score++;

    const strengthLevels = {
        0: { text: "Velmi slabé", color: "bg-danger", width: "25%" },
        1: { text: "Velmi slabé", color: "bg-danger", width: "25%" },
        2: { text: "Slabé", color: "bg-warning", width: "50%" },
        3: { text: "Střední", color: "bg-info", width: "75%" },
        4: { text: "Silné", color: "bg-success", width: "100%" },
    };

    updateStrengthUI(strengthLevels[score] || strengthLevels[0]);
}

function updateStrengthUI({ width, text, color }) {
    const strengthBar = document.getElementById('password-strength-bar');
    const strengthText = document.getElementById('password-strength-text');

    if (strengthBar) {
        strengthBar.style.width = width;
        strengthBar.className = 'progress-bar'; // Reset barev
        strengthBar.classList.add(color);
    }
    if (strengthText) {
        strengthText.textContent = text;
    }
}