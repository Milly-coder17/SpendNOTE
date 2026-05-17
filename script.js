const form = document.getElementById("loginForm");
const usernameBox = document.getElementById("usernameBox");
const passwordBox = document.getElementById("passwordBox");

const username = "admin";
const password = "123";

if (form) {
    form.addEventListener("submit", function (e) {
        e.preventDefault();

        if (usernameBox.value === username && passwordBox.value === password) {
            window.location.href = "home.html";
        } else {
            alert("Invalid username or password");
        }
    });
}