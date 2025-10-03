document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("token")) {
        window.location.href = "forum.html";
    }
});