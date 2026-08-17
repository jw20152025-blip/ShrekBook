/* ==================================================
   SHREKBOOK - COMPLETE SCRIPT.JS
   ================================================== */

let currentUser = null;


/* ==================================================
   DEFAULT AVATAR
   ================================================== */

// We use a built-in SVG instead of requesting
// /default-avatar.png, so there is no 404.
const DEFAULT_AVATAR =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg"
             width="200"
             height="200"
             viewBox="0 0 200 200">

            <rect width="200"
                  height="200"
                  fill="#7fbf3f"/>

            <circle
                cx="100"
                cy="78"
                r="45"
                fill="#9bd45a"/>

            <ellipse
                cx="70"
                cy="35"
                rx="18"
                ry="12"
                fill="#9bd45a"/>

            <ellipse
                cx="130"
                cy="35"
                rx="18"
                ry="12"
                fill="#9bd45a"/>

            <circle
                cx="83"
                cy="75"
                r="7"
                fill="#222"/>

            <circle
                cx="117"
                cy="75"
                r="7"
                fill="#222"/>

            <path
                d="M75 105 Q100 120 125 105"
                fill="none"
                stroke="#222"
                stroke-width="5"
                stroke-linecap="round"/>

            <text
                x="100"
                y="170"
                text-anchor="middle"
                font-size="20"
                font-family="Arial">
                🧌
            </text>

        </svg>
    `);


/* ==================================================
   HELPERS
   ================================================== */

function getAvatar(avatar) {

    if (
        typeof avatar === "string" &&
        avatar.trim() !== ""
    ) {
        return avatar;
    }

    return DEFAULT_AVATAR;
}


function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatDate(dateString) {

    if (!dateString) {
        return "";
    }

    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleString();
}


/* ==================================================
   ONLINE STATUS
   ================================================== */

async function sendHeartbeat() {

    try {

        const response = await fetch(
            "/api/heartbeat",
            {
                method: "POST",
                credentials: "include"
            }
        );

        if (response.status === 401) {
            return;
        }

        if (!response.ok) {

            console.log(
                "Heartbeat failed:",
                response.status
            );

        }

    } catch (error) {

        console.error(
            "HEARTBEAT ERROR:",
            error
        );

    }
}


/*
   Send heartbeat immediately,
   then every 30 seconds.
*/

sendHeartbeat();

setInterval(
    sendHeartbeat,
    30000
);


/*
   Refresh the People list every 30 seconds too.
   This is important because the green dots need
   to update when somebody comes online/offline.
*/

setInterval(
    async () => {

        if (currentUser) {
            await loadPeople();
        }

    },
    30000
);


/* ==================================================
   LOGIN / AUTH UI
   ================================================== */

function showLogin() {

    const loginBox =
        document.getElementById("login-box");

    const signupBox =
        document.getElementById("signup-box");

    if (loginBox) {
        loginBox.style.display = "block";
    }

    if (signupBox) {
        signupBox.style.display = "none";
    }
}


function showSignup() {

    const loginBox =
        document.getElementById("login-box");

    const signupBox =
        document.getElementById("signup-box");

    if (loginBox) {
        loginBox.style.display = "none";
    }

    if (signupBox) {
        signupBox.style.display = "block";
    }
}


/* ==================================================
   LOGIN
   ================================================== */

async function login() {

    const email =
        document.getElementById(
            "login-email"
        )?.value.trim();

    const password =
        document.getElementById(
            "login-password"
        )?.value;

    const status =
        document.getElementById(
            "login-status"
        );

    if (!email || !password) {

        if (status) {
            status.textContent =
                "❌ Enter your email and password.";
        }

        return;
    }

    if (status) {
        status.textContent =
            "🔐 Logging in...";
    }

    try {

        const response =
            await fetch(
                "/api/login",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({
                        email,
                        password
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            if (status) {
                status.textContent =
                    "❌ " +
                    (data.error ||
                        "Login failed.");
            }

            return;
        }

        currentUser =
            data.user;

        if (status) {
            status.textContent =
                "✅ Login successful!";
        }

        await refreshApp();

    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );

        if (status) {
            status.textContent =
                "❌ Could not connect to server.";
        }

    }
}


/* ==================================================
   SIGNUP
   ================================================== */

async function signup() {

    const username =
        document.getElementById(
            "signup-username"
        )?.value.trim();

    const display_name =
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
        )?.value;

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
                "❌ Please fill in all required fields.";
        }

        return;
    }

    if (status) {
        status.textContent =
            "📝 Creating account...";
    }

    try {

        const response =
            await fetch(
                "/api/signup",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({

                        username,

                        display_name:
                            display_name ||
                            username,

                        email,

                        password

                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            if (status) {
                status.textContent =
                    "❌ " +
                    (data.error ||
                        "Signup failed.");
            }

            return;
        }

        if (status) {
            status.textContent =
                "✅ Account created! You can now log in.";
        }

        document.getElementById(
            "login-email"
        ).value = email;

        showLogin();

    } catch (error) {

        console.error(
            "SIGNUP ERROR:",
            error
        );

        if (status) {
            status.textContent =
                "❌ Could not connect to server.";
        }

    }
}


/* ==================================================
   LOGOUT
   ================================================== */

async function logout() {

    try {

        await fetch(
            "/api/logout",
            {
                method: "POST",
                credentials: "include"
            }
        );

    } catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );

    }

    currentUser = null;

    const appSection =
        document.getElementById(
            "app-section"
        );

    const authSection =
        document.getElementById(
            "auth-section"
        );

    const logoutButton =
        document.getElementById(
            "logout-button"
        );

    if (appSection) {
        appSection.style.display = "none";
    }

    if (authSection) {
        authSection.style.display = "block";
    }

    if (logoutButton) {
        logoutButton.style.display = "none";
    }

    showLogin();
}


/* ==================================================
   CHECK CURRENT USER
   ================================================== */

async function checkLogin() {

    try {

        const response =
            await fetch(
                "/api/me",
                {
                    credentials: "include"
                }
            );

        const data =
            await response.json();

        if (
            response.ok &&
            data.loggedIn
        ) {

            currentUser =
                data.user;

            await refreshApp();

            return true;
        }

        currentUser = null;

        showLoggedOut();

        return false;

    } catch (error) {

        console.error(
            "CHECK LOGIN ERROR:",
            error
        );

        showLoggedOut();

        return false;
    }
}


/* ==================================================
   SHOW LOGGED OUT
   ================================================== */

function showLoggedOut() {

    const appSection =
        document.getElementById(
            "app-section"
        );

    const authSection =
        document.getElementById(
            "auth-section"
        );

    const logoutButton =
        document.getElementById(
            "logout-button"
        );

    if (appSection) {
        appSection.style.display =
            "none";
    }

    if (authSection) {
        authSection.style.display =
            "block";
    }

    if (logoutButton) {
        logoutButton.style.display =
            "none";
    }
}


/* ==================================================
   SHOW LOGGED IN
   ================================================== */

function showLoggedIn() {

    const appSection =
        document.getElementById(
            "app-section"
        );

    const authSection =
        document.getElementById(
            "auth-section"
        );

    const logoutButton =
        document.getElementById(
            "logout-button"
        );

    if (appSection) {
        appSection.style.display =
            "block";
    }

    if (authSection) {
        authSection.style.display =
            "none";
    }

    if (logoutButton) {
        logoutButton.style.display =
            "inline-block";
    }
}


/* ==================================================
   REFRESH APP
   ================================================== */

async function refreshApp() {

    showLoggedIn();

    /*
       Make sure our last_seen timestamp is
       updated immediately after login.
    */

    await sendHeartbeat();

    await Promise.all([
        loadPosts(),
        loadPeople()
    ]);
}


/* ==================================================
   LOAD PEOPLE
   ================================================== */

async function loadPeople() {

    const people =
        document.getElementById(
            "people"
        );

    if (!people) {
        return;
    }

    try {

        const response =
            await fetch(
                "/api/users",
                {
                    credentials: "include"
                }
            );

        const users =
            await response.json();

        if (!response.ok) {

            people.innerHTML =
                `<p>❌ ${
                    escapeHTML(
                        users.error ||
                        "Could not load people."
                    )
                }</p>`;

            return;
        }

        if (
            !Array.isArray(users) ||
            users.length === 0
        ) {

            people.innerHTML =
                "<p>No users yet.</p>";

            return;
        }

        people.innerHTML =
            users.map(
                renderPerson
            ).join("");

    } catch (error) {

        console.error(
            "LOAD PEOPLE ERROR:",
            error
        );

        people.innerHTML =
            "<p>❌ Could not load people.</p>";
    }
}


/* ==================================================
   RENDER PERSON
   ================================================== */

function renderPerson(user) {

    const avatar =
        getAvatar(user.avatar);

    /*
       THIS IS THE IMPORTANT PART.

       The server sends:

       online: true

       or

       online: false

       We turn that into a green/gray dot.
    */

    const online =
        user.online === true;

    const onlineDot =
        online
            ? `
                <span
                    class="online-dot online"
                    title="Online">
                </span>
              `
            : `
                <span
                    class="online-dot offline"
                    title="Offline">
                </span>
              `;

    const onlineText =
        online
            ? "Online"
            : "Offline";

    const safeId =
        encodeURIComponent(
            user.id
        );

    return `
        <div
            class="person-card"
            data-user-id="${escapeHTML(user.id)}">

            <a
                href="/profile.html?id=${safeId}"
                class="person-link">

                <div class="person-avatar-wrapper">

                    <img
                        class="person-avatar"
                        src="${avatar}"
                        alt="${escapeHTML(
                            user.display_name ||
                            user.username ||
                            "User"
                        )}"
                        onerror="this.src='${DEFAULT_AVATAR}'">

                    ${onlineDot}

                </div>

                <div class="person-info">

                    <h3>
                        ${escapeHTML(
                            user.display_name ||
                            user.username ||
                            "User"
                        )}
                    </h3>

                    <p>
                        @${escapeHTML(
                            user.username ||
                            "user"
                        )}
                    </p>

                    <small class="online-status-text">
                        ${onlineText}
                    </small>

                </div>

            </a>

            <div class="reaction-buttons">

                <button
                    onclick="giveReaction(
                        '${escapeHTML(user.id)}',
                        'gyatt'
                    )">

                    🍑
                    ${user.gyatt || 0}

                </button>

                <button
                    onclick="giveReaction(
                        '${escapeHTML(user.id)}',
                        'cat'
                    )">

                    🐱
                    ${user.cat || 0}

                </button>

                <button
                    onclick="giveReaction(
                        '${escapeHTML(user.id)}',
                        'ogred'
                    )">

                    🧌
                    ${user.ogred || 0}

                </button>

            </div>

        </div>
    `;
}


/* ==================================================
   REACTIONS
   ================================================== */

async function giveReaction(
    userId,
    type
) {

    try {

        const response =
            await fetch(
                `/api/users/${encodeURIComponent(
                    userId
                )}/${type}`,
                {
                    method: "POST",
                    credentials: "include"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            alert(
                "❌ " +
                (
                    data.error ||
                    "Could not give reaction."
                )
            );

            return;
        }

        await loadPeople();

    } catch (error) {

        console.error(
            "REACTION ERROR:",
            error
        );

        alert(
            "❌ Could not connect to server."
        );
    }
}


/* ==================================================
   LOAD POSTS
   ================================================== */

async function loadPosts() {

    const postsContainer =
        document.getElementById(
            "posts"
        );

    if (!postsContainer) {
        return;
    }

    try {

        const response =
            await fetch(
                "/api/posts",
                {
                    credentials: "include"
                }
            );

        const posts =
            await response.json();

        if (!response.ok) {

            postsContainer.innerHTML =
                `<p>❌ ${
                    escapeHTML(
                        posts.error ||
                        "Could not load posts."
                    )
                }</p>`;

            return;
        }

        if (
            !Array.isArray(posts) ||
            posts.length === 0
        ) {

            postsContainer.innerHTML =
                "<p>No posts yet. Be the first! 🧌</p>";

            return;
        }

        postsContainer.innerHTML =
            posts.map(
                renderPost
            ).join("");

        /*
           Comments are dynamically created,
           so attach their image handlers now.
        */

        for (const post of posts) {

            setupCommentImagePreview(
                post.id
            );

            await loadComments(
                post.id
            );
        }

    } catch (error) {

        console.error(
            "LOAD POSTS ERROR:",
            error
        );

        postsContainer.innerHTML =
            "<p>❌ Could not load posts.</p>";
    }
}


/* ==================================================
   RENDER POST
   ================================================== */

function renderPost(post) {

    const avatar =
        getAvatar(post.avatar);

    const image =
        post.image_url
            ? `
                <img
                    class="post-image"
                    src="${escapeHTML(
                        post.image_url
                    )}"
                    alt="Post image"
                    onerror="this.style.display='none'">
              `
            : "";

    return `
        <article
            class="post"
            data-post-id="${escapeHTML(
                post.id
            )}">

            <div class="post-header">

                <a
                    href="/profile.html?id=${encodeURIComponent(
                        post.user_id
                    )}">



                </a>

                <div>

                    <a
                        href="/profile.html?id=${encodeURIComponent(
                            post.user_id
                        )}">

                        <strong>
                            ${escapeHTML(
                                post.display_name ||
                                post.username ||
                                "User"
                            )}
                        </strong>

                    </a>

                    <small>
                        @${escapeHTML(
                            post.username ||
                            "user"
                        )}
                    </small>

                    <small>
                        ${formatDate(
                            post.created_at
                        )}
                    </small>

                </div>

            </div>

            ${
                post.content
                    ? `
                        <div class="post-content">
                            ${escapeHTML(
                                post.content
                            ).replace(
                                /\n/g,
                                "<br>"
                            )}
                        </div>
                      `
                    : ""
            }

            ${image}

            <div
                class="comments"
                id="comments-${escapeHTML(
                    post.id
                )}">

                Loading comments...

            </div>

            <div class="comment-form">

                <textarea
                    id="comment-content-${escapeHTML(
                        post.id
                    )}"
                    maxlength="500"
                    placeholder="Write a comment...">
                </textarea>

                <div>

                    <label>
                        🖼️ Image
                        <input
                            type="file"
                            id="comment-image-${escapeHTML(
                                post.id
                            )}"
                            accept="image/png,image/jpeg,image/webp,image/gif">
                    </label>

                </div>

                <div
                    id="comment-preview-${escapeHTML(
                        post.id
                    )}"
                    style="display:none;">

                    <img
                        id="comment-preview-image-${escapeHTML(
                            post.id
                        )}"
                        style="
                            max-width:300px;
                            max-height:300px;
                            border-radius:12px;
                        ">

                    <button
                        type="button"
                        onclick="clearCommentImage(
                            '${escapeHTML(post.id)}'
                        )">

                        ❌ Remove

                    </button>

                </div>

                <button
                    onclick="createComment(
                        '${escapeHTML(post.id)}'
                    )">

                    💬 Comment

                </button>

            </div>

        </article>
    `;
}


/* ==================================================
   CREATE POST
   ================================================== */

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
        contentInput?.value.trim() || "";

    const file =
        imageInput?.files?.[0];

    if (!content && !file) {

        if (status) {
            status.textContent =
                "❌ Post cannot be empty.";
        }

        return;
    }

    if (file && file.size > 5 * 1024 * 1024) {

        if (status) {
            status.textContent =
                "❌ Image must be under 5MB.";
        }

        return;
    }

    if (status) {
        status.textContent =
            "📝 Posting...";
    }

    try {

        let image = null;

        if (file) {

            const fileData =
                await fileToBase64(file);

            image = {

                name:
                    file.name,

                type:
                    file.type,

                data:
                    fileData

            };
        }

        const response =
            await fetch(
                "/api/posts",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({
                        content,
                        image
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            if (status) {
                status.textContent =
                    "❌ " +
                    (
                        data.error ||
                        "Could not create post."
                    );
            }

            return;
        }

        if (contentInput) {
            contentInput.value = "";
        }

        if (typeof clearPostImage === "function") {
            clearPostImage();
        }

        if (status) {
            status.textContent =
                "✅ Posted!";
        }

        await loadPosts();

    } catch (error) {

        console.error(
            "CREATE POST ERROR:",
            error
        );

        if (status) {
            status.textContent =
                "❌ Could not create post.";
        }
    }
}


/* ==================================================
   FILE -> BASE64
   ================================================== */

function fileToBase64(file) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();

            reader.onload =
                () => {

                    const result =
                        reader.result;

                    /*
                       Remove:
                       data:image/png;base64,
                    */

                    const base64 =
                        String(result)
                            .split(",")[1];

                    resolve(base64);
                };

            reader.onerror =
                reject;

            reader.readAsDataURL(file);
        }
    );
}


/* ==================================================
   LOAD COMMENTS
   ================================================== */

async function loadComments(postId) {

    const container =
        document.getElementById(
            `comments-${postId}`
        );

    if (!container) {
        return;
    }

    try {

        const response =
            await fetch(
                `/api/posts/${encodeURIComponent(
                    postId
                )}/comments`,
                {
                    credentials: "include"
                }
            );

        const comments =
            await response.json();

        if (!response.ok) {

            container.innerHTML =
                `<p>❌ ${
                    escapeHTML(
                        comments.error ||
                        "Could not load comments."
                    )
                }</p>`;

            return;
        }

        if (
            !Array.isArray(comments) ||
            comments.length === 0
        ) {

            container.innerHTML =
                "<p>No comments yet.</p>";

            return;
        }

        container.innerHTML =
            comments.map(
                renderComment
            ).join("");

    } catch (error) {

        console.error(
            "LOAD COMMENTS ERROR:",
            error
        );

        container.innerHTML =
            "<p>❌ Could not load comments.</p>";
    }
}


/* ==================================================
   RENDER COMMENT
   ================================================== */

function renderComment(comment) {

    const avatar =
        getAvatar(comment.avatar);

    const image =
        comment.image_url
            ? `
                <img
                    src="${escapeHTML(
                        comment.image_url
                    )}"
                    style="
                        max-width:300px;
                        max-height:300px;
                        border-radius:12px;
                    "
                    alt="Comment image">
              `
            : "";

    return `
        <div class="comment">

            <img
                class="comment-avatar"
                src="${avatar}"
                alt="Avatar"
                onerror="this.src='${DEFAULT_AVATAR}'">

            <div class="comment-body">

                <div>

                    <strong>
                        ${escapeHTML(
                            comment.display_name ||
                            comment.username ||
                            "User"
                        )}
                    </strong>

                    <small>
                        @${escapeHTML(
                            comment.username ||
                            "user"
                        )}
                    </small>

                </div>

                <small>
                    ${formatDate(
                        comment.created_at
                    )}
                </small>

                ${
                    comment.content
                        ? `
                            <p>
                                ${escapeHTML(
                                    comment.content
                                ).replace(
                                    /\n/g,
                                    "<br>"
                                )}
                            </p>
                          `
                        : ""
                }

                ${image}

            </div>

        </div>
    `;
}


/* ==================================================
   CREATE COMMENT
   ================================================== */

async function createComment(postId) {

    const contentInput =
        document.getElementById(
            `comment-content-${postId}`
        );

    const imageInput =
        document.getElementById(
            `comment-image-${postId}`
        );

    const content =
        contentInput?.value.trim() || "";

    const file =
        imageInput?.files?.[0];

    if (!content && !file) {

        alert(
            "❌ Comment cannot be empty."
        );

        return;
    }

    try {

        let image = null;

        if (file) {

            if (
                file.size >
                5 * 1024 * 1024
            ) {

                alert(
                    "❌ Image must be under 5MB."
                );

                return;
            }

            image = {

                name:
                    file.name,

                type:
                    file.type,

                data:
                    await fileToBase64(file)

            };
        }

        const response =
            await fetch(
                `/api/posts/${encodeURIComponent(
                    postId
                )}/comments`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({
                        content,
                        image
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            alert(
                "❌ " +
                (
                    data.error ||
                    "Could not create comment."
                )
            );

            return;
        }

        if (contentInput) {
            contentInput.value = "";
        }

        if (
            typeof clearCommentImage ===
            "function"
        ) {
            clearCommentImage(postId);
        }

        await loadComments(postId);

    } catch (error) {

        console.error(
            "CREATE COMMENT ERROR:",
            error
        );

        alert(
            "❌ Could not create comment."
        );
    }
}


/* ==================================================
   COMMENT IMAGE PREVIEW
   ================================================== */

function setupCommentImagePreview(postId) {

    const input =
        document.getElementById(
            `comment-image-${postId}`
        );

    const preview =
        document.getElementById(
            `comment-preview-${postId}`
        );

    const image =
        document.getElementById(
            `comment-preview-image-${postId}`
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

                clearCommentImage(
                    postId
                );

                return;
            }

            if (!file.type.startsWith("image/")) {

                alert(
                    "❌ Please select an image."
                );

                clearCommentImage(
                    postId
                );

                return;
            }

            if (
                file.size >
                5 * 1024 * 1024
            ) {

                alert(
                    "❌ Images must be under 5MB."
                );

                clearCommentImage(
                    postId
                );

                return;
            }

            const reader =
                new FileReader();

            reader.onload =
                event => {

                    if (image) {
                        image.src =
                            event.target.result;
                    }

                    if (preview) {
                        preview.style.display =
                            "block";
                    }

                };

            reader.readAsDataURL(file);
        }
    );
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

    const image =
        document.getElementById(
            `comment-preview-image-${postId}`
        );

    if (input) {
        input.value = "";
    }

    if (image) {
        image.src = "";
    }

    if (preview) {
        preview.style.display =
            "none";
    }
}


/* ==================================================
   POST IMAGE PREVIEW
   ================================================== */

const postImageInput =
    document.getElementById(
        "post-image"
    );

const postImagePreview =
    document.getElementById(
        "post-image-preview"
    );

const postPreviewImage =
    document.getElementById(
        "post-preview-image"
    );


if (postImageInput) {

    postImageInput.addEventListener(
        "change",
        () => {

            const file =
                postImageInput.files[0];

            if (!file) {

                clearPostImage();

                return;
            }

            if (!file.type.startsWith("image/")) {

                alert(
                    "❌ Please select an image."
                );

                clearPostImage();

                return;
            }

            if (
                file.size >
                5 * 1024 * 1024
            ) {

                alert(
                    "❌ Images must be under 5MB."
                );

                clearPostImage();

                return;
            }

            const reader =
                new FileReader();

            reader.onload =
                event => {

                    if (postPreviewImage) {

                        postPreviewImage.src =
                            event.target.result;

                    }

                    if (postImagePreview) {

                        postImagePreview.style.display =
                            "block";

                    }
                };

            reader.readAsDataURL(file);
        }
    );
}


/* ==================================================
   CLEAR POST IMAGE
   ================================================== */

function clearPostImage() {

    if (postImageInput) {
        postImageInput.value = "";
    }

    if (postPreviewImage) {
        postPreviewImage.src = "";
    }

    if (postImagePreview) {
        postImagePreview.style.display =
            "none";
    }
}


/* ==================================================
   START APP
   ================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "🧌 ShrekBook starting..."
        );

        await checkLogin();

        console.log(
            "🧌 ShrekBook ready!"
        );
    }
);