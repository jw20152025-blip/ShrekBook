
// ==================================================
// SHREKBOOK FRONTEND
// public/script.js
// ==================================================

let currentUser = null;


// ==================================================
// API HELPER
// ==================================================

async function api(url, options = {}) {

    const response = await fetch(url, {
        credentials: "include",
        ...options,

        headers: {
            ...(options.body ? {
                "Content-Type": "application/json"
            } : {}),
            ...(options.headers || {})
        }
    });

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(
            data.error ||
            `Request failed (${response.status})`
        );
    }

    return data;
}


// ==================================================
// LOGIN
// ==================================================

async function login() {

    const email =
        document
            .getElementById("login-email")
            .value
            .trim();

    const password =
        document
            .getElementById("login-password")
            .value;

    const status =
        document.getElementById("login-status");


    if (!email || !password) {

        status.textContent =
            "Please enter your email and password.";

        return;

    }


    status.textContent =
        "Logging in...";


    try {

        const data =
            await api(
                "/api/login",
                {
                    method: "POST",

                    body: JSON.stringify({
                        email,
                        password
                    })
                }
            );


        if (!data.success) {

            throw new Error(
                data.error ||
                "Login failed."
            );

        }


        status.textContent =
            "Login successful!";


        await loadCurrentUser();


    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );

        status.textContent =
            error.message ||
            "Login failed.";

    }

}


// ==================================================
// SIGNUP
// ==================================================

async function signup() {

    const username =
        document
            .getElementById("signup-username")
            .value
            .trim();

    const displayName =
        document
            .getElementById("signup-display-name")
            .value
            .trim();

    const email =
        document
            .getElementById("signup-email")
            .value
            .trim();

    const password =
        document
            .getElementById("signup-password")
            .value;

    const status =
        document.getElementById(
            "signup-status"
        );


    if (
        !username ||
        !email ||
        !password
    ) {

        status.textContent =
            "Username, email, and password are required.";

        return;

    }


    status.textContent =
        "Creating account...";


    try {

        await api(
            "/api/signup",
            {
                method: "POST",

                body: JSON.stringify({

                    username,

                    display_name:
                        displayName ||
                        username,

                    email,

                    password

                })
            }
        );


        status.textContent =
            "Account created! Logging in...";


        await api(
            "/api/login",
            {
                method: "POST",

                body: JSON.stringify({
                    email,
                    password
                })
            }
        );


        await loadCurrentUser();


    } catch (error) {

        console.error(
            "SIGNUP ERROR:",
            error
        );

        status.textContent =
            error.message ||
            "Could not create account.";

    }

}


// ==================================================
// SHOW LOGIN
// ==================================================

function showLogin() {

    const loginBox =
        document.getElementById(
            "login-box"
        );

    const signupBox =
        document.getElementById(
            "signup-box"
        );


    if (loginBox)
        loginBox.style.display =
            "block";

    if (signupBox)
        signupBox.style.display =
            "none";

}


// ==================================================
// SHOW SIGNUP
// ==================================================

function showSignup() {

    const loginBox =
        document.getElementById(
            "login-box"
        );

    const signupBox =
        document.getElementById(
            "signup-box"
        );


    if (loginBox)
        loginBox.style.display =
            "none";

    if (signupBox)
        signupBox.style.display =
            "block";

}


// ==================================================
// LOGOUT
// ==================================================

async function logout() {

    try {

        await api(
            "/api/logout",
            {
                method: "POST"
            }
        );

    } catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );

    }


    currentUser = null;

    updateUI();

}


// ==================================================
// LOAD CURRENT USER
// ==================================================

async function loadCurrentUser() {

    try {

        const data =
            await api(
                "/api/me"
            );


        if (
            data.loggedIn &&
            data.user
        ) {

            currentUser =
                data.user;

        } else {

            currentUser =
                null;

        }


        updateUI();


    } catch (error) {

        console.error(
            "CURRENT USER ERROR:",
            error
        );

        currentUser =
            null;

        updateUI();

    }

}


// ==================================================
// UPDATE UI
// ==================================================

function updateUI() {

    const authSection =
        document.getElementById(
            "auth-section"
        );

    const appSection =
        document.getElementById(
            "app-section"
        );

    const logoutButton =
        document.getElementById(
            "logout-button"
        );


    if (currentUser) {

        if (authSection) {

            authSection.style.display =
                "none";

        }


        if (appSection) {

            appSection.style.display =
                "block";

        }


        if (logoutButton) {

            logoutButton.style.display =
                "inline-block";

        }


        loadPosts();

        loadPeople();

        checkAdmin();


    } else {

        if (authSection) {

            authSection.style.display =
                "block";

        }


        if (appSection) {

            appSection.style.display =
                "none";

        }


        if (logoutButton) {

            logoutButton.style.display =
                "none";

        }


        const adminButton =
            document.getElementById(
                "admin-button"
            );


        if (adminButton) {

            adminButton.style.display =
                "none";

        }

    }

}


// ==================================================
// CHECK ADMIN
// ==================================================

