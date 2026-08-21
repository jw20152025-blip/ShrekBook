/* ==================================================
SHREKBOOK CLIENT SCRIPT
================================================== */


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
WARNING
================================================== */

function warn() {

    const element =
        document.getElementById(
            "upload-avatar-button-warn"
        );

    if (element) {

        element.innerHTML =
            "When changing your avatar, do not press the Save Profile button. Instead, press Upload Avatar.";

    }

}


/* ==================================================
FILE -> BASE64
================================================== */

function fileToBase64(file) {

    return new Promise((resolve, reject) => {

        const reader =
            new FileReader();

        reader.onload = () => {

            const result =
                reader.result;

            const base64 =
                result.split(",")[1];

            resolve(base64);

        };

        reader.onerror = () => {

            reject(
                new Error(
                    "Could not read image."
                )
            );

        };

        reader.readAsDataURL(file);

    });

}


/* ==================================================
REACTIONS
================================================== */

async function giveReaction(type) {

    const userId =
        new URLSearchParams(
            window.location.search
        ).get("id");

    if (!userId) {
        return;
    }

    try {

        const response =
            await fetch(
                `/api/users/${userId}/${type}`,
                {
                    method: "POST"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            alert(
                "❌ " +
                data.error
            );

            return;

        }

        if (type === "gyatt") {

            const element =
                document.getElementById(
                    "gyatt-count"
                );

            if (element) {

                element.textContent =
                    data.gyatt;

            }

        }

        if (type === "cat") {

            const element =
                document.getElementById(
                    "cat-count"
                );

            if (element) {

                element.textContent =
                    data.cat;

            }

        }

        if (type === "ogred") {

            const element =
                document.getElementById(
                    "ogred-count"
                );

            if (element) {

                element.textContent =
                    data.ogred;

            }

        }

    } catch (error) {

        console.error(
            "REACTION ERROR:",
            error
        );

        alert(
            "❌ Could not react."
        );

    }

}


/* ==================================================
MAKE IMAGE OBJECT
================================================== */

async function prepareImage(file) {

    if (!file) {
        return null;
    }

    if (!file.type.startsWith("image/")) {

        throw new Error(
            "Selected file is not an image."
        );

    }

    if (file.size > 5 * 1024 * 1024) {

        throw new Error(
            "Image must be under 5MB."
        );

    }

    const data =
        await fileToBase64(file);

    return {

        data: data,

        type:
            file.type,

        name:
            file.name

    };

}


/* ==================================================
LOGIN
================================================== */

async function login() {

    const email =
        document.getElementById(
            "login-email"
        ).value.trim();

    const password =
        document.getElementById(
            "login-password"
        ).value;

    const status =
        document.getElementById(
            "login-status"
        );

    if (!email || !password) {

        status.textContent =
            "❌ Enter your email and password.";

        return;

    }

    status.textContent =
        "Logging in...";

    try {

        const response =
            await fetch(
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

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Login failed."
            );

        }

        status.textContent =
            "✅ Logged in!";

        await checkLogin();

    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );

        status.textContent =
            "❌ " +
            error.message;

    }

}


/* ==================================================
SIGNUP
================================================== */

async function signup() {

    const username =
        document.getElementById(
            "signup-username"
        ).value.trim();

    const displayName =
        document.getElementById(
            "signup-display-name"
        ).value.trim();

    const email =
        document.getElementById(
            "signup-email"
        ).value.trim();

    const password =
        document.getElementById(
            "signup-password"
        ).value;

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
            "❌ Fill in all required fields.";

        return;

    }

    status.textContent =
        "Creating account...";

    try {

        const response =
            await fetch(
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
                                displayName ||
                                username,

                            email:
                                email,

                            password:
                                password

                        })

                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Signup failed."
            );

        }

        status.textContent =
            "✅ Account created!";

        showLogin();

    } catch (error) {

        console.error(
            "SIGNUP ERROR:",
            error
        );

        status.textContent =
            "❌ " +
            error.message;

    }

}


/* ==================================================
SHREKBOOK KICK DETECTOR
================================================== */

let kickCheckRunning = false;


/* ==================================================
SHREKBOOK INSTANT MODERATION
================================================== */

