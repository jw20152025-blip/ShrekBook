/* ==================================================
   SHREKBOOK FRONTEND
================================================== */


/* ==================================================
   HELPER
================================================== */

async function fetchJSON(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {
                credentials:
                    "include",

                ...options,

                headers: {

                    "Accept":
                        "application/json",

                    ...(options.headers || {})

                }

            }
        );


    const text =
        await response.text();


    let data;


    try {

        data =
            text
                ? JSON.parse(text)
                : {};

    } catch {

        console.error(
            "INVALID SERVER RESPONSE:",
            text
        );

        throw new Error(
            "Server returned invalid JSON."
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


    const emailElement =
        document.getElementById(
            "login-email"
        );


    const passwordElement =
        document.getElementById(
            "login-password"
        );


    if (
        !emailElement ||
        !passwordElement
    ) {

        console.error(
            "❌ Login fields not found."
        );

        alert(
            "Login form is missing."
        );

        return;

    }


    const email =
        emailElement.value.trim();


    const password =
        passwordElement.value;


    if (
        !email ||
        !password
    ) {

        alert(
            "Please enter your email and password."
        );

        return;

    }


    try {

        console.log(
            "📡 POST /api/login"
        );


        const data =
            await fetchJSON(
                "/api/login",
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            email,

                            password

                        })

                }
            );


        console.log(
            "✅ LOGIN SUCCESS:",
            data
        );


        /*
         * Confirm the server actually sees
         * us as logged in before redirecting.
         */

        const me =
            await fetchJSON(
                "/api/me"
            );


        console.log(
            "SESSION CHECK:",
            me
        );


        if (
            !me.loggedIn
        ) {

            throw new Error(
                "Login succeeded, but the session was not saved."
            );

        }


        /*
         * 🎉 FINALLY REDIRECT
         */

        window.location.replace(
            "/"
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
                "Login failed."
            )
        );

    }

}


/* ==================================================
   SIGNUP
================================================== */

async function signup() {

    const username =
        document
            .getElementById(
                "signup-username"
            )
            ?.value
            .trim();


    const displayName =
        document
            .getElementById(
                "signup-display-name"
            )
            ?.value
            .trim();


    const email =
        document
            .getElementById(
                "signup-email"
            )
            ?.value
            .trim();


    const password =
        document
            .getElementById(
                "signup-password"
            )
            ?.value;


    if (
        !username ||
        !email ||
        !password
    ) {

        alert(
            "Please fill out all required fields."
        );

        return;

    }


    try {

        const data =
            await fetchJSON(
                "/api/signup",
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            username,

                            display_name:
                                displayName,

                            email,

                            password

                        })

                }
            );


        console.log(
            "✅ SIGNUP SUCCESS:",
            data
        );


        alert(
            "✅ Account created! You can now log in."
        );


    } catch (error) {

        console.error(
            "SIGNUP ERROR:",
            error
        );


        alert(
            "❌ " +
            error.message
        );

    }

}


/* ==================================================
   LOGOUT
================================================== */

async function logout() {

    try {

        await fetchJSON(
            "/api/logout",
            {

                method:
                    "POST"

            }
        );


        window.location.replace(
            "/"
        );


    } catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );

        alert(
            "❌ Logout failed."
        );

    }

}


/* ==================================================
   LOAD CURRENT USER
================================================== */

async function loadCurrentUser() {

    try {

        const data =
            await fetchJSON(
                "/api/me"
            );


        console.log(
            "CURRENT USER:",
            data
        );


        const loginSection =
            document.getElementById(
                "login-section"
            );


        const accountSection =
            document.getElementById(
                "account-section"
            );


        if (
            data.loggedIn
        ) {

            if (loginSection) {

                loginSection.style.display =
                    "none";

            }


            if (accountSection) {

                accountSection.style.display =
                    "block";

            }


            const accountName =
                document.getElementById(
                    "account-name"
                );


            if (accountName) {

                accountName.textContent =
                    data.user.display_name ||
                    data.user.username ||
                    "User";

            }

        } else {

            if (loginSection) {

                loginSection.style.display =
                    "block";

            }


            if (accountSection) {

                accountSection.style.display =
                    "none";

            }

        }

    } catch (error) {

        console.error(
            "ME ERROR:",
            error
        );

    }

}


/* ==================================================
   LOAD PEOPLE
================================================== */

async function loadPeople() {

    const container =
        document.getElementById(
            "people"
        );


    if (!container) {
        return;
    }


    try {

        const data =
            await fetchJSON(
                "/api/users"
            );


        if (
            !Array.isArray(
                data.users
            )
        ) {

            throw new Error(
                "Invalid users response."
            );

        }


        container.innerHTML =
            "";


        if (
            data.users.length === 0
        ) {

            container.innerHTML =
                "<p>No users yet.</p>";

            return;

        }


        for (
            const user of data.users
        ) {

            const person =
                document.createElement(
                    "div"
                );


            person.className =
                "person";


            const name =
                user.display_name ||
                user.username ||
                "User";


            person.innerHTML = `

                <a href="/profile.html?id=${encodeURIComponent(user.id)}">

                    <strong>
                        ${escapeHtml(name)}
                    </strong>

                </a>

                <p>
                    @${escapeHtml(
                        user.username || ""
                    )}
                </p>

            `;


            container.appendChild(
                person
            );

        }

    } catch (error) {

        console.error(
            "PEOPLE ERROR:",
            error
        );


        container.innerHTML =
            `
            <p>
                ❌ ${escapeHtml(
                    error.message
                )}
            </p>
            `;

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
   GLOBAL FUNCTIONS
================================================== */

/*
 * Your HTML uses onclick="login()",
 * so explicitly expose the functions.
 */

window.login =
    login;

window.signup =
    signup;

window.logout =
    logout;


/* ==================================================
   START
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "🧌 ShrekBook script.js loaded"
        );


        loadCurrentUser();

        loadPeople();

    }
);