
// ==================================================
// SHREKBOOK FRONTEND
// public/script.js
// ==================================================

console.log("🧌 ShrekBook frontend loaded");

// ==================================================
// API HELPER
// ==================================================

async function api(url, options = {}) {

    const response = await fetch(url, {
        credentials: "same-origin",
        ...options,
        headers: {
            ...(options.body instanceof FormData
                ? {}
                : { "Content-Type": "application/json" }),
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

    const loginBox =
        document.getElementById("login-box");

    const signupBox =
        document.getElementById("signup-box");

    if (loginBox)
        loginBox.style.display = "block";

    if (signupBox)
        signupBox.style.display = "none";
}


function showSignup() {

    const loginBox =
        document.getElementById("login-box");

    const signupBox =
        document.getElementById("signup-box");

    if (loginBox)
        loginBox.style.display = "none";

    if (signupBox)
        signupBox.style.display = "block";
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
        status.textContent =
            "Logging in...";
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


        // Get the newly-created session/user.

        const me =
            await api("/api/me");


        console.log(
            "USER AFTER LOGIN:",
            me
        );


        if (
            me.loggedIn &&
            me.user
        ) {

            // Immediately switch to the app.

            showLoggedIn(
                me.user
            );

            if (status) {
                status.textContent =
                    "Login successful! 🧌";
            }

        } else {

            throw new Error(
                "Login succeeded, but the session was not found."
            );

        }


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

    const username =
        document.getElementById("signup-username")?.value.trim();

    const displayName =
        document.getElementById("signup-display-name")?.value.trim();

    const email =
        document.getElementById("signup-email")?.value.trim();

    const password =
        document.getElementById("signup-password")?.value;

    const status =
        document.getElementById("signup-status");

    if (!username || !email || !password) {

        if (status)
            status.textContent =
                "Username, email, and password are required.";

        return;
    }

    if (status)
        status.textContent = "Creating account...";

    try {

        await api(
            "/api/signup",
            {
                method: "POST",
                body: JSON.stringify({
                    username,
                    display_name: displayName,
                    email,
                    password
                })
            }
        );

        if (status)
            status.textContent =
                "Account created! You can now log in. 🧌";

        showLogin();

        const loginEmail =
            document.getElementById("login-email");

        if (loginEmail)
            loginEmail.value = email;

    } catch (error) {

        console.error("SIGNUP ERROR:", error);

        if (status)
            status.textContent = error.message;
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

        showLoggedOut();

        window.location.href = "/";

    } catch (error) {

        console.error("LOGOUT ERROR:", error);

        alert(error.message);
    }
}


// ==================================================
// CURRENT USER
// ==================================================

async function loadCurrentUser() {

    try {

        const data =
            await api("/api/me");

        console.log("CURRENT USER:", data);

        if (
            data &&
            data.loggedIn &&
            data.user
        ) {

            showLoggedIn(data.user);

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

    const authSection =
        document.getElementById("auth-section");

    const appSection =
        document.getElementById("app-section");

    const logoutButton =
        document.getElementById("logout-button");

    if (authSection)
        authSection.style.display = "none";

    if (appSection)
        appSection.style.display = "block";

    if (logoutButton)
        logoutButton.style.display = "inline-block";

    const profileLink =
        document.getElementById("profile-link");

    if (profileLink && user?.id) {

        profileLink.href =
            "/profile.html?id=" +
            encodeURIComponent(user.id);
    }

    loadPosts();
    loadPeople();
    checkAdmin();
}


// ==================================================
// SHOW LOGGED OUT
// ==================================================

function showLoggedOut() {

    const authSection =
        document.getElementById("auth-section");

    const appSection =
        document.getElementById("app-section");

    const logoutButton =
        document.getElementById("logout-button");

    const adminButton =
        document.getElementById("admin-button");

    if (authSection)
        authSection.style.display = "block";

    if (appSection)
        appSection.style.display = "none";

    if (logoutButton)
        logoutButton.style.display = "none";

    if (adminButton)
        adminButton.style.display = "none";
}


// ==================================================
// ADMIN
// ==================================================

async function checkAdmin() {

    const button =
        document.getElementById("admin-button");

    if (!button)
        return;

    try {

        const data =
            await api("/api/admin/me");

        button.style.display =
            data?.isAdmin
                ? "inline-block"
                : "none";

    } catch (error) {

        console.error(
            "ADMIN CHECK ERROR:",
            error
        );

        button.style.display = "none";
    }
}


// ==================================================
// POSTS
// ==================================================

async function loadPosts() {

    const container =
        document.getElementById("posts");

    if (!container)
        return;

    container.innerHTML =
        "Loading posts...";

    try {

        const data =
            await api("/api/");

        const posts =
            data.posts || [];

        if (!posts.length) {

            container.innerHTML =
                "<p>No posts yet. Be the first! 🧌</p>";

            return;
        }

        container.innerHTML = "";

        for (const post of posts) {

            const element =
                document.createElement("article");

            element.className = "post";

            let html = `
                <div class="post-content">
                    ${escapeHTML(post.content || "")}
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

                <div class="post-reactions">
                    <button onclick="reactToPost('${post.id}', 'like')">
                        👍 <span id="like-${post.id}">0</span>
                    </button>

                    <button onclick="reactToPost('${post.id}', 'love')">
                        ❤️ <span id="love-${post.id}">0</span>
                    </button>

                    <button onclick="reactToPost('${post.id}', 'laugh')">
                        😂 <span id="laugh-${post.id}">0</span>
                    </button>

                    <button onclick="reactToPost('${post.id}', 'angry')">
                        😡 <span id="angry-${post.id}">0</span>
                    </button>

                    <button onclick="reactToPost('${post.id}', 'sad')">
                        😢 <span id="sad-${post.id}">0</span>
                    </button>

                    <button onclick="reactToPost('${post.id}', 'gyatt')">
                        🍑 <span id="gyatt-${post.id}">0</span>
                    </button>
                </div>

                <div class="comments">

                    <h4>Comments</h4>

                    <div id="comments-${post.id}">
                        Loading comments...
                    </div>

                    <div class="comment-form">

                        <input
                            id="comment-input-${post.id}"
                            type="text"
                            maxlength="1000"
                            placeholder="Write a comment..."
                        >

                        <button
                            onclick="addComment('${post.id}')"
                        >
                            Comment
                        </button>

                    </div>

                </div>
            `;

            element.innerHTML = html;

            container.appendChild(element);

            loadReactions(post.id);
            loadComments(post.id);
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
        document.getElementById("post-content");

    const imageInput =
        document.getElementById("post-image");

    const status =
        document.getElementById("post-status");

    const content =
        contentInput?.value.trim() || "";

    let imageUrl = "";

    if (
        imageInput &&
        imageInput.files &&
        imageInput.files.length
    ) {

        if (status)
            status.textContent =
                "Uploading image...";

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

            if (status)
                status.textContent =
                    error.message;

            return;
        }
    }

    if (!content && !imageUrl) {

        if (status)
            status.textContent =
                "Post cannot be empty.";

        return;
    }

    try {

        if (status)
            status.textContent =
                "Posting...";

        await api(
            "/api/",
            {
                method: "POST",

                body: JSON.stringify({
                    content,
                    image_url: imageUrl
                })
            }
        );

        if (contentInput)
            contentInput.value = "";

        clearPostImage();

        if (status)
            status.textContent =
                "Posted! 🧌";

        await loadPosts();

    } catch (error) {

        console.error(
            "CREATE POST ERROR:",
            error
        );

        if (status)
            status.textContent =
                error.message;
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

    if (!allowedTypes.includes(file.type)) {

        throw new Error(
            "Unsupported image type."
        );
    }

    if (file.size > 10 * 1024 * 1024) {

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
        data = await response.json();
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
        document.getElementById("post-image");

    const preview =
        document.getElementById("post-image-preview");

    const image =
        document.getElementById("post-preview-image");

    if (input)
        input.value = "";

    if (preview)
        preview.style.display = "none";

    if (image)
        image.src = "";
}


// ==================================================
// PEOPLE
// ==================================================

async function loadPeople() {

    const container =
        document.getElementById("people");

    if (!container)
        return;

    container.innerHTML =
        "Loading people...";

    try {

        const data =
            await api("/api/users");

        const users =
            data.users || [];

        if (!users.length) {

            container.innerHTML =
                "<p>No users found.</p>";

            return;
        }

        container.innerHTML = "";

        for (const user of users) {

            const element =
                document.createElement("div");

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
                    user.username || ""
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
                    <strong>${name}</strong>
                    <br>
                    <small>@${username}</small>
                </div>
            `;

            element.style.cursor =
                "pointer";

            element.onclick = () => {

                if (user.id) {

                    window.location.href =
                        "/profile.html?id=" +
                        encodeURIComponent(user.id);
                }
            };

            container.appendChild(element);
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
// COMMENTS
// ==================================================

async function loadComments(postId) {

    const container =
        document.getElementById(
            `comments-${postId}`
        );

    if (!container)
        return;

    try {

        const data =
            await api(
                `/api/posts/${encodeURIComponent(postId)}/comments`
            );

        const comments =
            data.comments || [];

        if (!comments.length) {

            container.innerHTML =
                "<p>No comments yet.</p>";

            return;
        }

        container.innerHTML = "";

        for (const comment of comments) {

            const element =
                document.createElement("div");

            element.className =
                "comment";

            element.innerHTML = `
                <div>
                    ${escapeHTML(comment.content)}
                </div>

                <small>
                    ${formatDate(comment.created_at)}
                </small>

                <button
                    onclick="deleteComment('${comment.id}')"
                >
                    🗑️
                </button>
            `;

            container.appendChild(element);
        }

    } catch (error) {

        console.error(
            "LOAD COMMENTS ERROR:",
            error
        );

        container.innerHTML =
            `<p>Could not load comments: ${escapeHTML(error.message)}</p>`;
    }
}


// ==================================================
// ADD COMMENT
// ==================================================

async function addComment(postId) {

    const input =
        document.getElementById(
            `comment-input-${postId}`
        );

    if (!input)
        return;

    const content =
        input.value.trim();

    if (!content)
        return;

    try {

        await api(
            `/api/posts/${encodeURIComponent(postId)}/comments`,
            {
                method: "POST",

                body: JSON.stringify({
                    content
                })
            }
        );

        input.value = "";

        await loadComments(postId);

    } catch (error) {

        console.error(
            "ADD COMMENT ERROR:",
            error
        );

        alert(error.message);
    }
}


// ==================================================
// DELETE COMMENT
// ==================================================

async function deleteComment(commentId) {

    if (!confirm(
        "Delete this comment?"
    )) {
        return;
    }

    try {

        await api(
            `/api/comments/${encodeURIComponent(commentId)}`,
            {
                method: "DELETE"
            }
        );

        await loadPosts();

    } catch (error) {

        console.error(
            "DELETE COMMENT ERROR:",
            error
        );

        alert(error.message);
    }
}


// ==================================================
// REACTIONS
// ==================================================

async function loadReactions(postId) {

    try {

        const data =
            await api(
                `/api/posts/${encodeURIComponent(postId)}/reactions`
            );

        const counts =
            data.counts || {};

        const types = [
            "like",
            "love",
            "laugh",
            "angry",
            "sad",
            "gyatt"
        ];

        for (const type of types) {

            const element =
                document.getElementById(
                    `${type}-${postId}`
                );

            if (element) {

                element.textContent =
                    counts[type] || 0;
            }
        }

    } catch (error) {

        console.error(
            "LOAD REACTIONS ERROR:",
            error
        );
    }
}


// ==================================================
// REACT TO POST
// ==================================================

async function reactToPost(
    postId,
    reactionType
) {

    try {

        await api(
            `/api/posts/${encodeURIComponent(postId)}/reactions`,
            {
                method: "POST",

                body: JSON.stringify({
                    reaction_type:
                        reactionType
                })
            }
        );

        await loadReactions(postId);

    } catch (error) {

        console.error(
            "REACTION ERROR:",
            error
        );

        alert(error.message);
    }
}


// ==================================================
// DOM READY
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

                    reader.readAsDataURL(file);
                }
            );
        }

        loadCurrentUser();
    }
);


// ==================================================
// SECURITY / DISPLAY HELPERS
// ==================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function escapeAttribute(value) {

    return escapeHTML(value);
}


function formatDate(date) {

    if (!date)
        return "";

    try {

        return new Date(date)
            .toLocaleString();

    } catch {

        return "";
    }
}


// ==================================================
// GLOBAL FUNCTIONS FOR HTML onclick
// ==================================================

window.login = login;
window.signup = signup;
window.logout = logout;
window.showLogin = showLogin;
window.showSignup = showSignup;
window.createPost = createPost;
window.clearPostImage = clearPostImage;
window.loadPosts = loadPosts;
window.loadPeople = loadPeople;
window.addComment = addComment;
window.deleteComment = deleteComment;
window.reactToPost = reactToPost;
window.loadComments = loadComments;
window.loadReactions = loadReactions;