(function startModerationSocket() {

    const path =
        window.location.pathname
            .toLowerCase();

    if (
        path.endsWith("/login.html") ||
        path.endsWith("/kicked.html")
    ) {

        return;

    }

    const protocol =
        window.location.protocol === "https:"
            ? "wss:"
            : "ws:";

    const socket =
        new WebSocket(
            `${protocol}//${window.location.host}/moderation`
        );

    socket.addEventListener(
        "open",
        () => {

            console.log(
                "🛡️ Instant moderation connected."
            );

        }
    );

    socket.addEventListener(
        "message",
        event => {

            try {

                const data =
                    JSON.parse(
                        event.data
                    );

                if (
                    data.type === "BAN"
                ) {

                    console.log(
                        "🚫 BANNED"
                    );

                    window.location.replace(
                        "/login.html"
                    );

                    return;

                }

                if (
                    data.type === "KICK"
                ) {

                    console.log(
                        "🦵 KICKED"
                    );

                    window.location.replace(
                        "/kicked.html"
                    );

                    return;

                }

            }

            catch (error) {

                console.error(
                    "MODERATION MESSAGE ERROR:",
                    error
                );

            }

        }
    );

    socket.addEventListener(
        "close",
        () => {

            console.log(
                "Moderation connection closed."
            );

        }
    );

    socket.addEventListener(
        "error",
        error => {

            console.error(
                "MODERATION WEBSOCKET ERROR:",
                error
            );

        }
    );

})();


/* ==================================================
CHECK KICK STATUS
================================================== */

