/* ==================================================
   SHREKBOOK SCRIPT
================================================== */


/* ==================================================
   GLOBAL HELPERS
================================================== */

async function fetchJSON(url, options = {}) {

    const response = await fetch(url, {
        credentials: "include",
        ...options
    });

    const text = await response.text();

    let data = {};

    try {
        data = text ? JSON.parse(text) : {};
    } catch (error) {
        console.error(
            "❌ INVALID JSON FROM SERVER:",
            text
        );

        throw new Error(
            "Server returned an invalid response."
        );
    }

    if (!response.ok) {

        throw new Error(
            data.error ||
            `Server error (${response.status})`
        );

    }

    return data;
}


/* ==================================================
   LOGIN
================================================== */

async function login() {

    console.log(
        "🔐 LOGIN BUTTON CLICKED"
    );


    const emailInput =
        document.getElementById(
            "login-email"
        );

    const passwordInput =
        document.getElementById(
            "login-password"
        );


    if (!emailInput || !passwordInput) {

        console.error(
            "❌ Login inputs not found."
        );

        alert(
            "Login form is broken: inputs not found."
        );

        return;

    }


    const email =
        emailInput.value.trim();

    const password =
        passwordInput.value;


    if (!email || !password) {

        alert(
            "Please enter your email and password."
        );

        return;

    }


    try {

        console.log(
            "📡 Sending login request..."
        );


        const data =
            await fetchJSON(
                "/api/login",
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"

                    },

                    credentials:
                        "include",

                    body:
                        JSON.stringify({

                            email:
                                email,

                            password:
                                password

                        })

                }
            );


        console.log(
            "✅ LOGIN RESPONSE:",
            data
        );


        if (!data.success) {

            throw new Error(
                data.error ||
                "Login failed."
            );

        }


        console.log(
            "✅ LOGIN SUCCESS"
        );


        /*
         * IMPORTANT:
         *
         * The backend has now created the
         * Express session.
         *
         * We check /api/me before redirecting.
         */

        console.log(
            "🔍 Checking session..."
        );


        try {

            const me =
                await fetchJSON(
                    "/api/me"
                );


            console.log(
                "👤 SESSION CHECK:",
                me
            );


            if (!me.loggedIn) {

                console.error(
                    "❌ Login succeeded, but session is not logged in."
                );

                alert(
                    "Login succeeded, but the session was not saved. Check the server session settings."
                );

                return;

            }

        } catch (sessionError) {

            console.error(
                "❌ SESSION CHECK FAILED:",
                sessionError
            );

            alert(
                "Login succeeded, but ShrekBook could not verify your session."
            );

            return;

        }


        console.log(
            "🚀 REDIRECTING TO HOMEPAGE..."
        );


        /*
         * Small delay makes the redirect much
         * more reliable when the session cookie
         * has just been created.
         */

        setTimeout(
            () => {

                window.location.href =
                    "/";

            },
            100
        );


    } catch (error) {

        console.error(
            "❌ LOGIN ERROR:",
            error
        );


        alert(
            "❌ " +
            (
                error.message ||
                "Could not log in."
            )
        );

    }

}


/* ==================================================
   LOGOUT
================================================== */

async function logout() {

    console.log(
        "🚪 LOGGING OUT..."
    );


    try {

        const data =
            await fetchJSON(
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


        console.log(
            "✅ LOGOUT RESPONSE:",
            data
        );


        window.location.href =
            "/";


    } catch (error) {

        console.error(
            "❌ LOGOUT ERROR:",
            error
        );


        alert(
            "❌ " +
            (
                error.message ||
                "Logout failed."
            )
        );

    }

}


/* ==================================================
   CHECK CURRENT USER
================================================== */

async function checkLogin() {

    console.log(
        "🔍 Checking login status..."
    );


    try {

        const data =
            await fetchJSON(
                "/api/me"
            );


        console.log(
            "👤 CURRENT USER:",
            data
        );


        if (
            data.loggedIn &&
            data.user
        ) {

            console.log(
                "✅ User is logged in:",
                data.user.username
            );


            return data.user;

        }


        console.log(
            "ℹ️ No user is logged in."
        );


        return null;


    } catch (error) {

        console.error(
            "❌ LOGIN STATUS ERROR:",
            error
        );


        return null;

    }

}


/* ==================================================
   LOAD PEOPLE
================================================== */

async function loadPeople() {

    console.log(
        "👥 Loading people..."
    );


    try {

        const data =
            await fetchJSON(
                "/api/users"
            );


        console.log(
            "👥 USERS RESPONSE:",
            data
        );


        const users =
            Array.isArray(data)
                ? data
                : data.users;


        if (!Array.isArray(users)) {

            throw new Error(
                "Invalid users response."
            );

        }


        const peopleContainer =
            document.getElementById(
                "people"
            );


        if (!peopleContainer) {

            console.log(
                "ℹ️ People container not found."
            );

            return;

        }


        peopleContainer.innerHTML =
            "";


        users.forEach(
            user => {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "person-card";


                const avatar =
                    user.avatar ||
                    "/default-avatar.png";


                const displayName =
                    user.display_name ||
                    user.username ||
                    "User";


                const username =
                    user.username ||
                    "user";


                card.innerHTML = `
                    <img
                        src="${escapeHtml(avatar)}"
                        class="person-avatar"
                        onerror="this.src='/default-avatar.png'"
                    >

                    <div class="person-info">

                        <strong>
                            ${escapeHtml(displayName)}
                        </strong>

                        <span>
                            @${escapeHtml(username)}
                        </span>

                    </div>
                `;


                card.addEventListener(
                    "click",
                    () => {

                        if (!user.id) {
                            return;
                        }


                        window.location.href =
                            `/profile.html?id=${encodeURIComponent(
                                user.id
                            )}`;

                    }
                );


                peopleContainer.appendChild(
                    card
                );

            }
        );


    } catch (error) {

        console.error(
            "❌ PEOPLE ERROR:",
            error
        );

    }

}


/* ==================================================
   ESCAPE HTML
================================================== */

function escapeHtml(text) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        text ?? "";


    return div.innerHTML;

}


/* ==================================================
   PAGE STARTUP
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "🧌 ShrekBook script.js loaded"
        );


        /*
         * Don't automatically redirect here.
         *
         * We let the login() function handle
         * the login redirect.
         */


        const user =
            await checkLogin();


        if (user) {

            console.log(
                "🟢 Logged in as:",
                user.username
            );

        }


        /*
         * Load the People section if it
         * exists on this page.
         */

        if (
            document.getElementById(
                "people"
            )
        ) {

            loadPeople();

        }

    }
);