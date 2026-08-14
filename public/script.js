/* ==================================================
   SHREKBOOK SHARED CLIENT
================================================== */


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

                credentials:
                    "include",

                ...options,

                headers: {

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json",

                    ...(options.headers || {})

                }

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

    }

    catch {

        throw new Error(
            "Server returned an invalid response."
        );

    }


    if (!response.ok) {

        throw new Error(
            data.error ||
            `Server error (${response.status}).`
        );

    }


    return data;

}


/* ==================================================
   LOGIN
================================================== */

async function login() {

    console.log("🔐 LOGIN BUTTON PRESSED");


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
            "Sending POST /api/login"
        );


        const data =
            await fetchJSON(
                "/api/login",
                {

                    method:
                        "POST",

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
         * THE IMPORTANT PART
         *
         * Login is DONE.
         * Now go to index.html.
         */

        window.location.replace("/");

    }

    catch (error) {

        console.error(
            "❌ LOGIN ERROR:",
            error
        );


        alert(
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
            "/login.html"
        );

    }

    catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );

        alert(
            error.message
        );

    }

}


/* ==================================================
   LOGIN PAGE
================================================== */

async function checkLoginPage() {

    try {

        const data =
            await fetchJSON(
                "/api/me"
            );


        if (data.loggedIn) {

            console.log(
                "Already logged in."
            );

            window.location.replace(
                "/"
            );

        }

    }

    catch (error) {

        console.error(
            "LOGIN CHECK ERROR:",
            error
        );

    }

}


/* ==================================================
   START LOGIN PAGE
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        if (
            document.getElementById(
                "login-form"
            )
        ) {

            checkLoginPage();

        }

    }
);