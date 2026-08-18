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
                (data.error || "Could not react.")
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

    if (
        file.size >
        5 * 1024 * 1024
    ) {

        throw new Error(
            "Image must be under 5MB."
        );

    }

    const data =
        await fileToBase64(file);

    return {

        data:
            data,

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

    const emailInput =
        document.getElementById(
            "login-email"
        );

    const passwordInput =
        document.getElementById(
            "login-password"
        );

    const status =
        document.getElementById(
            "login-status"
        );

    if (!emailInput || !passwordInput) {

        console.error(
            "Login inputs not found."
        );

        return;

    }

    const email =
        emailInput.value.trim();

    const password =
        passwordInput.value;

    if (!email || !password) {

        if (status) {

            status.textContent =
                "❌ Enter your email and password.";

        }

        return;

    }

    if (status) {

        status.textContent =
            "Logging in...";

    }

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

        if (status) {

            status.textContent =
                "✅ Logged in!";

        }

        showApp();

    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );

        if (status) {

            status.textContent =
                "❌ " +
                error.message;

        }

    }

}


/* ==================================================
SIGNUP
================================================== */

async function signup() {

    const usernameInput =
        document.getElementById(
            "signup-username"
        );

    const displayNameInput =
        document.getElementById(
            "signup-display-name"
        );

    const emailInput =
        document.getElementById(
            "signup-email"
        );

    const passwordInput =
        document.getElementById(
            "signup-password"
        );

    const status =
        document.getElementById(
            "signup-status"
        );

    if (
        !usernameInput ||
        !emailInput ||
        !passwordInput
    ) {

        console.error(
            "Signup inputs not found."
        );

        return;

    }

    const username =
        usernameInput.value.trim();

    const displayName =
        displayNameInput?.value.trim() ||
        "";

    const email =
        emailInput.value.trim();

    const password =
        passwordInput.value;

    if (
        !username ||
        !email ||
        !password
    ) {

        if (status) {

            status.textContent =
                "❌ Fill in all required fields.";

        }

        return;

    }

    if (status) {

        status.textContent =
            "Creating account...";

    }

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

        if (status) {

            status.textContent =
                "✅ Account created!";

        }

        showLogin();

    } catch (error) {

        console.error(
            "SIGNUP ERROR:",
            error
        );

        if (status) {

            status.textContent =
                "❌ " +
                error.message;

        }

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

    /*
     * Send an online heartbeat immediately
     * after confirming that the user is logged in.
     */

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
                                "
                                onerror="
                                    this.style.display='none';
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
                                    '${escapeHtml(
                                        post.id
                                    )}'
                                )
                            ">

                            💬 Comments

                        </button>

                        <div
                            id="comments-${escapeHtml(
                                post.id
                            )}"
                            class="comments"
                            style="
                                display:none;
                            ">

                            <div
                                id="comment-list-${escapeHtml(
                                    post.id
                                )}">

                                Loading...

                            </div>

                            <div
                                class="comment-form"
                                style="
                                    margin-top:10px;
                                ">

                                <input
                                    id="comment-input-${escapeHtml(
                                        post.id
                                    )}"
                                    placeholder="Write a comment..."
                                    maxlength="500">

                                <input
                                    id="comment-image-${escapeHtml(
                                        post.id
                                    )}"
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
                                            '${escapeHtml(
                                                post.id
                                            )}'
                                        )
                                    ">

                                    Send

                                </button>

                                <div
                                    id="comment-preview-${escapeHtml(
                                        post.id
                                    )}"
                                    style="
                                        display:none;
                                        margin-top:8px;
                                    ">

                                    <img
                                        id="comment-preview-image-${escapeHtml(
                                            post.id
                                        )}"
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
                                                '${escapeHtml(
                                                    post.id
                                                )}'
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


        /*
         * Setup comment image previews
         */

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

                        if (preview) {
                            preview.style.display =
                                "none";
                        }

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

                            if (previewImage) {

                                previewImage.src =
                                    event.target.result;

                            }

                            if (preview) {

                                preview.style.display =
                                    "block";

                            }

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

        if (status) {

            status.textContent =
                "❌ Write something or select an image.";

        }

        return;

    }

    if (status) {

        status.textContent =
            "Posting...";

    }

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

        if (input) {

            input.value =
                "";

        }

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

        if (status) {

            status.textContent =
                "✅ Posted!";

        }

        loadPosts();

    } catch (error) {

        console.error(
            "CREATE POST ERROR:",
            error
        );

        if (status) {

            status.textContent =
                "❌ " +
                error.message;

        }

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

        if (input) {

            input.value =
                "";

        }

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
                            "
                            onerror="
                                this.src='/default-avatar.png';
                            ">

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
ONLINE HEARTBEAT
================================================== */

async function updateOnlineStatus() {

    try {

        const response =
            await fetch(
                "/api/heartbeat",
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );

        /*
         * 401 simply means the user isn't logged in.
         * Don't spam the console with it.
         */

        if (
            !response.ok &&
            response.status !== 401
        ) {

            console.error(
                "Heartbeat failed:",
                response.status
            );

        }

    } catch (error) {

        console.error(
            "Heartbeat failed:",
            error
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
ONLINE HEARTBEAT TIMER
================================================== */

setInterval(
    updateOnlineStatus,
    30000
);