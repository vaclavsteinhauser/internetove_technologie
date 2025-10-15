document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("resetPasswordForm");
    const messageContainer = document.getElementById("message-container");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const newPassword = document.getElementById("new_password").value;
        const confirmPassword = document.getElementById("confirm_password").value;

        if (newPassword !== confirmPassword) {
            messageContainer.style.color = "red";
            messageContainer.innerText = "Hesla se neshodují!";
            return;
        }

        // Získání tokenu z URL
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");

        if (!token) {
            messageContainer.style.color = "red";
            messageContainer.innerText = "Chybí token pro obnovu hesla.";
            return;
        }

        try {
            const data = await apiRequest("/auth/reset-password", "POST", {
                token: token,
                new_password: newPassword
            }, false);

            messageContainer.style.color = "green";
            messageContainer.innerText = `${data.message} Budete přesměrováni na přihlášení...`;
            
            setTimeout(() => {
                window.location.href = "login.html";
            }, 3000);

        } catch (err) {
            messageContainer.style.color = "red";
            messageContainer.innerText = `Chyba: ${err.message}`;
        }
    });
});