async function checkKickStatus() {

    if (kickCheckRunning) {
        return;
    }

    kickCheckRunning = true;

    try {

        const response =
            await fetch(
                "/api/me",
                {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );

        if (!response.ok) {
            return;
        }

        const data =
            await response.json();

        if (
            data &&
            data.kicked === true
        ) {

            console.log(
                "🚪 User has been kicked."
            );

            kickCheckRunning =
                true;

            window.location.replace(
                "/kicked.html"
            );

            return;

        }

    } catch (error) {

        console.error(
            "KICK STATUS ERROR:",
            error
        );

    } finally {

        if (
            !window.location.pathname
                .endsWith(
                    "/kicked.html"
                )
        ) {

            kickCheckRunning =
                false;

        }

    }

}


/* ==================================================
START KICK MONITOR
================================================== */

if (
    !window.location.pathname
        .endsWith(
            "/kicked.html"
        )
) {

    checkKickStatus();

    setInterval(
        checkKickStatus,
        1000
    );

}


/* ==================================================
AUTH UI
================================================== */

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


/* ==================================================
ADMIN NAVIGATION
================================================== */

function setupAdminNav(user) {

    if (!user) {
        return;
    }

    const isAdmin =
        user.is_admin === true ||
        user.is_admin === 1 ||
        user.is_admin === "true" ||

        user.admin === true ||
        user.admin === 1 ||
        user.admin === "true" ||

        user.isAdmin === true ||
        user.isAdmin === 1 ||

        user.role === "admin";

    let adminNav =
        document.getElementById(
            "admin-nav"
        );

    if (!isAdmin) {

        if (adminNav) {

            adminNav.style.display =
                "none";

        }

        return;

    }

    if (adminNav) {

        adminNav.style.display =
            "flex";

        return;

    }

    adminNav =
        document.createElement(
            "nav"
        );

    adminNav.id =
        "admin-nav";

    adminNav.style.cssText = `
        display:flex;
        align-items:center;
        gap:12px;
        padding:10px 15px;
        margin-bottom:15px;
        background:#222;
        border:1px solid #444;
        border-radius:10px;
        box-sizing:border-box;
        width:100%;
    `;

    adminNav.innerHTML = `

        <strong
            style="
                color:#ffcc00;
                white-space:nowrap;
            ">

            🛡️ Admin

        </strong>

        <a
            href="/admin.html"
            style="
                color:inherit;
                text-decoration:none;
                font-weight:bold;
            ">

            Admin Panel

        </a>

        <span
            style="
                opacity:0.5;
            ">

            |

        </span>

        <a
            href="/"
            style="
                color:inherit;
                text-decoration:none;
            ">

            Home

        </a>

    `;

    const app =
        document.getElementById(
            "app-section"
        );

    if (app) {

        app.insertBefore(
            adminNav,
            app.firstChild
        );

    } else {

        document.body.prepend(
            adminNav
        );

    }

}


/* ==================================================
SESSION CHECK
================================================== */

async function checkLogin() {

    try {

        const response =
            await fetch(
                "/api/me"
            );

        const data =
            await response.json();

        if (
            response.ok &&
            data.loggedIn &&
            data.user
        ) {

            setupAdminNav(
                data.user
            );

            showApp();

        } else {

            showAuth();

        }

    } catch (error) {

        console.error(
            "SESSION ERROR:",
            error
        );

        showAuth();

    }

}


/* ==================================================
SHOW AUTH
================================================== */

function showAuth() {

    const auth =
        document.getElementById(
            "auth-section"
        );

    const app =
        document.getElementById(
            "app-section"
        );

    const logoutButton =
        document.getElementById(
            "logout-button"
        );

    const adminNav =
        document.getElementById(
            "admin-nav"
        );

    if (auth) {

        auth.style.display =
            "block";

    }

    if (app) {

        app.style.display =
            "none";

    }

    if (logoutButton) {

        logoutButton.style.display =
            "none";

    }

    if (adminNav) {

        adminNav.style.display =
            "none";

    }

}


/* ==================================================
ADMIN BUTTON
================================================== */

async function checkAdmin() {

    const adminButton =
        document.getElementById(
            "admin-button"
        );

    if (!adminButton) {
        return;
    }

    adminButton.style.display =
        "none";

    try {

        const response =
            await fetch(
                "/api/admin/check"
            );

        const data =
            await response.json();

        if (
            response.ok &&
            data.isAdmin === true
        ) {

            adminButton.style.display =
                "inline-block";

        } else {

            adminButton.style.display =
                "none";

        }

    } catch (error) {

        console.error(
            "ADMIN BUTTON ERROR:",
            error
        );

        adminButton.style.display =
            "none";

    }

}


/* ==================================================
SHOW APP
================================================== */

function showApp() {

    const auth =
        document.getElementById(
            "auth-section"
        );

    const app =
        document.getElementById(
            "app-section"
        );

    const logoutButton =
        document.getElementById(
            "logout-button"
        );

    if (auth) {

        auth.style.display =
            "none";

    }

    if (app) {

        app.style.display =
            "block";

    }

    if (logoutButton) {

        logoutButton.style.display =
            "inline-block";

    }

    loadPosts();

    loadPeople();

    loadLeaderboard();

    updateOnlineStatus();

    checkAdmin();

}


/* ==================================================
LOGOUT
================================================== */

async function logout() {

    try {

        await fetch(
            "/api/logout",
            {
                method:
                    "POST"
            }
        );

    } catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );

    }

    showAuth();

}


/* ==================================================
LOAD POSTS
================================================== */

