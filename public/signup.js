
/* =========================================================
   SHREKBOOK SIGNUP
========================================================= */

"use strict";


/* =========================================================
   ELEMENTS
========================================================= */

const signupForm =
    document.getElementById(
        "signup-form"
    );

const signupButton =
    document.getElementById(
        "signup-button"
    );

const signupMessage =
    document.getElementById(
        "signup-message"
    );

const usernameInput =
    document.getElementById(
        "username"
    );

const displayNameInput =
    document.getElementById(
        "display_name"
    );

const emailInput =
    document.getElementById(
        "email"
    );

const passwordInput =
    document.getElementById(
        "password"
    );

const confirmPasswordInput =
    document.getElementById(
        "confirm-password"
    );


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
    message,
    type = "error"
) {

    if (!signupMessage) {
        return;
    }


    signupMessage.textContent =
        message;


    if (type === "success") {

        signupMessage.style.color =
            "var(--green-light)";

    } else {

        signupMessage.style.color =
            "var(--danger)";

    }

}


/* =========================================================
   BUTTON STATE
========================================================= */

function setLoading(
    loading
) {

    if (!signupButton) {
        return;
    }


    signupButton.disabled =
        loading;


    if (loading) {

        signupButton.textContent =
            "🧌 Creating account...";

        signupButton.style.opacity =
            "0.7";

    } else {

        signupButton.textContent =
            "🧌 Create Account";

        signupButton.style.opacity =
            "1";

    }

}


/* =========================================================
   SIGNUP
========================================================= */

async function signup(
    event
) {

    event.preventDefault();


    showMessage("");


    const username =
        usernameInput.value.trim();


    const displayName =
        displayNameInput.value.trim();


    const email =
        emailInput.value.trim();


    const password =
        passwordInput.value;


    const confirmPassword =
        confirmPasswordInput.value;


    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!username) {

        showMessage(
            "Please choose a username."
        );

        usernameInput.focus();

        return;

    }


    if (username.length < 3) {

        showMessage(
            "Your username must be at least 3 characters."
        );

        usernameInput.focus();

        return;

    }


    if (username.length > 30) {

        showMessage(
            "Your username is too long."
        );

        usernameInput.focus();

        return;

    }


    /*
     * Keep usernames compatible
     * with the profile system.
     */

    if (
        !/^[a-zA-Z0-9_]+$/.test(
            username
        )
    ) {

        showMessage(
            "Username can only contain letters, numbers, and underscores."
        );

        usernameInput.focus();

        return;

    }


    if (!email) {

        showMessage(
            "Please enter your email."
        );

        emailInput.focus();

        return;

    }


    if (!password) {

        showMessage(
            "Please create a password."
        );

        passwordInput.focus();

        return;

    }


    if (password.length < 6) {

        showMessage(
            "Your password must be at least 6 characters."
        );

        passwordInput.focus();

        return;

    }


    if (
        password !==
        confirmPassword
    ) {

        showMessage(
            "The passwords don't match."
        );

        confirmPasswordInput.focus();

        return;

    }


    /* =====================================================
       SEND REQUEST
    ===================================================== */

    setLoading(true);


    try {

        console.log(
            "🧌 SIGNUP REQUEST"
        );


        const response =
            await fetch(
                "/api/signup",
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

                            display_name:
                                displayName ||
                                username,

                            email:
                                email,

                            password:
                                password

                        })

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
                "SIGNUP INVALID RESPONSE:",
                text
            );

            throw new Error(
                "The server returned an invalid response."
            );

        }


        console.log(
            "SIGNUP RESPONSE:",
            data
        );


        /* =================================================
           SERVER ERROR
        ================================================= */

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not create your account."
            );

        }


        /* =================================================
           SUCCESS
        ================================================= */

        if (
            !data.success
        ) {

            throw new Error(
                data.error ||
                "Account creation failed."
            );

        }


        showMessage(
            "🎉 Account created! Entering the swamp...",
            "success"
        );


        /*
         * Your signup route creates the
         * Supabase account and profile.
         *
         * We then log the user in so the
         * Express session actually exists.
         */

        try {

            const loginResponse =
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

                                email:
                                    email,

                                password:
                                    password

                            })

                    }
                );


            const loginText =
                await loginResponse.text();


            let loginData = {};


            try {

                loginData =
                    loginText
                        ? JSON.parse(
                            loginText
                        )
                        : {};

            } catch {

                console.error(
                    "AUTO LOGIN INVALID RESPONSE:",
                    loginText
                );

            }


            if (
                !loginResponse.ok ||
                !loginData.success
            ) {

                console.warn(
                    "Account created, but automatic login failed:",
                    loginData
                );


                /*
                 * Account exists, so send them
                 * to login instead of trapping
                 * them on signup.
                 */

                setTimeout(
                    () => {

                        window.location.href =
                            "/login.html";

                    },
                    1000
                );

                return;

            }


            console.log(
                "✅ AUTOMATIC LOGIN SUCCESS"
            );


            /*
             * Give the browser a moment to
             * receive/set the session cookie.
             */

            setTimeout(
                () => {

                    window.location.replace(
                        "/"
                    );

                },
                300
            );


        } catch (loginError) {

            console.error(
                "AUTO LOGIN ERROR:",
                loginError
            );


            /*
             * The account was still created.
             * Send the user to login.
             */

            setTimeout(
                () => {

                    window.location.href =
                        "/login.html";

                },
                1000
            );

        }


    } catch (error) {

        console.error(
            "❌ SIGNUP ERROR:",
            error
        );


        showMessage(
            error.message ||
            "Something went wrong while creating your account."
        );


        setLoading(false);

    }

}


/* =========================================================
   FORM EVENT
========================================================= */

if (signupForm) {

    signupForm.addEventListener(
        "submit",
        signup
    );

}


/* =========================================================
   ENTER KEY
========================================================= */

[
    usernameInput,
    displayNameInput,
    emailInput,
    passwordInput,
    confirmPasswordInput
]
.forEach(
    input => {

        if (!input) {
            return;
        }


        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    /*
                     * Let the form's normal
                     * submit event handle it.
                     */

                    if (
                        input !==
                        confirmPasswordInput
                    ) {

                        event.preventDefault();

                        const inputs = [
                            usernameInput,
                            displayNameInput,
                            emailInput,
                            passwordInput,
                            confirmPasswordInput
                        ];

                        const index =
                            inputs.indexOf(
                                input
                            );

                        const next =
                            inputs[index + 1];

                        if (next) {
                            next.focus();
                        }

                    }

                }

            }
        );

    }
);


/* =========================================================
   STARTUP
========================================================= */

console.log(
    "🧌 ShrekBook signup.js loaded"
);
