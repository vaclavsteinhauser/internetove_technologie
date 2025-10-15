document.getElementById("forgotPasswordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const messageContainer = document.getElementById("message-container");

    try {
        const data = await apiRequest("/auth/forgot-password", "POST", { email }, false);
        messageContainer.style.color = "green";
        messageContainer.innerText = data.message;
    } catch (err) {
        messageContainer.style.color = "red";
        messageContainer.innerText = `Chyba: ${err.message}`;
    }
});