async function loadPosts() {

    const container =
        document.getElementById(
            "posts"
        );

    if (!container) {
        return;
    }

    try {

        const response =
            await fetch(
                "/api/posts"
            );

        const posts =
            await response.json();

        if (!response.ok) {

            throw new Error(
                posts.error ||
                "Could not load posts."
            );

        }

        if (!posts.length) {

            container.innerHTML =
                "<p>No posts yet. Be the first! 🧌</p>";

            return;

        }

        container.innerHTML =
            posts.map(post => {

                const avatar =
                    post.avatar ||
                    "/default-avatar.png";

                const displayName =
                    post.display_name ||
                    post.username ||
                    "User";

                let imageHTML =
                    "";

                if (post.image_url) {

                    imageHTML = `

                        <div
                            class="post-image-container"
                            style="
                                margin-top:12px;
                            ">

                            <img
                                src="${escapeHtml(
                                    post.image_url
                                )}"
                                alt="Post image"
                                style="
                                    max-width:100%;
                                    max-height:600px;
                                    border-radius:12px;
                                    object-fit:contain;
                                    display:block;
                                ">

                        </div>

                    `;

                }

                return `

                    <article
                        class="post">

                        <div
                            class="post-header"
                            style="
                                display:flex;
                                align-items:center;
                                gap:10px;
                            ">

                            <img
                                src="${escapeHtml(
                                    avatar
                                )}"
                                alt="Avatar"
                                style="
                                    width:45px;
                                    height:45px;
                                    border-radius:50%;
                                    object-fit:cover;
                                "
                                onerror="
                                    this.src='/default-avatar.png';
                                ">

                            <a
                                href="/profile.html?id=${encodeURIComponent(
                                    post.user_id
                                )}"
                                style="
                                    text-decoration:none;
                                    color:inherit;
                                ">

                                <strong>
                                    ${escapeHtml(
                                        displayName
                                    )}
                                </strong>

                                <div>
                                    @${escapeHtml(
                                        post.username ||
                                        "user"
                                    )}
                                </div>

                            </a>

                        </div>

                        ${
                            post.content
                                ? `

                                    <div
                                        class="post-content"
                                        style="
                                            margin-top:10px;
                                        ">

                                        ${escapeHtml(
                                            post.content
                                        )}

                                    </div>

                                  `
                                : ""
                        }

                        ${imageHTML}

                        <button
                            onclick="
                                toggleComments(
                                    '${escapeHtml(post.id)}'
                                )
                            ">

                            💬 Comments

                        </button>

                        <div
                            id="comments-${escapeHtml(post.id)}"
                            class="comments"
                            style="
                                display:none;
                            ">

                            <div
                                id="comment-list-${escapeHtml(post.id)}">

                                Loading...

                            </div>

                            <div
                                class="comment-form"
                                style="
                                    margin-top:10px;
                                ">

                                <input
                                    id="comment-input-${escapeHtml(post.id)}"
                                    placeholder="Write a comment..."
                                    maxlength="500">

                                <input
                                    id="comment-image-${escapeHtml(post.id)}"
                                    type="file"
                                    accept="
                                        image/png,
                                        image/jpeg,
                                        image/webp,
                                        image/gif
                                    ">

                                <button
                                    onclick="
                                        submitComment(
                                            '${escapeHtml(post.id)}'
                                        )
                                    ">

                                    Send

                                </button>

                                <div
                                    id="comment-preview-${escapeHtml(post.id)}"
                                    style="
                                        display:none;
                                        margin-top:8px;
                                    ">

                                    <img
                                        id="comment-preview-image-${escapeHtml(post.id)}"
                                        alt="Comment image preview"
                                        style="
                                            max-width:200px;
                                            max-height:200px;
                                            border-radius:10px;
                                        ">

                                    <br>

                                    <button
                                        type="button"
                                        onclick="
                                            clearCommentImage(
                                                '${escapeHtml(post.id)}'
                                            )
                                        ">

                                        ❌ Remove image

                                    </button>

                                </div>

                            </div>

                        </div>

                    </article>

                `;

            }).join("");


        posts.forEach(post => {

            const input =
                document.getElementById(
                    `comment-image-${post.id}`
                );

            const preview =
                document.getElementById(
                    `comment-preview-${post.id}`
                );

            const previewImage =
                document.getElementById(
                    `comment-preview-image-${post.id}`
                );

            if (!input) {
                return;
            }

            input.addEventListener(
                "change",
                () => {

                    const file =
                        input.files[0];

                    if (!file) {

                        preview.style.display =
                            "none";

                        return;

                    }

                    if (
                        !file.type.startsWith(
                            "image/"
                        )
                    ) {

                        alert(
                            "❌ Please choose an image."
                        );

                        input.value =
                            "";

                        return;

                    }

                    if (
                        file.size >
                        5 * 1024 * 1024
                    ) {

                        alert(
                            "❌ Image must be under 5MB."
                        );

                        input.value =
                            "";

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

        });

    } catch (error) {

        console.error(
            "POST ERROR:",
            error
        );

        container.innerHTML =
            `<p>❌ ${escapeHtml(
                error.message
            )}</p>`;

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

    const imageInput =
        document.getElementById(
            "post-image"
        );

    const status =
        document.getElementById(
            "post-status"
        );

    const content =
        input?.value.trim() ||
        "";

    const file =
        imageInput?.files?.[0] ||
        null;

    if (!content && !file) {

        status.textContent =
            "❌ Write something or select an image.";

        return;

    }

    status.textContent =
        "Posting...";

    try {

        const image =
            await prepareImage(file);

        const response =
            await fetch(
                "/api/posts",
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            content:
                                content,

                            image:
                                image

                        })

                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not create post."
            );

        }

        input.value =
            "";

        if (imageInput) {

            imageInput.value =
                "";

        }

        const preview =
            document.getElementById(
                "post-image-preview"
            );

        const previewImage =
            document.getElementById(
                "post-preview-image"
            );

        if (preview) {

            preview.style.display =
                "none";

        }

        if (previewImage) {

            previewImage.src =
                "";

        }

        status.textContent =
            "✅ Posted!";

        loadPosts();

        /*
         * Refresh leaderboard because
         * the user now has another post.
         */

        loadLeaderboard();

    } catch (error) {

        console.error(
            "CREATE POST ERROR:",
            error
        );

        status.textContent =
            "❌ " +
            error.message;

    }

}


/* ==================================================
TOGGLE COMMENTS
================================================== */

async function toggleComments(postId) {

    const box =
        document.getElementById(
            `comments-${postId}`
        );

    if (!box) {
        return;
    }

    if (
        box.style.display ===
        "none"
    ) {

        box.style.display =
            "block";

        loadComments(
            postId
        );

    } else {

        box.style.display =
            "none";

    }

}


/* ==================================================
LOAD COMMENTS
================================================== */

async function loadComments(postId) {

    const list =
        document.getElementById(
            `comment-list-${postId}`
        );

    if (!list) {
        return;
    }

    try {

        const response =
            await fetch(
                `/api/posts/${postId}/comments`
            );

        const comments =
            await response.json();

        if (!response.ok) {

            throw new Error(
                comments.error ||
                "Could not load comments."
            );

        }

        if (!comments.length) {

            list.innerHTML =
                "<p>No comments yet 😼</p>";

            return;

        }

        list.innerHTML =
            comments.map(comment => {

                const avatar =
                    comment.avatar ||
                    "/default-avatar.png";

                const displayName =
                    comment.display_name ||
                    comment.username ||
                    "User";

                let imageHTML =
                    "";

                if (comment.image_url) {

                    imageHTML = `

                        <img
                            src="${escapeHtml(
                                comment.image_url
                            )}"
                            alt="Comment image"
                            style="
                                max-width:300px;
                                max-height:300px;
                                border-radius:10px;
                                margin-top:8px;
                                display:block;
                            "
                            onerror="
                                this.style.display='none';
                            ">

                    `;

                }

                return `

                    <div
                        class="comment"
                        style="
                            padding:10px;
                            margin-bottom:10px;
                        ">

                        <div
                            style="
                                display:flex;
                                align-items:center;
                                gap:8px;
                            ">

                            <img
                                src="${escapeHtml(
                                    avatar
                                )}"
                                alt="Avatar"
                                style="
                                    width:35px;
                                    height:35px;
                                    border-radius:50%;
                                    object-fit:cover;
                                "
                                onerror="
                                    this.src='/default-avatar.png';
                                ">

                            <strong>

                                ${escapeHtml(
                                    displayName
                                )}

                            </strong>

                        </div>

                        ${
                            comment.content
                                ? `

                                    <p>
                                        ${escapeHtml(
                                            comment.content
                                        )}
                                    </p>

                                  `
                                : ""
                        }

                        ${imageHTML}

                    </div>

                `;

            }).join("");

    } catch (error) {

        console.error(
            "COMMENTS ERROR:",
            error
        );

        list.innerHTML =
            `<p>❌ ${escapeHtml(
                error.message
            )}</p>`;

    }

}


/* ==================================================
SUBMIT COMMENT
================================================== */

async function submitComment(postId) {

    const input =
        document.getElementById(
            `comment-input-${postId}`
        );

    const imageInput =
        document.getElementById(
            `comment-image-${postId}`
        );

    const content =
        input?.value.trim() ||
        "";

    const file =
        imageInput?.files?.[0] ||
        null;

    if (!content && !file) {
        return;
    }

    try {

        const image =
            await prepareImage(file);

        const response =
            await fetch(
                `/api/posts/${postId}/comments`,
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            content:
                                content,

                            image:
                                image

                        })

                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not comment."
            );

        }

        input.value =
            "";

        if (imageInput) {

            imageInput.value =
                "";

        }

        clearCommentImage(
            postId
        );

        loadComments(
            postId
        );

        /*
         * Refresh leaderboard because
         * the user has made another comment.
         */

        loadLeaderboard();

    } catch (error) {

        console.error(
            "COMMENT ERROR:",
            error
        );

        alert(
            "❌ " +
            error.message
        );

    }

}


