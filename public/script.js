// ==================================================
// SHREKBOOK FRONTEND
// public/script.js
// ==================================================

console.log("🧌 ShrekBook frontend loaded");


// ==================================================
// HELPERS
// ==================================================

async function api(url, options = {}) {

    const response = await fetch(url, {
        credentials: "same-origin",
        ...options,
        headers: {
            "Content-Type": "application/json",
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
// AUTH UI
// ==================================================

function showLogin() {

    const loginBox = document.getElementById("login-box");
    const signupBox = document.getElementById("signup-box");

    if (loginBox) {
        loginBox.style.display = "block";
    }

    if (signupBox) {
        signupBox.style.display = "none";
    }

}


function showSignup() {

    const loginBox = document.getElementById("login-box");
    const signupBox = document.getElementById("signup-box");

    if (loginBox) {
        loginBox.style.display = "none";
    }

    if (signupBox) {
        signupBox.style.display = "block";
    }

}


// ==================================================
// LOGIN
// ==================================================

async function login() {

    const emailInput =
        document.getElementById("login-email");

    const passwordInput =
        document.getElementById("login-password");

    const status =
        document.getElementById("login-status");


    const email =
        emailInput
            ? emailInput.value.trim()
            : "";

    const password =
        passwordInput
            ? passwordInput.value
            : "";


    if (!email || !password) {

        if (status) {
            status.textContent =
                "Please enter your email and password.";
        }

        return;
    }


    if (status) {
        status.textContent = "Logging in...";
    }


    try {

        const data = await api(
            "/api/login",
            {
                method: "POST",

                body: JSON.stringify({
                    email,
                    password
                })
            }
        );


        console.log(
            "LOGIN SUCCESS:",
            data
        );


        if (status) {
            status.textContent =
                "Login successful! 🧌";
        }


        // IMPORTANT:
        // The server has now created the session.
        // Reloading the page makes the browser
        // load the logged-in state.

        await loadCurrentUser();


    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );

        if (status) {
            status.textContent =
                error.message;
        }

    }

}


// ==================================================
// SIGNUP
// ==================================================

async function signup() {

    const usernameInput =
        document.getElementById("signup-username");

    const displayNameInput =
        document.getElementById("signup-display-name");

    const emailInput =
        document.getElementById("signup-email");

    const passwordInput =
        document.getElementById("signup-password");

    const status =
        document.getElementById("signup-status");


    const username =
        usernameInput
            ? usernameInput.value.trim()
            : "";

    const displayName =
        displayNameInput
            ? displayNameInput.value.trim()
            : "";

    const email =
        emailInput
            ? emailInput.value.trim()
            : "";

    const password =
        passwordInput
            ? passwordInput.value
            : "";


    if (
        !username ||
        !email ||
        !password
    ) {

        if (status) {
            status.textContent =
                "Username, email, and password are required.";
        }

        return;
    }


    if (status) {
        status.textContent =
            "Creating account...";
    }


    try {

        const data = await api(
            "/api/signup",
            {
                method: "POST",

                body: JSON.stringify({

                    username,

                    display_name:
                        displayName,

                    email,

                    password

                })
            }
        );


        console.log(
            "SIGNUP SUCCESS:",
            data
        );


        if (status) {
            status.textContent =
                "Account created! You can now log in. 🧌";
        }


        // Switch back to login.

        showLogin();


        // Put email into login field.

        const loginEmail =
            document.getElementById(
                "login-email"
            );

        if (loginEmail) {
            loginEmail.value = email;
        }


    } catch (error) {

        console.error(
            "SIGNUP ERROR:",
            error
        );

        if (status) {
            status.textContent =
                error.message;
        }

    }

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


        console.log(
            "Logged out"
        );


        showLoggedOut();


    } catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );

        alert(
            error.message
        );

    }

}


// ==================================================
// CURRENT USER
// ==================================================

async function loadCurrentUser() {

    try {

        const data =
            await api(
                "/api/me"
            );


        console.log(
            "CURRENT USER:",
            data
        );


        if (
            data &&
            data.loggedIn &&
            data.user
        ) {

            showLoggedIn(
                data.user
            );

        } else {

            showLoggedOut();

        }


    } catch (error) {

        console.error(
            "LOAD USER ERROR:",
            error
        );

        showLoggedOut();

    }

}


// ==================================================
// SHOW LOGGED IN
// ==================================================

