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

        /*
         * Refresh session data after login
         * so admin status is detected.
         */

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

    /*
     * Detect admin using several possible
     * backend field names.
     */

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

    /*
     * Look for an admin navigation element
     * that already exists in the HTML.
     */

    let adminNav =
        document.getElementById(
            "admin-nav"
        );

    /*
     * If the user isn't an admin,
     * hide the existing admin navigation.
     */

    if (!isAdmin) {

        if (adminNav) {

            adminNav.style.display =
                "none";

        }

        return;

    }

    /*
     * If the HTML already contains the
     * admin navigation, just show it.
     */

    if (adminNav) {

        adminNav.style.display =
            "flex";

        return;

    }

    /*
     * Create the admin navbar automatically.
     */

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

    /*
     * Put navbar at the top of the app.
     */

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

            /*
             * Detect admin status.
             */

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

    updateOnlineStatus();

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

                /*
                 * Online if last_seen is less
                 * than 2 minutes old.
                 */

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

            /*
             * Don't spam the console if the
             * backend route doesn't exist.
             */

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