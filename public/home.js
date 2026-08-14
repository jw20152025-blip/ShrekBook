/* ==================================================
   SHREKBOOK HOME
================================================== */

let currentUser = null;


/* ==================================================
   GET CURRENT USER
================================================== */

async function loadCurrentUser() {

    try {

        console.log(
            "🏠 Checking current session..."
        );


        const response =
            await fetch(
                "/api/me",
                {

                    method:
                        "GET",

                    headers: {

                        "Accept":
                            "application/json"

                    },

                    credentials:
                        "include"

                }
            );


        const text =
            await response.text();


        let data;


        try {

            data =
                JSON.parse(text);

        } catch {

            console.error(
                "❌ /api/me returned:",
                text
            );

            throw new Error(
                "Invalid server response."
            );

        }


        console.log(
            "🏠 SESSION:",
            data
        );


        if (
            !response.ok ||
            !data.loggedIn
        ) {

            console.log(
                "❌ No active session."
            );

            window.location.replace(
                "/login.html"
            );

            return null;

        }


        currentUser =
            data.user;


        console.log(
            "✅ Logged in:",
            currentUser
        );


        updateHomeUser(
            currentUser
        );


        return currentUser;


    } catch (error) {

        console.error(
            "❌ HOME SESSION ERROR:",
            error
        );

        window.location.replace(
            "/login.html"
        );

        return null;

    }

}


/* ==================================================
   UPDATE HOME UI
================================================== */

function updateHomeUser(user) {

    if (!user) {
        return;
    }


    const name =
        document.getElementById(
            "home-display-name"
        );


    if (name) {

        name.textContent =
            user.display_name ||
            user.username ||
            "User";

    }


    const username =
        document.getElementById(
            "home-username"
        );


    if (username) {

        username.textContent =
            "@" +
            (
                user.username ||
                "user"
            );

    }


    const avatar =
        document.getElementById(
            "home-avatar"
        );


    if (avatar) {

        avatar.src =
            user.avatar ||
            "/default-avatar.png";

    }

}


/* ==================================================
   LOGOUT
================================================== */

async function logout() {

    try {

        console.log(
            "🚪 Logging out..."
        );


        const response =
            await fetch(
                "/api/logout",
                {

                    method:
                        "POST",

                    headers: {

                        "Accept":
                            "application/json"

                    },

                    credentials:
                        "include"

                }
            );


        const data =
            await response.json();


        console.log(
            "LOGOUT:",
            data
        );


    } catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );

    }


    window.location.replace(
        "/login.html"
    );

}


/* ==================================================
   START
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "🧌 ShrekBook home.js loaded"
        );

        loadCurrentUser();

    }
);