/* ==================================================
CLEAR COMMENT IMAGE
================================================== */

function clearCommentImage(postId) {

    const input =
        document.getElementById(
            `comment-image-${postId}`
        );

    const preview =
        document.getElementById(
            `comment-preview-${postId}`
        );

    const previewImage =
        document.getElementById(
            `comment-preview-image-${postId}`
        );

    if (input) {

        input.value =
            "";

    }

    if (previewImage) {

        previewImage.src =
            "";

    }

    if (preview) {

        preview.style.display =
            "none";

    }

}


/* ==================================================
PEOPLE
================================================== */

async function loadPeople() {

    const container =
        document.getElementById(
            "people"
        );

    if (!container) {
        return;
    }

    try {

        const response =
            await fetch(
                "/api/users"
            );

        const users =
            await response.json();

        if (!response.ok) {

            throw new Error(
                users.error ||
                "Could not load people."
            );

        }

        if (!users.length) {

            container.innerHTML =
                "<p>No users yet. 🧌</p>";

            return;

        }

        container.innerHTML =
            users.map(user => {

                const avatar =
                    user.avatar ||
                    "/default-avatar.png";

                const displayName =
                    user.display_name ||
                    user.username ||
                    "User";

                const isOnline =
                    user.last_seen &&
                    (
                        Date.now() -
                        new Date(
                            user.last_seen
                        ).getTime()
                    ) < 120000;

                return `

                    <a
                        href="/profile.html?id=${encodeURIComponent(
                            user.id
                        )}"
                        class="person"
                        style="
                            text-decoration:none;
                            color:inherit;
                            display:flex;
                            align-items:center;
                            gap:12px;
                        ">

                        <div
                            style="
                                position:relative;
                                width:50px;
                                height:50px;
                                flex-shrink:0;
                            ">

                            <img
                                class="avatar"
                                src="${escapeHtml(
                                    avatar
                                )}"
                                alt="Avatar"
                                style="
                                    width:50px;
                                    height:50px;
                                    border-radius:50%;
                                    object-fit:cover;
                                    display:block;
                                "
                                onerror="
                                    this.src='/default-avatar.png';
                                ">

                            <span
                                title="${
                                    isOnline
                                        ? "Online"
                                        : "Offline"
                                }"
                                style="
                                    position:absolute;
                                    right:-2px;
                                    bottom:-2px;
                                    width:14px;
                                    height:14px;
                                    border-radius:50%;
                                    background:${
                                        isOnline
                                            ? "#22c55e"
                                            : "#888"
                                    };
                                    border:2px solid white;
                                    box-sizing:border-box;
                                ">
                            </span>

                        </div>

                        <div>

                            <strong>
                                ${escapeHtml(
                                    displayName
                                )}
                            </strong>

                            <p>
                                @${escapeHtml(
                                    user.username
                                )}
                            </p>

                        </div>

                    </a>

                `;

            }).join("");

    } catch (error) {

        console.error(
            "PEOPLE ERROR:",
            error
        );

        container.innerHTML =
            `<p>❌ ${escapeHtml(
                error.message
            )}</p>`;

    }

}