function showLoggedIn(user) {

    console.log(
        "Showing logged-in UI:",
        user
    );


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

    const adminButton =
        document.getElementById(
            "admin-button"
        );


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


    // Load the actual app.

    loadPosts();

    loadPeople();

    checkAdmin();


    // Update profile link.

    const profileLink =
        document.getElementById(
            "profile-link"
        );


    if (
        profileLink &&
        user &&
        user.id
    ) {

        profileLink.href =
            "/profile.html?id=" +
            encodeURIComponent(
                user.id
            );

    }

}


// ==================================================
// SHOW LOGGED OUT
// ==================================================

function showLoggedOut() {

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

    const adminButton =
        document.getElementById(
            "admin-button"
        );


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


    if (adminButton) {
        adminButton.style.display =
            "none";
    }

}


// ==================================================
// ADMIN CHECK
// ==================================================

async function checkAdmin() {

    const adminButton =
        document.getElementById(
            "admin-button"
        );


    if (!adminButton) {
        return;
    }


    try {

        const data =
            await api(
                "/api/admin/me"
            );


        if (
            data &&
            data.isAdmin
        ) {

            adminButton.style.display =
                "inline-block";

        } else {

            adminButton.style.display =
                "none";

        }

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
// POSTS
// ==================================================

async function loadPosts() {

    const container =
        document.getElementById(
            "posts"
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        "Loading posts...";


    try {

        const data =
            await api(
                "/api/"
            );


        const posts =
            data.posts || [];


        if (posts.length === 0) {

            container.innerHTML =
                "<p>No posts yet. Be the first! 🧌</p>";

            return;
        }


        container.innerHTML = "";


        for (
            const post of posts
        ) {

            const element =
                document.createElement(
                    "article"
                );


            element.className =
                "post";


            const content =
                escapeHTML(
                    post.content || ""
                );


            let html = `
                <div class="post-content">
                    ${content}
                </div>
            `;


            if (post.image_url) {

                html += `
                    <img
                        src="${escapeAttribute(post.image_url)}"
                        alt="Post image"
                        style="
                            max-width:100%;
                            max-height:500px;
                            border-radius:12px;
                            margin-top:10px;
                        "
                    >
                `;

            }


            html += `
                <small>
                    ${formatDate(post.created_at)}
                </small>
            `;


            element.innerHTML =
                html;


            container.appendChild(
                element
            );

        }


    } catch (error) {

        console.error(
            "LOAD POSTS ERROR:",
            error
        );

        container.innerHTML =
            `<p>Could not load posts: ${escapeHTML(error.message)}</p>`;

    }

}


// ==================================================
// CREATE POST
// ==================================================

async function createPost() {

    const contentInput =
        document.getElementById(
            "post-content"
        );

    const imageInput =
        document.getElementById(
            "post-image"
        );

    const status =
        document.getElementById(
            "post-status"
        );


    const content =
        contentInput
            ? contentInput.value.trim()
            : "";


    let imageUrl = "";


    // ----------------------------------------------
    // IMAGE
    // ----------------------------------------------

    if (
        imageInput &&
        imageInput.files &&
        imageInput.files.length > 0
    ) {

        if (status) {
            status.textContent =
                "Uploading image...";
        }


        try {

            imageUrl =
                await uploadPostImage(
                    imageInput.files[0]
                );

        } catch (error) {

            console.error(
                "IMAGE UPLOAD ERROR:",
                error
            );

            if (status) {
                status.textContent =
                    error.message;
            }

            return;
        }

    }


    if (
        !content &&
        !imageUrl
    ) {

        if (status) {
            status.textContent =
                "Post cannot be empty.";
        }

        return;
    }


    try {

        if (status) {
            status.textContent =
                "Posting...";
        }


        await api(
            "/api/",
            {
                method: "POST",

                body: JSON.stringify({

                    content,

                    image_url:
                        imageUrl

                })
            }
        );


        if (contentInput) {
            contentInput.value = "";
        }


        clearPostImage();


        if (status) {
            status.textContent =
                "Posted! 🧌";
        }


        await loadPosts();


    } catch (error) {

        console.error(
            "CREATE POST ERROR:",
            error
        );

        if (status) {
            status.textContent =
                error.message;
        }

    }

}


// ==================================================
// IMAGE UPLOAD
// ==================================================

async function uploadPostImage(file) {

    const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif"
    ];


    if (
        !allowedTypes.includes(
            file.type
        )
    ) {

        throw new Error(
            "Unsupported image type."
        );

    }


    // 10 MB maximum.

    if (
        file.size >
        10 * 1024 * 1024
    ) {

        throw new Error(
            "Image must be smaller than 10 MB."
        );

    }


    const formData =
        new FormData();


    formData.append(
        "image",
        file
    );


    const response =
        await fetch(
            "/api/profile/avatar",
            {
                method: "POST",
                credentials: "same-origin",
                body: formData
            }
        );


    let data = {};

    try {
        data =
            await response.json();
    } catch {}



    if (!response.ok) {

        throw new Error(
            data.error ||
            "Image upload failed."
        );

    }


    return (
        data.image_url ||
        data.avatar_url ||
        ""
    );

}


// ==================================================
// IMAGE PREVIEW
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

    const previewImage =
        document.getElementById(
            "post-preview-image"
        );


    if (input) {
        input.value = "";
    }


    if (preview) {
        preview.style.display =
            "none";
    }


    if (previewImage) {
        previewImage.src =
            "";
    }

}


// ==================================================
// PEOPLE
// ==================================================

async function loadPeople() {

    const container =
        document.getElementById(
            "people"
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        "Loading people...";


    try {

        const data =
            await api(
                "/api/users"
            );


        const users =
            data.users || [];


        if (
            users.length === 0
        ) {

            container.innerHTML =
                "<p>No users found.</p>";

            return;
        }


        container.innerHTML = "";


        for (
            const user of users
        ) {

            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "person";


            const name =
                escapeHTML(
                    user.display_name ||
                    user.username ||
                    "Unknown user"
                );


            const username =
                escapeHTML(
                    user.username ||
                    ""
                );


            const avatar =
                user.avatar_url
                    ? `
                        <img
                            src="${escapeAttribute(user.avatar_url)}"
                            alt="Avatar"
                            style="
                                width:60px;
                                height:60px;
                                object-fit:cover;
                                border-radius:50%;
                            "
                        >
                    `
                    : "🧌";


            element.innerHTML = `

                ${avatar}

                <div>

                    <strong>
                        ${name}
                    </strong>

                    <br>

                    <small>
                        @${username}
                    </small>

                </div>

            `;


            element.style.cursor =
                "pointer";


            element.onclick =
                function () {

                    if (user.id) {

                        window.location.href =
                            "/profile.html?id=" +
                            encodeURIComponent(
                                user.id
                            );

                    }

                };


            container.appendChild(
                element
            );

        }


    } catch (error) {

        console.error(
            "LOAD PEOPLE ERROR:",
            error
        );

        container.innerHTML =
            `<p>Could not load people: ${escapeHTML(error.message)}</p>`;

    }

}


// ==================================================
// POST IMAGE PREVIEW LISTENER
// ==================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const imageInput =
            document.getElementById(
                "post-image"
            );


        if (imageInput) {

            imageInput.addEventListener(
                "change",
                () => {

                    const file =
                        imageInput.files?.[0];


                    const preview =
                        document.getElementById(
                            "post-image-preview"
                        );

                    const previewImage =
                        document.getElementById(
                            "post-preview-image"
                        );


                    if (
                        !file ||
                        !preview ||
                        !previewImage
                    ) {

                        return;

                    }


                    const reader =
                        new FileReader();


                    reader.onload =
                        event => {

                            previewImage.src =
                                event.target.result;

                            preview.style.display =
                                "block";

                        };


                    reader.readAsDataURL(
                        file
                    );

                }
            );

        }


        // Load login state.

        loadCurrentUser();

    }
);


// ==================================================
// SECURITY / DISPLAY HELPERS
// ==================================================

function escapeHTML(value) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


function escapeAttribute(value) {

    return escapeHTML(
        value
    );

}


function formatDate(date) {

    if (!date) {
        return "";
    }


    try {

        return new Date(
            date
        ).toLocaleString();

    } catch {

        return "";

    }

}


// ==================================================
// MAKE FUNCTIONS AVAILABLE TO HTML onclick=""
// ==================================================

window.login =
    login;

window.signup =
    signup;

window.logout =
    logout;

window.showLogin =
    showLogin;

window.showSignup =
    showSignup;

window.createPost =
    createPost;

window.clearPostImage =
    clearPostImage;

window.loadPosts =
    loadPosts;

window.loadPeople =
    loadPeople;
