// ==========================================
// REGISTRATION
// ==========================================

document.getElementById("registerForm")?.addEventListener("submit", async function(event) {

    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const aadhar = document.getElementById("aadhar").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (phone.length !== 10) {
        alert("Please enter a valid 10-digit phone number.");
        return;
    }

    if (aadhar.length !== 12) {
        alert("Please enter a valid 12-digit Aadhaar number.");
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match.");
        return;
    }

    try {

        const response = await fetch("http://localhost:5000/api/register", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                name: name,
                phone: phone,
                aadhar: aadhar,
                password: password
            })
        });

        const data = await response.json();

        if (response.ok) {

            alert(data.message);

            window.location.href = "login.html";

        } else {

            alert(data.message);
        }

    } catch (error) {

        console.error(error);

        alert("Unable to connect to the server.");
    }
});


// ==========================================
// LOGIN
// ==========================================

document.getElementById("loginForm")?.addEventListener("submit", async function(event) {

    event.preventDefault();

    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;

    if (phone.length !== 10) {
        alert("Please enter a valid 10-digit phone number.");
        return;
    }

    if (password === "") {
        alert("Please enter your password.");
        return;
    }

    try {

        const response = await fetch("http://localhost:5000/api/login", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                phone: phone,
                password: password
            })
        });

        const data = await response.json();

        if (response.ok) {

            alert("Login successful! Welcome " + data.user.name);

            sessionStorage.setItem("userId", data.user.id);
            sessionStorage.setItem("userName", data.user.name);
            sessionStorage.setItem("userPhone", data.user.phone);

            window.location.href = "index.html";

        } else {

            alert(data.message);
        }

    } catch (error) {

        console.error(error);

        alert("Unable to connect to the server.");
    }
});