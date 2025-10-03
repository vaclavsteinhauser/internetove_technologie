document.getElementById("changePasswordForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const old_password = document.getElementById("old_password").value;
    const new_password = document.getElementById("new_password").value;
    const confirm_password = document.getElementById("confirm_password").value;

    if (new_password !== confirm_password) {
        alert("Nová hesla se neshodují!");
        return;
    }

    try {
        const data = await apiRequest("/users/change_password", "PUT", {
            old_password: old_password,
            new_password: new_password
        });
        alert("Heslo bylo úspěšně změněno.");
        window.location.href = "forum.html";
    } catch (err) {
        alert(`Chyba při změně hesla: ${err.message}`);
    }
});