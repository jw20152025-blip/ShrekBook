
"use strict";

console.log("🔥 SHREKBOOK LOGIN.JS LOADED");


/* =========================================================
   ELEMENTS
========================================================= */

const form =
    document.getElementById(
        "login-form"
    );

const usernameInput =
    document.getElementById(
        "username"
    );

const passwordInput =
    document.getElementById(
        "password"
    );

const loginButton =
    document.getElementById(
        "login-button"
    );

const message =
    document.getElementById(
        "login-message"
    );


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
    text,
    success = false
) {

    if (!message) {

        alert(text);

        return;

    }


    message.textContent =
        text;


    message.style.display =
        "block";


    message.style.color =
        success
            ? "green"
            : "red";

}


/* =========================================================
   LOGIN
========================================================= */

async function login(
    event
) {

    if (event) {

        event.preventDefault();

    }


    console.log(
        "🔐 LOGIN FUNCTION CALLED"
    );


    const username =
        usernameInput
            ? usernameInput.value.trim()
            : "";

    const password =
        passwordInput
            ? passwordInput.value
            : "";


    console.log(
        "USERNAME:",
        username
    );


    if (!username) {

        showMessage(
            "Please enter your email or username."
        );

        return false;

    }


    if (!password) {

        showMessage(
            "Please enter your password."
        );

        return false;

    }


    if (loginButton) {

        loginButton.disabled =
            true;

        loginButton.textContent =
            "Logging in...";

    }


    showMessage(
        "Logging in...",
        true
    );


    try {

        console.log(
            "📡 Sending POST /api/login"
        );


        const response =
            await fetch(
                "/api/login",
                {

                    method:
                        "POST",

                    credentials:
                        "include",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            username:
                                username,

                            password:
                                password

                        })

                }
            );


        console.log(
            "📡 LOGIN STATUS:",
            response.status
        );


        const text =
            await response.text();


        console.log(
            "📡 LOGIN RAW RESPONSE:",
            text
        );


        let data;


        try {

            data =
                text
                    ? JSON.parse(text)
                    : {};

        } catch (error) {

            console.error(
                "❌ LOGIN RESPONSE WAS NOT JSON:",
                text
            );


            throw new Error(
                "The server returned an invalid login response."
            );

        }


        console.log(
            "📡 LOGIN DATA:",
            data
        );


        if (!response.ok) {

            throw new Error(
                data.error ||
                data.message ||
                `Login failed (${response.status})`
            );

        }


        /*
         * SUCCESS
         */

        console.log(
            "✅ LOGIN SUCCESS"
        );


        showMessage(
            "Login successful! Redirecting...",
            true
        );


        /*
         * Give the browser a moment to receive
         * the session cookie.
         */

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    300
                )
        );


        console.log(
            "🚀 REDIRECTING TO HOME"
        );


        /*
         * FORCE navigation.
         */

        window.location.href =
            "/";


        return true;

    } catch (error) {

        console.error(
            "❌ LOGIN ERROR:",
            error
        );


        showMessage(
            error.message ||
            "Login failed."
        );


        if (loginButton) {

            loginButton.disabled =
                false;

            loginButton.textContent =
                "Log In";

        }


        return false;

    }

}


/* =========================================================
   FORM SUBMIT
========================================================= */

if (form) {

    console.log(
        "✅ LOGIN FORM FOUND"
    );


    form.addEventListener(
        "submit",
        login
    );

} else {

    console.error(
        "❌ login-form NOT FOUND"
    );

}


/* =========================================================
   BUTTON BACKUP
========================================================= */

if (loginButton) {

    console.log(
        "✅ LOGIN BUTTON FOUND"
    );


    loginButton.addEventListener(
        "click",
        function(event) {

            /*
             * The form submit handler should normally
             * handle this, but this gives us another
             * direct path.
             */

            console.log(
                "🖱️ LOGIN BUTTON CLICKED"
            );

        }
    );

} else {

    console.error(
        "❌ login-button NOT FOUND"
    );

}


/* =========================================================
   GLOBAL LOGIN FUNCTION
========================================================= */

/*
 * THIS IS VERY IMPORTANT.
 *
 * If your old HTML has:
 *
 * onclick="login()"
 *
 * the browser can now find it.
 */

window.login =
    login;


/* =========================================================
   ALLOW ENTER KEY
========================================================= */

if (usernameInput) {

    usernameInput.addEventListener(
        "keydown",
        function(event) {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                login(event);

            }

        }
    );

}


if (passwordInput) {

    passwordInput.addEventListener(
        "keydown",
        function(event) {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                login(event);

            }

        }
    );

}


/* =========================================================
   FINAL CHECK
========================================================= */

console.log(
    "🧌 LOGIN SYSTEM READY"
);

console.log(
    "login function:",
    typeof window.login
);