/* ==================================================
LEADERBOARD
================================================== */

let leaderboardData = [];

let currentLeaderboardCategory =
    "overall";


/* ==================================================
SCROLL TO SECTION
================================================== */

function scrollToSection(id) {

    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }

    element.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


/* ==================================================
GET REACTION COUNT
================================================== */

function getReactionCount(user, type) {

    /*
     * Your current /api/users endpoint may expose
     * reactionCounts, while some older versions
     * exposed the values directly on the user.
     *
     * Support both formats.
     */

    if (
        user.reactionCounts &&
        typeof user.reactionCounts === "object"
    ) {

        const value =
            Number(
                user.reactionCounts[type]
            );

        if (Number.isFinite(value)) {
            return value;
        }

    }

    const direct =
        Number(
            user[type]
        );

    if (Number.isFinite(direct)) {
        return direct;
    }

    return 0;

}


/* ==================================================
LOAD LEADERBOARD
================================================== */

async function loadLeaderboard() {

    const container =
        document.getElementById(
            "leaderboard-list"
        );

    if (!container) {
        return;
    }

    container.innerHTML =
        `<div class="leaderboard-loading">
            Loading leaderboard... 🧌
        </div>`;

    try {

        /*
         * Load users and posts at the same time.
         */

        const [
            usersResponse,
            postsResponse
        ] = await Promise.all([

            fetch("/api/users"),

            fetch("/api/posts")

        ]);

        const users =
            await usersResponse.json();

        const posts =
            await postsResponse.json();

        if (!usersResponse.ok) {

            throw new Error(
                users.error ||
                "Could not load users."
            );

        }

        if (!postsResponse.ok) {

            throw new Error(
                posts.error ||
                "Could not load posts."
            );

        }


        /*
         * Create a statistics object for
         * every user.
         */

        const stats =
            users.map(user => {

                const cat =
                    getReactionCount(
                        user,
                        "cat"
                    );

                const gyatt =
                    getReactionCount(
                        user,
                        "gyatt"
                    );

                const ogred =
                    getReactionCount(
                        user,
                        "ogred"
                    );

                const reactions =
                    getReactionCount(
                        user,
                        "reactions"
                    ) ||
                    (
                        cat +
                        gyatt +
                        ogred
                    );

                const userPosts =
                    posts.filter(
                        post =>
                            String(
                                post.user_id
                            ) ===
                            String(
                                user.id
                            )
                    ).length;

                return {

                    id:
                        user.id,

                    username:
                        user.username,

                    display_name:
                        user.display_name ||
                        user.username ||
                        "User",

                    avatar:
                        user.avatar ||
                        "/default-avatar.png",

                    posts:
                        userPosts,

                    comments:
                        0,

                    reactions:
                        reactions,

                    cat:
                        cat,

                    gyatt:
                        gyatt,

                    ogred:
                        ogred,

                    overall:
                        (
                            userPosts * 10
                        ) +
                        (
                            0 * 5
                        ) +
                        (
                            reactions * 2
                        )

                };

            });


        /*
         * Count comments.
         *
         * Each post's comments are fetched so we
         * can determine who made them.
         */

        await Promise.all(

            posts.map(
                async post => {

                    try {

                        const response =
                            await fetch(
                                `/api/posts/${post.id}/comments`
                            );

                        if (!response.ok) {
                            return;
                        }

                        const comments =
                            await response.json();

                        if (!Array.isArray(
                            comments
                        )) {
                            return;
                        }

                        comments.forEach(
                            comment => {

                                const authorId =
                                    comment.user_id;

                                const userStats =
                                    stats.find(
                                        user =>
                                            String(
                                                user.id
                                            ) ===
                                            String(
                                                authorId
                                            )
                                    );

                                if (
                                    userStats
                                ) {

                                    userStats.comments++;

                                }

                            }
                        );

                    } catch (error) {

                        console.warn(
                            "Could not load comments for post:",
                            post.id
                        );

                    }

                }
            )

        );


        /*
         * Recalculate overall after comments
         * have been counted.
         */

        stats.forEach(
            user => {

                user.overall =
                    (
                        user.posts * 10
                    ) +
                    (
                        user.comments * 5
                    ) +
                    (
                        user.reactions * 2
                    );

            }
        );


        leaderboardData =
            stats;

        renderLeaderboard();

    } catch (error) {

        console.error(
            "LEADERBOARD ERROR:",
            error
        );

        container.innerHTML =
            `<p>
                ❌ ${escapeHtml(
                    error.message
                )}
            </p>`;

    }

}