async function checkAdmin() {

    const adminButton =
        document.getElementById(
            "admin-button"
        );


    if (!adminButton)
        return;


    try {

        const data =
            await api(
                "/api/admin/me"
            );


        adminButton.style.display =
            data.isAdmin
                ? "inline-block"
                : "none";


    } catch (error) {

        console.error(
            "ADMIN CHECK ERROR:",
            error
        );

        adminButton.style.display =
            "none";

    }

}


// ==================================================
// CREATE POST
// ==================================================

async function createPost() {

    const contentElement =
        document.getElementById(
            "post-content"
        );

    const status =
        document.getElementById(
            "post-status"
        );

    const content =
        contentElement
            ? contentElement.value.trim()
            : "";


    if (!content) {

        if (status)
            status.textContent =
                "Post cannot be empty.";

        return;

    }


    if (status)
        status.textContent =
            "Posting...";


    try {

        await api(
            "/api/posts",
            {
                method: "POST",

                body: JSON.stringify({
                    content
                })
            }
        );


        if (contentElement)
            contentElement.value =
                "";


        if (status)
            status.textContent =
                "Posted!";


        clearPostImage();

        await loadPosts();


    } catch (error) {

        console.error(
            "CREATE POST ERROR:",
            error
        );

        if (status)
            status.textContent =
                error.message ||
                "Could not create post.";

    }

}


// ==================================================
// LOAD POSTS
// ==================================================

async function loadPosts() {

    const container =
        document.getElementById(
            "posts"
        );


    if (!container)
        return;


    container.textContent =
        "Loading posts...";


    try {

        const data =
            await api(
                "/api"
            );


        const posts =
            data.posts || [];


        if (!posts.length) {

            container.textContent =
                "No posts yet. Be the first! 🧌";

            return;

        }


        container.innerHTML =
            "";


        for (
            const post of posts
        ) {

            const article =
                document.createElement(
                    "article"
                );


            article.className =
                "post";


            const content =
                document.createElement(
                    "p"
                );


            content.textContent =
                post.content || "";


            article.appendChild(
                content
            );


            if (post.image_url) {

                const image =
                    document.createElement(
                        "img"
                    );


                image.src =
                    post.image_url;

                image.alt =
                    "Post image";

                image.style.maxWidth =
                    "100%";

                image.style.borderRadius =
                    "12px";


                article.appendChild(
                    image
                );

            }


            const date =
                document.createElement(
                    "small"
                );


            if (post.created_at) {

                date.textContent =
                    new Date(
                        post.created_at
                    ).toLocaleString();

            }


            article.appendChild(
                date
            );


            container.appendChild(
                article
            );

        }


    } catch (error) {

        console.error(
            "LOAD POSTS ERROR:",
            error
        );

        container.textContent =
            "Could not load posts.";

    }

}


// ==================================================
// LOAD PEOPLE
// ==================================================

async function loadPeople() {

    const container =
        document.getElementById(
            "people"
        );


    if (!container)
        return;


    container.textContent =
        "Loading people...";


    try {

        const data =
            await api(
                "/api/users"
            );


        const users =
            data.users || [];


        if (!users.length) {

            container.textContent =
                "No users found.";

            return;

        }


        container.innerHTML =
            "";


        for (
            const user of users
        ) {

            const person =
                document.createElement(
                    "div"
                );


            person.className =
                "person";


            const name =
                document.createElement(
                    "strong"
                );


            name.textContent =
                user.display_name ||
                user.username ||
                "Unknown user";


            person.appendChild(
                name
            );


            if (user.username) {

                const username =
                    document.createElement(
                        "span"
                    );


                username.textContent =
                    ` @${user.username}`;


                person.appendChild(
                    username
                );

            }


            if (user.id) {

                person.style.cursor =
                    "pointer";


                person.addEventListener(
                    "click",
                    () => {

                        window.location.href =
                            `/profile.html?id=${encodeURIComponent(
                                user.id
                            )}`;

                    }
                );

            }


            container.appendChild(
                person
            );

        }


    } catch (error) {

        console.error(
            "LOAD PEOPLE ERROR:",
            error
        );

        container.textContent =
            "Could not load people.";

    }

}


// ==================================================
// IMAGE PICKER
// ==================================================

function setupImagePicker() {

    const input =
        document.getElementById(
            "post-image"
        );


    if (!input)
        return;


    input.addEventListener(
        "change",
        () => {

            const file =
                input.files &&
                input.files[0];


            if (!file) {

                clearPostImage();

                return;

            }


            const preview =
                document.getElementById(
                    "post-image-preview"
                );

            const image =
                document.getElementById(
                    "post-preview-image"
                );


            if (!preview || !image)
                return;


            image.src =
                URL.createObjectURL(
                    file
                );


            preview.style.display =
                "block";

        }
    );

}


// ==================================================
// CLEAR POST IMAGE
// ==================================================

function clearPostImage() {

    const input =
        document.getElementById(
            "post-image"
        );

    const preview =
        document.getElementById(
            "post-image-preview"
        );

    const image =
        document.getElementById(
            "post-preview-image"
        );


    if (input)
        input.value =
            "";


    if (preview)
        preview.style.display =
            "none";


    if (image)
        image.src =
            "";

}


// ==================================================
// STARTUP
// ==================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setupImagePicker();

        await loadCurrentUser();

    }
);

