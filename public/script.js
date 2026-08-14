/* ==================================================
   SHREKBOOK CLIENT
================================================== */
console.log("🧌 SHREKBOOK SCRIPT.JS LOADED");

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

                    Accept:
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
            "NON JSON RESPONSE:",
            text
        );

        throw new Error(
            "Server returned invalid JSON."
        );

    }


    if (!response.ok) {

        throw new Error(

            data.error ||
            "Server error."

        );

    }


    return data;

}


/* ==================================================
   LOGIN
================================================== */

async function login() {

    try {

        const email =
            document
                .getElementById(
                    "login-email"
                )
                ?.value
                .trim() ||
            document
                .getElementById(
                    "email"
                )
                ?.value
                .trim() ||
            "";


        const password =
            document
                .getElementById(
                    "login-password"
                )
                ?.value ||
            document
                .getElementById(
                    "password"
                )
                ?.value ||
            "";


        if (
            !email ||
            !password
        ) {

            alert(
                "❌ Enter your email and password."
            );

            return;

        }


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

                            email:
                                email,

                            password:
                                password

                        })

                }
            );


        console.log(
            "✅ Logged in:",
            data.user
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

    try {

        const username =
            document
                .getElementById(
                    "signup-username"
                )
                ?.value
                .trim() ||
            document
                .getElementById(
                    "username"
                )
                ?.value
                .trim() ||
            "";


        const display_name =
            document
                .getElementById(
                    "signup-display-name"
                )
                ?.value
                .trim() ||
            username;


        const email =
            document
                .getElementById(
                    "signup-email"
                )
                ?.value
                .trim() ||
            document
                .getElementById(
                    "email"
                )
                ?.value
                .trim() ||
            "";


        const password =
            document
                .getElementById(
                    "signup-password"
                )
                ?.value ||
            document
                .getElementById(
                    "password"
                )
                ?.value ||
            "";


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

                            username:
                                username,

                            display_name:
                                display_name,

                            email:
                                email,

                            password:
                                password

                        })

                }
            );


        console.log(
            "✅ Account created:",
            data.user
        );


        alert(
            "✅ Account created!"
        );


        window.location.reload();


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


        window.location.reload();


    } catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );


        alert(
            "❌ " +
            error.message
        );

    }

}


/* ==================================================
   LOAD PEOPLE
================================================== */

async function loadPeople() {

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


        const container =
            document.getElementById(
                "people"
            ) ||
            document.getElementById(
                "people-list"
            ) ||
            document.getElementById(
                "users"
            );


        if (!container) {

            return;

        }


        container.innerHTML =
            "";


        for (
            const user
            of data.users
        ) {

            const item =
                document.createElement(
                    "div"
                );


            const name =
                user.display_name ||
                user.username ||
                "User";


            item.textContent =
                name;


            if (user.id) {

                item.style.cursor =
                    "pointer";


                item.addEventListener(
                    "click",
                    () => {

                        window.location.href =
                            "/profile.html?id=" +
                            encodeURIComponent(
                                user.id
                            );

                    }
                );

            }


            container.appendChild(
                item
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
   MAKE HTML onclick WORK
================================================== */

window.login =
    login;

window.signup =
    signup;

window.logout =
    logout;

window.loadPeople =
    loadPeople;


/* ==================================================
   START
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadPeople();

    }
);