/* ==================================================
SWITCH LEADERBOARD
================================================== */

function switchLeaderboard(category) {

    currentLeaderboardCategory =
        category;

    /*
     * Update active button.
     */

    document
        .querySelectorAll(
            ".leaderboard-switch"
        )
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.category ===
                category
            );

        });

    renderLeaderboard();

}


/* ==================================================
RENDER LEADERBOARD
================================================== */

function renderLeaderboard() {

    const container =
        document.getElementById(
            "leaderboard-list"
        );

    if (!container) {
        return;
    }

    if (!leaderboardData.length) {

        container.innerHTML =
            "<p>No leaderboard data yet. 🧌</p>";

        return;

    }

    /*
     * Sort a copy so the original statistics
     * aren't destroyed.
     */

    const sorted =
        [...leaderboardData].sort(
            (a, b) => {

                const difference =
                    Number(
                        b[
                            currentLeaderboardCategory
                        ]
                    ) -
                    Number(
                        a[
                            currentLeaderboardCategory
                        ]
                    );

                /*
                 * If tied, use username as a
                 * consistent secondary sort.
                 */

                if (difference !== 0) {
                    return difference;
                }

                return String(
                    a.username || ""
                ).localeCompare(
                    String(
                        b.username || ""
                    )
                );

            }
        );


    /*
     * TOP FIVE ONLY.
     */

    const topFive =
        sorted.slice(0, 5);


    container.innerHTML =
        topFive.map(
            (user, index) => {

                const rank =
                    index + 1;

                let medal =
                    `${rank}.`;

                let positionClass =
                    "";

                if (rank === 1) {

                    medal =
                        "🥇";

                    positionClass =
                        "first";

                }

                if (rank === 2) {

                    medal =
                        "🥈";

                    positionClass =
                        "second";

                }

                if (rank === 3) {

                    medal =
                        "🥉";

                    positionClass =
                        "third";

                }

                const score =
                    Number(
                        user[
                            currentLeaderboardCategory
                        ]
                    ) || 0;

                return `

                    <a
                        href="/profile.html?id=${encodeURIComponent(
                            user.id
                        )}"
                        class="
                            leaderboard-entry
                            ${positionClass}
                        "
                        style="
                            text-decoration:none;
                            color:inherit;
                        ">

                        <div
                            class="leaderboard-rank">

                            ${medal}

                        </div>

                        <img
                            src="${escapeHtml(
                                user.avatar
                            )}"
                            alt="Avatar"
                            style="
                                width:50px;
                                height:50px;
                                border-radius:50%;
                                object-fit:cover;
                                flex-shrink:0;
                            "
                            onerror="
                                this.src='/default-avatar.png';
                            ">

                        <div
                            class="leaderboard-user">

                            <div
                                class="leaderboard-name">

                                ${escapeHtml(
                                    user.display_name
                                )}

                            </div>

                            <div
                                style="
                                    color:#777;
                                    font-size:13px;
                                ">

                                @${escapeHtml(
                                    user.username ||
                                    "user"
                                )}

                            </div>

                        </div>

                        <div
                            class="leaderboard-score">

                            <strong>
                                ${score}
                            </strong>

                        </div>

                    </a>

                `;

            }
        ).join("");

}


/* ==================================================
ENTER KEY FOR COMMENTS
================================================== */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key !== "Enter" ||
            event.shiftKey
        ) {

            return;

        }

        const target =
            event.target;

        if (
            target &&
            target.id &&
            target.id.startsWith(
                "comment-input-"
            )
        ) {

            event.preventDefault();

            const postId =
                target.id.replace(
                    "comment-input-",
                    ""
                );

            submitComment(
                postId
            );

        }

    }
);


/* ==================================================
ONLINE STATUS
================================================== */

async function updateOnlineStatus() {

    try {

        const response =
            await fetch(
                "/api/online",
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    }

                }
            );

        if (!response.ok) {

            if (response.status !== 404) {

                console.warn(
                    "Online status request failed:",
                    response.status
                );

            }

            return;

        }

    } catch (error) {

        console.warn(
            "Online heartbeat unavailable."
        );

    }

}


/* ==================================================
START
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        checkLogin();

    }
);


/* ==================================================
ONLINE HEARTBEAT
================================================== */

setTimeout(
    updateOnlineStatus,
    1000
);

setInterval(
    updateOnlineStatus,
    30000
);