/* ==================================================
   SHREKBOOK MAIN SCRIPT
================================================== */

"use strict";

/* ==================================================
   API HELPER
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

                ...options,

                headers: {
                    "Content-Type":
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
   ESCAPE HTML
================================================== */

function escapeHtml(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text ?? "";

    return div.innerHTML;

}

/* ==================================================
   LOGIN
================================================== */

let loginInProgress = false;

async function login() {

    if (loginInProgress) {
        return;
    }

    loginInProgress = true;

    console.log(
        "🔐 LOGIN START"
    );

    const emailInput =
        document.getElementById(
            "login-email"
        );

    const passwordInput =
        document.getElementById(
            "login-password"
        );

    if (
        !emailInput ||
        !passwordInput
    ) {

        console.error(
            "Login inputs not found."
        );

        loginInProgress = false;

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

        loginInProgress = false;

        return;

    }

    const button =
        document.querySelector(
            "#login-button"
        );

    if (button) {
        button.disabled = true;
    }

    try {

        const data =
            await fetchJSON(
                "/api/login",
                {

                    method: "POST",

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

        if (!data.success) {

            throw new Error(
                "Login failed."
            );

        }

        /*
         * THIS IS THE REDIRECT.
         */

        window.location.replace("/");

    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );

        alert(
            "❌ " +
            error.message
        );

        loginInProgress = false;

        if (button) {
            button.disabled = false;
        }

    }

}

/* ==================================================
   SIGNUP
================================================== */

let signupInProgress = false;

async function signup() {

    if (signupInProgress) {
        return;
    }

    signupInProgress = true;

    const username =
        document.getElementById(
            "signup-username"
        );

    const displayName =
        document.getElementById(
            "signup-display-name"
        );

    const email =
        document.getElementById(
            "signup-email"
        );

    const password =
        document.getElementById(
            "signup-password"
        );

    if (
        !username ||
        !email ||
        !password
    ) {

        signupInProgress = false;

        return;

    }

    try {

        const data =
            await fetchJSON(
                "/api/signup",
                {

                    method: "POST",

                    body:
                        JSON.stringify({

                            username:
                                username.value,

                            display_name:
                                displayName
                                    ?.value ||
                                username.value,

                            email:
                                email.value,

                            password:
                                password.value

                        })

                }
            );

        alert(
            "✅ Account created! You can now log in."
        );

        window.location.href =
            "/login";

    } catch (error) {

        console.error(
            "SIGNUP ERROR:",
            error
        );

        alert(
            "❌ " +
            error.message
        );

    } finally {

        signupInProgress = false;

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

        window.location.href =
            "/login";

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
   CURRENT USER
================================================== */

async function getCurrentUser() {

    return await fetchJSON(
        "/api/me"
    );

}

/* ==================================================
   LOAD PEOPLE
================================================== */

async function loadPeople() {

    const container =
        document.getElementById(
            "people-list"
        );

    if (!container) {
        return;
    }

    try {

        const data =
            await fetchJSON(
                "/api/users"
            );

        const users =
            data.users || [];

        if (!users.length) {

            container.innerHTML =
                "<p>No users yet.</p>";

            return;

        }

        container.innerHTML =
            users.map(
                user => `

                <div class="person-card">

                    <img
                        src="${
                            escapeHtml(
                                user.avatar ||
                                "/default-avatar.png"
                            )
                        }"
                        class="person-avatar"
                        onerror="this.src='/default-avatar.png'"
                    >

                    <div>

                        <strong>
                            ${
                                escapeHtml(
                                    user.display_name ||
                                    user.username ||
                                    "User"
                                )
                            }
                        </strong>

                        <div>
                            @${escapeHtml(
                                user.username ||
                                "user"
                            )}
                        </div>

                    </div>

                    <button
                        onclick="openProfile('${user.id}')"
                    >
                        View
                    </button>

                </div>

            `
            ).join("");

    } catch (error) {

        console.error(
            "PEOPLE ERROR:",
            error
        );

        container.innerHTML =
            `<p>❌ ${
                escapeHtml(
                    error.message
                )
            }</p>`;

    }

}

/* ==================================================
   OPEN PROFILE
================================================== */

function openProfile(id) {

    window.location.href =
        `/profile?id=${encodeURIComponent(id)}`;

}

/* ==================================================
   LOAD FEED
================================================== */

async function loadFeed() {

    const container =
        document.getElementById(
            "feed"
        );

    if (!container) {
        return;
    }

    try {

        const data =
            await fetchJSON(
                "/api/posts"
            );

        const posts =
            data.posts || [];

        if (!posts.length) {

            container.innerHTML =
                "<p>No posts yet. Be the first! 🧌</p>";

            return;

        }

        container.innerHTML =
            posts.map(
                post => {

                    const user =
                        post.user || {};

                    return `

                    <article class="post">

                        <div class="post-author">

                            <img
                                src="${
                                    escapeHtml(
                                        user.avatar ||
                                        "/default-avatar.png"
                                    )
                                }"
                                onerror="this.src='/default-avatar.png'"
                            >

                            <div>

                                <strong>
                                    ${
                                        escapeHtml(
                                            user.display_name ||
                                            user.username ||
                                            "User"
                                        )
                                    }
                                </strong>

                                <small>
                                    @${escapeHtml(
                                        user.username ||
                                        "user"
                                    )}
                                </small>

                            </div>

                        </div>

                        <div class="post-content">

                            ${escapeHtml(
                                post.content
                            )}

                        </div>

                        <small>
                            ${
                                new Date(
                                    post.created_at
                                ).toLocaleString()
                            }
                        </small>

                    </article>

                    `;

                }
            ).join("");

    } catch (error) {

        console.error(
            "FEED ERROR:",
            error
        );

        container.innerHTML =
            `<p>❌ ${
                escapeHtml(
                    error.message
                )
            }</p>`;

    }

}

/* ==================================================
   CREATE POST
================================================== */

async function createPost() {

    const input =
        document.getElementById(
            "post-content"
        );

    if (!input) {
        return;
    }

    const content =
        input.value.trim();

    if (!content) {
        return;
    }

    try {

        await fetchJSON(
            "/api/posts",
            {

                method: "POST",

                body:
                    JSON.stringify({
                        content
                    })

            }
        );

        input.value = "";

        await loadFeed();

    } catch (error) {

        alert(
            "❌ " +
            error.message
        );

    }

}

/* ==================================================
   HOME INITIALIZATION
================================================== */

async function initHome() {

    console.log(
        "🏠 Initializing ShrekBook home"
    );

    try {

        const data =
            await getCurrentUser();

        if (!data.loggedIn) {

            window.location.replace(
                "/login"
            );

            return;

        }

        const name =
            document.getElementById(
                "current-user-name"
            );

        if (name) {

            name.textContent =
                data.user.display_name ||
                data.user.username;

        }

        const avatar =
            document.getElementById(
                "current-user-avatar"
            );

        if (avatar) {

            avatar.src =
                data.user.avatar ||
                "/default-avatar.png";

        }

        await Promise.all([

            loadPeople(),

            loadFeed()

        ]);

    } catch (error) {

        console.error(
            "HOME ERROR:",
            error
        );

    }

}

/* ==================================================
   LOGIN PAGE INITIALIZATION
================================================== */

async function initLoginPage() {

    try {

        const data =
            await getCurrentUser();

        if (data.loggedIn) {

            window.location.replace(
                "/"
            );

        }

    } catch (error) {

        console.error(
            "LOGIN CHECK ERROR:",
            error
        );

    }

}

/* ==================================================
   ENTER KEY
================================================== */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key !== "Enter"
        ) {
            return;
        }

        const active =
            document.activeElement;

        if (
            active &&
            (
                active.id ===
                    "login-email" ||
                active.id ===
                    "login-password"
            )
        ) {

            login();

        }

    }
);

/* ==================================================
   START
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "🧌 ShrekBook script loaded"
        );

        const path =
            window.location.pathname;

        if (
            path === "/login"
        ) {

            initLoginPage();

        } else {

            initHome();

        }

    }
);

/*
 * IMPORTANT:
 * Expose functions for inline HTML onclick.
 */

window.login =
    login;

window.signup =
    signup;

window.logout =
    logout;

window.createPost =
    createPost;

window.loadPeople =
    loadPeople;

window.loadFeed =
    loadFeed;

window.openProfile =
    openProfile;