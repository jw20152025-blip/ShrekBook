// ============================================================
// SHREKBOOK FRONTEND
// public/script.js
// ============================================================

console.log(
    "🧌 ShrekBook frontend loaded"
);


// ============================================================
// API HELPER
// ============================================================

async function api(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {
                credentials:
                    "same-origin",

                ...options,

                headers: {
                    "Content-Type":
                        "application/json",

                    ...(options.headers || {})
                }
            }
        );

    let data = {};

    try {

        data =
            await response.json();

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


// ============================================================
// LOGIN / SIGNUP UI
// ============================================================

function showLogin() {

    const loginBox =
        document.getElementById(
            "login-box"
        );

    const signupBox =
        document.getElementById(
            "signup-box"
        );

    if (loginBox) {
        loginBox.style.display =
            "block";
    }

    if (signupBox) {
        signupBox.style.display =
            "none";
    }

}

function showSignup() {

    const loginBox =
        document.getElementById(
            "login-box"
        );

    const signupBox =
        document.getElementById(
            "signup-box"
        );

    if (loginBox) {
        loginBox.style.display =
            "none";
    }

    if (signupBox) {
        signupBox.style.display =
            "block";
    }

}


// ============================================================
// LOGIN
// ============================================================

async function login() {

    const email =
        document.getElementById(
            "login-email"
        )?.value.trim();

    const password =
        document.getElementById(
            "login-password"
        )?.value || "";

    const status =
        document.getElementById(
            "login-status"
        );

    if (
        !email ||
        !password
    ) {

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

        const data =
            await api(
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
            "LOGIN SUCCESS:",
            data
        );

        // The server explicitly saves the session
        // before returning this response.

        if (
            !data.loggedIn ||
            !data.user
        ) {

            throw new Error(
                "Login succeeded, but the session was not returned."
            );

        }

        // Verify the actual session.

        const me =
            await api(
                "/api/me"
            );

        if (
            !me.loggedIn ||
            !me.user
        ) {

            throw new Error(
                "Login succeeded, but the session was not found."
            );

        }

        if (status) {

            status.textContent =
                "Login successful! 🧌";

        }

        showLoggedIn(
            me.user
        );

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


// ============================================================
// SIGNUP
// ============================================================

async function signup() {

    const username =
        document.getElementById(
            "signup-username"
        )?.value.trim();

    const displayName =
        document.getElementById(
            "signup-display-name"
        )?.value.trim();

    const email =
        document.getElementById(
            "signup-email"
        )?.value.trim();

    const password =
        document.getElementById(
            "signup-password"
        )?.value || "";

    const status =
        document.getElementById(
            "signup-status"
        );

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

        await api(
            "/api/signup",
            {
                method:
                    "POST",

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

        if (status) {

            status.textContent =
                "Account created! You can now log in. 🧌";

        }

        showLogin();

        const loginEmail =
            document.getElementById(
                "login-email"
            );

        if (loginEmail) {

            loginEmail.value =
                email;

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


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

    try {

        await api(
            "/api/logout",
            {
                method:
                    "POST"
            }
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


// ============================================================
// CURRENT USER
// ============================================================

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


// ============================================================
// LOGGED IN UI
// ============================================================

function showLoggedIn(user) {

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

    if (
        adminButton &&
        user &&
        (
            user.is_admin ||
            user.role === "admin"
        )
    ) {

        adminButton.style.display =
            "inline-block";

    }

    const profileLink =
        document.getElementById(
            "profile-link"
        );

    if (
        profileLink &&
        user?.id
    ) {

        profileLink.href =
            "/profile.html?id=" +
            encodeURIComponent(
                user.id
            );

    }

    loadPosts();
    loadPeople();

    checkAdmin();

}


// ============================================================
// LOGGED OUT UI
// ============================================================

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


// ============================================================
// ADMIN CHECK
// ============================================================

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

        adminButton.style.display =
            data.isAdmin
                ? "inline-block"
                : "none";

    } catch {

        adminButton.style.display =
            "none";

    }

}


// ============================================================
// POSTS
// ============================================================

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

        if (
            posts.length === 0
        ) {

            container.innerHTML =
                "<p>No posts yet. Be the first! 🧌</p>";

            return;

        }

        container.innerHTML =
            "";

        for (
            const post
            of posts
        ) {

            const article =
                document.createElement(
                    "article"
                );

            article.className =
                "post";

            let html = "";

            if (post.content) {

                html += `

                    <div class="post-content">

                        ${escapeHTML(
                            post.content
                        )}

                    </div>

                `;

            }

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

                    ${formatDate(
                        post.created_at
                    )}

                </small>

                <div
                    class="post-actions"
                    style="margin-top:10px;">

                    <button
                        onclick="reactToPost('${escapeAttribute(post.id)}','like')">

                        👍 Like

                    </button>

                    <button
                        onclick="reactToPost('${escapeAttribute(post.id)}','love')">

                        ❤️ Love

                    </button>

                    <button
                        onclick="reactToPost('${escapeAttribute(post.id)}','laugh')">

                        😂 Laugh

                    </button>

                    <button
                        onclick="reactToPost('${escapeAttribute(post.id)}','angry')">

                        😡 Angry

                    </button>

                    <button
                        onclick="reactToPost('${escapeAttribute(post.id)}','sad')">

                        😢 Sad

                    </button>

                    <button
                        onclick="reactToPost('${escapeAttribute(post.id)}','gyatt')">

                        🍑 Gyatt

                    </button>

                </div>

                <div
                    id="reactions-${escapeAttribute(post.id)}">

                    Loading reactions...

                </div>

                <div
                    style="margin-top:10px;">

                    <input
                        id="comment-${escapeAttribute(post.id)}"
                        placeholder="Write a comment..."
                        maxlength="2000">

                    <button
                        onclick="addComment('${escapeAttribute(post.id)}')">

                        💬 Comment

                    </button>

                </div>

                <div
                    id="comments-${escapeAttribute(post.id)}">

                    Loading comments...

                </div>

            `;

            article.innerHTML =
                html;

            container.appendChild(
                article
            );

            loadReactions(
                post.id
            );

            loadComments(
                post.id
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


// ============================================================
// CREATE POST
// ============================================================

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
        contentInput?.value.trim() ||
        "";

    let imageUrl =
        "";

    if (
        imageInput?.files?.length
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
                method:
                    "POST",

                body:
                    JSON.stringify({

                        content,

                        image_url:
                            imageUrl

                    })
            }
        );

        if (contentInput) {

            contentInput.value =
                "";

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


// ============================================================
// IMAGE UPLOAD
// ============================================================

async function uploadPostImage(file) {

    const allowed = [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif"
    ];

    if (
        !allowed.includes(
            file.type
        )
    ) {

        throw new Error(
            "Unsupported image type."
        );

    }

    if (
        file.size >
        10 * 1024 * 1024
    ) {

        throw new Error(
            "Image must be smaller than 10 MB."
        );

    }

    const base64 =
        await fileToDataURL(
            file
        );

    const data =
        await api(
            "/api/profile/avatar",
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        image:
                            base64
                    })
            }
        );

    return (
        data.image_url ||
        data.avatar_url ||
        ""
    );

}

function fileToDataURL(file) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();

            reader.onload =
                () =>
                    resolve(
                        reader.result
                    );

            reader.onerror =
                reject;

            reader.readAsDataURL(
                file
            );

        }
    );

}


// ============================================================
// IMAGE PREVIEW
// ============================================================

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

        input.value =
            "";

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


// ============================================================
// PEOPLE
// ============================================================

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

        container.innerHTML =
            "";

        for (
            const user
            of users
        ) {

            const person =
                document.createElement(
                    "div"
                );

            person.className =
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

            person.innerHTML = `

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

            person.style.cursor =
                "pointer";

            person.onclick =
                () => {

                    if (user.id) {

                        window.location.href =
                            "/profile.html?id=" +
                            encodeURIComponent(
                                user.id
                            );

                    }

                };

            container.appendChild(
                person
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


// ============================================================
// COMMENTS
// ============================================================

async function loadComments(postId) {

    const container =
        document.getElementById(
            `comments-${postId}`
        );

    if (!container) {
        return;
    }

    try {

        const data =
            await api(
                `/api/posts/${encodeURIComponent(postId)}/comments`
            );

        const comments =
            data.comments || [];

        if (
            comments.length === 0
        ) {

            container.innerHTML =
                "<small>No comments yet.</small>";

            return;

        }

        container.innerHTML =
            "";

        for (
            const comment
            of comments
        ) {

            const div =
                document.createElement(
                    "div"
                );

            div.style.marginTop =
                "8px";

            div.style.padding =
                "8px";

            div.style.borderRadius =
                "8px";

            div.style.background =
                "rgba(0,0,0,0.05)";

            div.innerHTML = `

                <div>

                    ${escapeHTML(
                        comment.content
                    )}

                </div>

                <small>

                    ${formatDate(
                        comment.created_at
                    )}

                </small>

            `;

            container.appendChild(
                div
            );

        }

    } catch (error) {

        console.error(
            "LOAD COMMENTS ERROR:",
            error
        );

        container.innerHTML =
            `<small>Could not load comments: ${escapeHTML(error.message)}</small>`;

    }

}


// ============================================================
// ADD COMMENT
// ============================================================

async function addComment(postId) {

    const input =
        document.getElementById(
            `comment-${postId}`
        );

    const content =
        input?.value.trim() ||
        "";

    if (!content) {

        return;

    }

    try {

        await api(
            `/api/posts/${encodeURIComponent(postId)}/comments`,
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        content
                    })
            }
        );

        input.value =
            "";

        await loadComments(
            postId
        );

    } catch (error) {

        alert(
            error.message
        );

    }

}


// ============================================================
// REACTIONS
// ============================================================

async function loadReactions(postId) {

    const container =
        document.getElementById(
            `reactions-${postId}`
        );

    if (!container) {
        return;
    }

    try {

        const data =
            await api(
                `/api/posts/${encodeURIComponent(postId)}/reactions`
            );

        const counts =
            data.counts || {};

        container.innerHTML = `

            👍 ${counts.like || 0}

            ❤️ ${counts.love || 0}

            😂 ${counts.laugh || 0}

            😡 ${counts.angry || 0}

            😢 ${counts.sad || 0}

            🍑 ${counts.gyatt || 0}

        `;

    } catch (error) {

        console.error(
            "LOAD REACTIONS ERROR:",
            error
        );

        container.textContent =
            "Could not load reactions.";

    }

}


async function reactToPost(
    postId,
    reaction
) {

    try {

        await api(
            `/api/posts/${encodeURIComponent(postId)}/reactions`,
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        reaction_type:
                            reaction
                    })
            }
        );

        await loadReactions(
            postId
        );

    } catch (error) {

        alert(
            error.message
        );

    }

}


// ============================================================
// DOM READY
// ============================================================

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

        loadCurrentUser();

    }
);


// ============================================================
// SECURITY / DISPLAY HELPERS
// ============================================================

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

    const parsed =
        new Date(date);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {

        return "";

    }

    return parsed.toLocaleString();

}


// ============================================================
// GLOBAL FUNCTIONS FOR onclick=""
// ============================================================

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

window.loadComments =
    loadComments;

window.addComment =
    addComment;

window.loadReactions =
    loadReactions;

window.reactToPost =
    reactToPost;