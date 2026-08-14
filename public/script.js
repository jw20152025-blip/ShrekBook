console.log("🧌 SHREKBOOK SCRIPT.JS LOADED");


/* ==================================================
   FETCH JSON
================================================== */

async function fetchJSON(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {
                credentials: "include",
                ...options
            }
        );


    const text =
        await response.text();


    let data = {};


    try {

        data =
            text
                ? JSON.parse(text)
                : {};

    } catch {

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
        "🔥 LOGIN FUNCTION CALLED"
    );


    const email =
        document
            .getElementById(
                "login-email"
            )
            ?.value
            ?.trim();


    const password =
        document
            .getElementById(
                "login-password"
            )
            ?.value || "";


    console.log(
        "EMAIL:",
        email
    );

    console.log(
        "PASSWORD ENTERED:",
        password.length > 0
    );


    if (!email || !password) {

        alert(
            "Please enter your email and password."
        );

        return;

    }


    try {

        const data =
            await fetchJSON(
                "/api/login",
                {

                    method: "POST",

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


        alert(
            "✅ Logged in!"
        );


        window.location.reload();


    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );


        alert(
            "❌ " +
            error.message
        );

    }

}


/* ==================================================
   SIGNUP
================================================== */

async function signup() {

    console.log(
        "🔥 SIGNUP FUNCTION CALLED"
    );


    const username =
        document
            .getElementById(
                "signup-username"
            )
            ?.value
            ?.trim();


    const displayName =
        document
            .getElementById(
                "signup-display-name"
            )
            ?.value
            ?.trim();


    const email =
        document
            .getElementById(
                "signup-email"
            )
            ?.value
            ?.trim();


    const password =
        document
            .getElementById(
                "signup-password"
            )
            ?.value || "";


    try {

        const data =
            await fetchJSON(
                "/api/signup",
                {

                    method: "POST",

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
                method: "POST"
            }
        );


        window.location.reload();


    } catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );

    }

}


/* ==================================================
   CURRENT USER
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


        if (
            data.loggedIn
        ) {

            console.log(
                "🟢 Logged in as:",
                data.user.username
            );

        }


    } catch (error) {

        console.error(
            "ME ERROR:",
            error
        );

    }

}


/* ==================================================
   PEOPLE
================================================== */

async function loadPeople() {

    try {

        const data =
            await fetchJSON(
                "/api/users"
            );


        console.log(
            "PEOPLE:",
            data
        );


        const people =
            document.getElementById(
                "people"
            );


        if (!people) {
            return;
        }


        people.innerHTML = "";


        for (
            const user
            of data.users || []
        ) {

            const element =
                document.createElement(
                    "div"
                );


            element.innerHTML = `

                <a href="/profile.html?id=${encodeURIComponent(
                    user.id
                )}">

                    <strong>
                        ${
                            user.display_name ||
                            user.username ||
                            "User"
                        }
                    </strong>

                </a>

            `;


            people.appendChild(
                element
            );

        }


    } catch (error) {

        console.error(
            "PEOPLE ERROR:",
            error
        );

    }

}


/* ==================================================
   MAKE GLOBAL
================================================== */

window.login =
    login;

window.signup =
    signup;

window.logout =
    logout;

window.loadPeople =
    loadPeople;

window.loadCurrentUser =
    loadCurrentUser;


/* ==================================================
   START
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "🧌 ShrekBook DOM ready"
        );


        loadCurrentUser();

        loadPeople();

    }
);