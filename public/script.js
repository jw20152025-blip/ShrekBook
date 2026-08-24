/* ==================================================
   SHREKBOOK CLIENT SCRIPT
================================================== */


/* ==================================================
   ESCAPE HTML
================================================== */

function escapeHtml(text) {

    const div = document.createElement("div");

    div.textContent = text ?? "";

    return div.innerHTML;

}


/* ==================================================
   WARNING
================================================== */

function warn() {

    const element =
        document.getElementById("upload-avatar-button-warn");

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

        const reader = new FileReader();

        reader.onload = () => {

            const result = reader.result;

            const base64 = result.split(",")[1];

            resolve(base64);

        };

        reader.onerror = () => {

            reject(
                new Error("Could not read image.")
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
                    method: "POST",
                    credentials: "include"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            alert("❌ " + (data.error || "Could not react."));

            return;

        }

        if (type === "gyatt") {

            const element =
                document.getElementById("gyatt-count");

            if (element) {
                element.textContent = data.gyatt;
            }

        }

        if (type === "cat") {

            const element =
                document.getElementById("cat-count");

            if (element) {
                element.textContent = data.cat;
            }

        }

        if (type === "ogred") {

            const element =
                document.getElementById("ogred-count");

            if (element) {
                element.textContent = data.ogred;
            }

        }

        loadLeaderboard(currentLeaderboard);

    } catch (error) {

        console.error(
            "REACTION ERROR:",
            error
        );

        alert("❌ Could not react.");

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

        type: file.type,

        name: file.name

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

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body:
                        JSON.stringify({

                            email: email,

                            password: password

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
            "❌ " + error.message;

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

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body:
                        JSON.stringify({

                            username: username,

                            display_name:
                                displayName ||
                                username,

                            email: email,

                            password: password

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
            "❌ " + error.message;

    }

}







/* ==================================================
   CREATE LEADERBOARD UI
================================================== */

function createLeaderboardUI() {

    if (
        document.getElementById(
            "leaderboard-section"
        )
    ) {
        return;
    }

    const app =
        document.getElementById(
            "app-section"
        );

    if (!app) {
        return;
    }

    const section =
        document.createElement("section");

    section.id =
        "leaderboard-section";

    section.className =
        "leaderboard-section";

    section.innerHTML = `

        <h2 id="leaderboard-title">
            🏆 Overall
        </h2>

        <div
            class="leaderboard-switcher"
            style="
                display:flex;
                gap:8px;
                flex-wrap:wrap;
                margin-bottom:15px;
            ">

            <button
                id="leaderboard-button-overall"
                onclick="loadLeaderboard('overall')">

                🏆 Overall

            </button>

            <button
                id="leaderboard-button-posts"
                onclick="loadLeaderboard('posts')">

                📝 Posts

            </button>

            <button
                id="leaderboard-button-comments"
                onclick="loadLeaderboard('comments')">

                💬 Comments

            </button>

            <button
                id="leaderboard-button-cat"
                onclick="loadLeaderboard('cat')">

                🐱 Cat

            </button>

            <button
                id="leaderboard-button-gyatt"
                onclick="loadLeaderboard('gyatt')">

                🍑 Gyatt

            </button>

            <button
                id="leaderboard-button-ogred"
                onclick="loadLeaderboard('ogred')">

                🧌 Ogred

            </button>

        </div>

        <div id="leaderboard">

            Loading leaderboard... 🧌

        </div>

    `;

    const peopleSection =
        app.querySelector(
            ".people-section"
        );

    if (peopleSection) {

        app.insertBefore(
            section,
            peopleSection
        );

    } else {

        app.appendChild(section);

    }

}


/* ==================================================
   LEADERBOARD
================================================== */

let currentLeaderboard = "overall";


const leaderboardTitles = {

    overall:
        "🏆 Overall",

    posts:
        "📝 Posts",

    comments:
        "💬 Comments",

    cat:
        "🐱 Cat",

    gyatt:
        "🍑 Gyatt",

    ogred:
        "🧌 Ogred"

};


/* ==================================================
   GET LEADERBOARD SCORE
================================================== */

function getLeaderboardScore(user, type) {

    if (!user) {
        return 0;
    }

    if (
        type === "overall" &&
        user.score !== undefined &&
        user.score !== null
    ) {

        return Number(user.score) || 0;

    }

    const possibleFields = {

        posts: [
            "posts",
            "post_count",
            "posts_count",
            "count"
        ],

        comments: [
            "comments",
            "comment_count",
            "comments_count",
            "count"
        ],

        cat: [
            "cat",
            "cat_count",
            "count"
        ],

        gyatt: [
            "gyatt",
            "gyatt_count",
            "count"
        ],

        ogred: [
            "ogred",
            "ogred_count",
            "count"
        ]

    };

    const fields =
        possibleFields[type] || [
            "score",
            "count",
            "total",
            "value"
        ];

    for (const field of fields) {

        if (
            user[field] !== undefined &&
            user[field] !== null
        ) {

            return Number(user[field]) || 0;

        }

    }

    return 0;

}


/* ==================================================
   LOAD LEADERBOARD
================================================== */

async function loadLeaderboard(type = "overall") {

    const container =
        document.getElementById("leaderboard");

    if (!container) {
        return;
    }

    currentLeaderboard = type;

    const title =
        document.getElementById("leaderboard-title");

    if (title) {

        title.textContent =
            leaderboardTitles[type] ||
            "🏆 Leaderboard";

    }

    document
        .querySelectorAll(
            ".leaderboard-switcher button"
        )
        .forEach(button => {

            button.classList.remove("active");

        });

    const activeButton =
        document.getElementById(
            `leaderboard-button-${type}`
        );

    if (activeButton) {
        activeButton.classList.add("active");
    }

    container.innerHTML = `
        <div class="leaderboard-loading">
            Loading leaderboard... 🧌
        </div>
    `;

    try {

        const response =
            await fetch(
                `/api/leaderboard?type=${encodeURIComponent(type)}`,
                {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );

        const data =
            await response.json();

        console.log(
            "LEADERBOARD DATA:",
            data
        );

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not load leaderboard."
            );

        }

        let users =
            Array.isArray(data)
                ? data
                : (
                    Array.isArray(data.leaderboard)
                        ? data.leaderboard
                        : []
                );

        const currentUser =
            data.currentUser || null;

        users =
            users
                .map(user => {

                    return {

                        ...user,

                        leaderboardScore:
                            getLeaderboardScore(
                                user,
                                type
                            )

                    };

                })
                .sort(
                    (a, b) =>
                        b.leaderboardScore -
                        a.leaderboardScore
                );

        const topFive =
            users.slice(0, 5);

        let html = "";

        if (!topFive.length) {

            html = `
                <div class="leaderboard-empty">
                    🧌 No leaderboard data yet.
                </div>
            `;

        } else {

            html =
                topFive.map(
                    (user, index) => {

                        const rank =
                            user.rank ||
                            index + 1;

                        let medal = "";

                        if (rank === 1) {
                            medal = "🥇";
                        }

                        else if (rank === 2) {
                            medal = "🥈";
                        }

                        else if (rank === 3) {
                            medal = "🥉";
                        }

                        else {
                            medal = `${rank}`;
                        }

                        const avatar =
                            user.avatar ||
                            "/default-avatar.png";

                        const displayName =
                            user.display_name ||
                            user.username ||
                            "User";

                        const username =
                            user.username ||
                            "user";

                        const score =
                            user.leaderboardScore;

                        return `

                            <a
                                href="/profile.html?id=${encodeURIComponent(
                                    user.id
                                )}"
                                style="
                                    text-decoration:none;
                                    color:inherit;
                                "
                            >

                                <div
                                    class="leaderboard-user"
                                >

                                    <div
                                        class="leaderboard-rank"
                                    >

                                        <span
                                            class="leaderboard-medal"
                                        >

                                            ${medal}

                                        </span>

                                    </div>

                                    <img
                                        class="leaderboard-avatar"
                                        src="${escapeHtml(
                                            avatar
                                        )}"
                                        alt="${escapeHtml(
                                            displayName
                                        )} avatar"
                                        onerror="
                                            this.src='/default-avatar.png';
                                        "
                                    >

                                    <div
                                        class="leaderboard-info"
                                    >

                                        <div
                                            class="leaderboard-name"
                                        >

                                            ${escapeHtml(
                                                displayName
                                            )}

                                        </div>

                                        <div
                                            class="leaderboard-username"
                                        >

                                            @${escapeHtml(
                                                username
                                            )}

                                        </div>

                                    </div>

                                    <div
                                        class="leaderboard-score"
                                    >

                                        ${Number(score)
                                            .toLocaleString()}

                                    </div>

                                </div>

                            </a>

                        `;

                    }
                ).join("");

        }

        if (currentUser) {

            const currentRank =
                currentUser.rank;

            const currentScore =
                Number(
                    currentUser.leaderboardScore ?? 0
                );

            const alreadyVisible =
                topFive.some(
                    user =>
                        String(user.id) ===
                        String(currentUser.id)
                );

            if (!alreadyVisible) {

                html += `

                    <div
                        style="
                            margin-top:18px;
                            padding-top:18px;
                            border-top:2px solid #ddd;
                        "
                    >

                        <div
                            style="
                                font-weight:bold;
                                margin-bottom:8px;
                            "
                        >

                            🧌 Your position

                        </div>

                        <a
                            href="/profile.html?id=${encodeURIComponent(
                                currentUser.id
                            )}"
                            style="
                                text-decoration:none;
                                color:inherit;
                            "
                        >

                            <div
                                class="leaderboard-user"
                                style="
                                    border:2px solid #333;
                                "
                            >

                                <div
                                    class="leaderboard-rank"
                                >

                                    #${currentRank}

                                </div>

                                <img
                                    class="leaderboard-avatar"
                                    src="${escapeHtml(
                                        currentUser.avatar ||
                                        "/default-avatar.png"
                                    )}"
                                    alt="${escapeHtml(
                                        currentUser.display_name ||
                                        currentUser.username ||
                                        "You"
                                    )} avatar"
                                    onerror="
                                        this.src='/default-avatar.png';
                                    "
                                >

                                <div
                                    class="leaderboard-info"
                                >

                                    <div
                                        class="leaderboard-name"
                                    >

                                        ${escapeHtml(
                                            currentUser.display_name ||
                                            currentUser.username ||
                                            "You"
                                        )}

                                    </div>

                                    <div
                                        class="leaderboard-username"
                                    >

                                        @${escapeHtml(
                                            currentUser.username ||
                                            "user"
                                        )}

                                    </div>

                                </div>

                                <div
                                    class="leaderboard-score"
                                >

                                    ${currentScore
                                        .toLocaleString()}

                                </div>

                            </div>

                        </a>

                    </div>

                `;

            }

        }

        container.innerHTML = html;

    } catch (error) {

        console.error(
            "LEADERBOARD ERROR:",
            error
        );

        container.innerHTML = `

            <div
                class="leaderboard-empty"
            >

                ❌ ${escapeHtml(
                    error.message
                )}

            </div>

        `;

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
        auth.style.display = "none";
    }

    if (app) {
        app.style.display = "block";
    }

    if (logoutButton) {
        logoutButton.style.display =
            "inline-block";
    }

    createLeaderboardUI();

    loadPosts();

    loadPeople();

    loadLeaderboard(
        "overall"
    );

    startOnlineHeartbeat();

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

    showAuth();

}


/* ==================================================
   MENTION SYSTEM
================================================== */

let mentionUsers = null;

let mentionUsersPromise = null;


/* ==================================================
   LOAD USERS FOR MENTIONS
================================================== */

async function loadMentionUsers() {

    /*
     * Already loaded.
     */

    if (mentionUsers !== null) {
        return mentionUsers;
    }

    /*
     * Another request is already running.
     *
     * Reuse it instead of making another request.
     */

    if (mentionUsersPromise) {
        return mentionUsersPromise;
    }

    mentionUsersPromise = (async () => {

        try {

            const response =
                await fetch(
                    "/api/users",
                    {
                        credentials: "include",
                        cache: "no-store",
                        headers: {
                            "Accept":
                                "application/json"
                        }
                    }
                );

            if (!response.ok) {

                console.error(
                    "MENTION USERS REQUEST FAILED:",
                    response.status
                );

                mentionUsers = [];

                return mentionUsers;

            }

            const users =
                await response.json();

            if (!Array.isArray(users)) {

                mentionUsers = [];

                return mentionUsers;

            }

            console.log(
                "MENTION USERS:",
                users
            );

            mentionUsers = users;

            return mentionUsers;

        } catch (error) {

            console.error(
                "MENTION USERS ERROR:",
                error
            );

            mentionUsers = [];

            return mentionUsers;

        } finally {

            mentionUsersPromise = null;

        }

    })();

    return mentionUsersPromise;

}


/* ==================================================
   FORMAT MENTIONS
================================================== */

function formatMentions(text, users = []) {

    if (!text) {
        return "";
    }

    return String(text).replace(
        /(^|[\s.,!?;:()[\]{}"'`<>])@([A-Za-z0-9_.-@]+)/g,
        (match, before, username) => {

            const normalized =
                username.toLowerCase();

            const user =
                users.find(u =>
                    String(u.username || "")
                        .toLowerCase() === normalized
                );

            /*
             * Unknown @username:
             * keep it as text.
             */

            if (!user) {
                return match;
            }

            return (
                before +
                `<a
                    class="post-mention"
                    href="/profile.html?id=${encodeURIComponent(user.id)}"
                >@${escapeHtml(user.username)}</a>`
            );

        }
    );

}


/* ==================================================
   FORMAT POST CONTENT
================================================== */

async function formatPostContent(content) {

    if (content === null || content === undefined) {
        return "";
    }

    const users =
        await loadMentionUsers();

    /*
     * Convert to string.
     */
    let text =
        String(content);

    /*
     * Normalize line endings.
     */
    text =
        text.replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n");

    /*
     * Escape HTML BEFORE creating our own HTML.
     */
    text =
        escapeHtml(text);

    /*
     * Split into individual lines.
     */
    const lines =
        text.split("\n");

    return lines.map(line => {

        /*
         * ==========================================
         * ### SMALL
         * ==========================================
         */

        if (
            line.startsWith("### ")
        ) {

            const value =
                line.substring(4);

            return `
                <div class="post-heading post-heading-small">
                    ${formatMentions(value, users)}
                </div>
            `;

        }


        /*
         * ==========================================
         * ## MEDIUM
         * ==========================================
         */

        if (
            line.startsWith("## ")
        ) {

            const value =
                line.substring(3);

            return `
                <div class="post-heading post-heading-medium">
                    ${formatMentions(value, users)}
                </div>
            `;

        }


        /*
         * ==========================================
         * # LARGE
         * ==========================================
         */

        if (
            line.startsWith("# ")
        ) {

            const value =
                line.substring(2);

            return `
                <div class="post-heading post-heading-large">
                    ${formatMentions(value, users)}
                </div>
            `;

        }


        /*
         * ==========================================
         * EMPTY LINE
         * ==========================================
         */

        if (
            line.trim() === ""
        ) {

            return `
                <div class="post-line-break"></div>
            `;

        }


        /*
         * ==========================================
         * NORMAL LINE
         * ==========================================
         */

        return `
            <div class="post-line">
                ${formatMentions(line, users)}
            </div>
        `;

    }).join("");

}


/* ==================================================
   SHREKBOOK POST FORMATTER
================================================== */

async function formatPostContent(content) {

    if (!content) {
        return "";
    }

    const users =
        await loadMentionUsers();

    /*
     * Escape user text BEFORE creating HTML.
     *
     * This prevents HTML injection.
     */

    const escaped =
        escapeHtml(String(content));

    /*
     * Normalize Windows line endings.
     */

    const normalized =
        escaped.replace(/\r\n/g, "\n");

    const lines =
        normalized.split("\n");

    return lines.map(line => {

        /*
         * ==============================================
         * ### SMALL HEADING
         * ==============================================
         */

        if (
            line.startsWith("### ")
        ) {

            const headingText =
                line.substring(4);

            return `
                <div
                    class="post-heading post-heading-small"
                >
                    ${formatMentions(
                        headingText,
                        users
                    )}
                </div>
            `;

        }


        /*
         * ==============================================
         * ## MEDIUM HEADING
         * ==============================================
         */

        if (
            line.startsWith("## ")
        ) {

            const headingText =
                line.substring(3);

            return `
                <div
                    class="post-heading post-heading-medium"
                >
                    ${formatMentions(
                        headingText,
                        users
                    )}
                </div>
            `;

        }


        /*
         * ==============================================
         * # LARGE HEADING
         * ==============================================
         */

        if (
            line.startsWith("# ")
        ) {

            const headingText =
                line.substring(2);

            return `
                <div
                    class="post-heading post-heading-large"
                >
                    ${formatMentions(
                        headingText,
                        users
                    )}
                </div>
            `;

        }


        /*
         * ==============================================
         * EMPTY LINE
         * ==============================================
         */

        if (
            line.trim() === ""
        ) {

            return `
                <div
                    class="post-line-break"
                ></div>
            `;

        }


        /*
         * ==============================================
         * NORMAL TEXT
         * ==============================================
         */

        return `
            <div
                class="post-line"
            >
                ${formatMentions(
                    line,
                    users
                )}
            </div>
        `;

    }).join("");

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
                "/api/posts",
                {
                    credentials: "include"
                }
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
            (
                await Promise.all(
                    posts.map(
                        async post => {

                            const avatar =
                                post.avatar ||
                                "/default-avatar.png";

                            const displayName =
                                post.display_name ||
                                post.username ||
                                "User";

                            let imageHTML = "";

                            if (
                                post.image_url
                            ) {

                                imageHTML = `

                                    <div
                                        class="post-image-container"
                                        style="
                                            margin-top:12px;
                                        "
                                    >

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
                                            "
                                        >

                                    </div>

                                `;

                            }

                            return `

                                <article
                                    class="post"
                                >

                                    <div
                                        class="post-header"
                                        style="
                                            display:flex;
                                            align-items:center;
                                            gap:10px;
                                        "
                                    >

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
                                            "
                                        >

                                        <a
                                            href="/profile.html?id=${encodeURIComponent(
                                                post.user_id
                                            )}"
                                            style="
                                                text-decoration:none;
                                                color:inherit;
                                            "
                                        >

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
                                                    "
                                                >

                                                    ${await formatPostContent(
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
                                        "
                                    >

                                        💬 Comments

                                    </button>

                                    <div
                                        id="comments-${escapeHtml(
                                            post.id
                                        )}"
                                        class="comments"
                                        style="
                                            display:none;
                                        "
                                    >

                                        <div
                                            id="comment-list-${escapeHtml(
                                                post.id
                                            )}"
                                        >

                                            Loading...

                                        </div>

                                        <div
                                            class="comment-form"
                                            style="
                                                margin-top:10px;
                                            "
                                        >

                                            <input
                                                id="comment-input-${escapeHtml(
                                                    post.id
                                                )}"
                                                placeholder="Write a comment..."
                                                maxlength="500"
                                            >

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
                                                "
                                            >

                                            <button
                                                onclick="
                                                    submitComment(
                                                        '${escapeHtml(
                                                            post.id
                                                        )}'
                                                    )
                                                "
                                            >

                                                Send

                                            </button>

                                            <div
                                                id="comment-preview-${escapeHtml(
                                                    post.id
                                                )}"
                                                style="
                                                    display:none;
                                                    margin-top:8px;
                                                "
                                            >

                                                <img
                                                    id="comment-preview-image-${escapeHtml(
                                                        post.id
                                                    )}"
                                                    alt="Comment image preview"
                                                    style="
                                                        max-width:200px;
                                                        max-height:200px;
                                                        border-radius:10px;
                                                    "
                                                >

                                                <br>

                                                <button
                                                    type="button"
                                                    onclick="
                                                        clearCommentImage(
                                                            '${escapeHtml(
                                                                post.id
                                                            )}'
                                                        )
                                                    "
                                                >

                                                    ❌ Remove image

                                                </button>

                                            </div>

                                        </div>

                                    </div>

                                </article>

                            `;

                        }
                    )
                )
            ).join("");

        posts.forEach(
            post => {

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

                            input.value = "";

                            return;

                        }

                        if (
                            file.size >
                            5 * 1024 * 1024
                        ) {

                            alert(
                                "❌ Image must be under 5MB."
                            );

                            input.value = "";

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
        );

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
        input?.value.trim() || "";

    const file =
        imageInput?.files?.[0] || null;

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

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body:
                        JSON.stringify({

                            content: content,

                            image: image

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

        input.value = "";

        if (imageInput) {
            imageInput.value = "";
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
            preview.style.display = "none";
        }

        if (previewImage) {
            previewImage.src = "";
        }

        status.textContent =
            "✅ Posted!";

        loadPosts();

        loadLeaderboard(
            currentLeaderboard
        );

    } catch (error) {

        console.error(
            "CREATE POST ERROR:",
            error
        );

        status.textContent =
            "❌ " + error.message;

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
        box.style.display === "none"
    ) {

        box.style.display = "block";

        loadComments(postId);

    } else {

        box.style.display = "none";

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
                `/api/posts/${postId}/comments`,
                {
                    credentials: "include"
                }
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

        const commentHTML =
            await Promise.all(
                comments.map(
                    async comment => {

                        const avatar =
                            comment.avatar ||
                            "/default-avatar.png";

                        const displayName =
                            comment.display_name ||
                            comment.username ||
                            "User";

                        let imageHTML = "";

                        if (
                            comment.image_url
                        ) {

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
                                    "
                                >

                            `;

                        }

                        return `

                            <div
                                class="comment"
                                style="
                                    padding:10px;
                                    margin-bottom:10px;
                                "
                            >

                                <div
                                    style="
                                        display:flex;
                                        align-items:center;
                                        gap:8px;
                                    "
                                >

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
                                        "
                                    >

                                    <strong>
                                        ${escapeHtml(
                                            displayName
                                        )}
                                    </strong>

                                </div>

                                ${
                                    comment.content
                                        ? `

                                            <div
                                                class="comment-content"
                                            >

                                                ${await formatPostContent(
                                                    comment.content
                                                )}

                                            </div>

                                        `
                                        : ""
                                }

                                ${imageHTML}

                            </div>

                        `;

                    }
                )
            );

        list.innerHTML =
            commentHTML.join("");

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
        input?.value.trim() || "";

    const file =
        imageInput?.files?.[0] || null;

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

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body:
                        JSON.stringify({

                            content: content,

                            image: image

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

        input.value = "";

        if (imageInput) {
            imageInput.value = "";
        }

        clearCommentImage(postId);

        loadComments(postId);

        loadLeaderboard(
            currentLeaderboard
        );

    } catch (error) {

        console.error(
            "COMMENT ERROR:",
            error
        );

        alert(
            "❌ " + error.message
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
        input.value = "";
    }

    if (previewImage) {
        previewImage.src = "";
    }

    if (preview) {
        preview.style.display = "none";
    }

}


/* ==================================================
   CLEAR POST IMAGE
================================================== */

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

    if (previewImage) {
        previewImage.src = "";
    }

    if (preview) {
        preview.style.display = "none";
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
                "/api/users",
                {
                    credentials: "include"
                }
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
            users.map(
                user => {

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
                            "
                        >

                            <div
                                style="
                                    position:relative;
                                    width:50px;
                                    height:50px;
                                    flex-shrink:0;
                                "
                            >

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
                                    "
                                >

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
                                    "
                                >
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

                }
            ).join("");

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

            submitComment(postId);

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

                    method: "POST",

                    credentials: "include",

                    headers: {
                        "Content-Type":
                            "application/json"
                    }

                }
            );

        /*
         * 401 means the session has expired.
         *
         * Don't spam the console.
         */

        if (response.status === 401) {

            return;

        }

        if (!response.ok) {

            console.warn(
                "Online status request failed:",
                response.status
            );

            return;

        }

    } catch (error) {

        console.warn(
            "Online heartbeat unavailable."
        );

    }

}


/* ==================================================
   ONLINE HEARTBEAT
================================================== */

let onlineHeartbeatStarted = false;

function startOnlineHeartbeat() {

    if (onlineHeartbeatStarted) {
        return;
    }

    onlineHeartbeatStarted = true;

    /*
     * Send immediately after login.
     */

    updateOnlineStatus();

    /*
     * Then every 30 seconds.
     */

    setInterval(
        updateOnlineStatus,
        30000
    );

}

/* ==================================================
   ROLE SYSTEM
================================================== */

function getUserRole(user) {

    if (!user) {
        return "peasant";
    }

    /*
        Supported roles:

        owner
        admin
        senior_moderator
        moderator
        peasant
    */

    let role =
        user.role ||
        user.user_role ||
        user.rank ||
        "peasant";

    role = String(role)
        .toLowerCase()
        .trim()
        .replace(/[\s-]+/g, "_");

    const validRoles = [
        "owner",
        "admin",
        "senior_moderator",
        "moderator",
        "peasant"
    ];

    if (!validRoles.includes(role)) {
        return "peasant";
    }

    return role;
}


/* ==================================================
   ROLE PERMISSIONS
================================================== */

function hasRole(user, requiredRole) {

    const roleLevels = {
        peasant: 0,
        moderator: 1,
        senior_moderator: 2,
        admin: 3,
        owner: 4
    };

    const userRole =
        getUserRole(user);

    const userLevel =
        roleLevels[userRole] ?? 0;

    const requiredLevel =
        roleLevels[requiredRole] ?? 0;

    return userLevel >= requiredLevel;
}


/* ==================================================
   INDIVIDUAL ROLE CHECKS
================================================== */

function isOwner(user) {
    return hasRole(user, "owner");
}


function isAdmin(user) {
    return hasRole(user, "admin");
}


function isSeniorModerator(user) {
    return hasRole(user, "senior_moderator");
}


function isModerator(user) {
    return hasRole(user, "moderator");
}


/* ==================================================
   CAN ACCESS ADMIN PANEL
================================================== */

function canAccessAdminPanel(user) {

    if (!user) {
        return false;
    }

    /*
        Admin panel is available to:

        OWNER
        ADMIN

        Moderators do NOT get the admin panel.
    */

    return (
        getUserRole(user) === "owner" ||
        getUserRole(user) === "admin"
    );

}


/* ==================================================
   CAN ACCESS MODERATION
================================================== */

function canModerate(user) {

    if (!user) {
        return false;
    }

    return hasRole(
        user,
        "moderator"
    );

}


/* ==================================================
   ADMIN NAVIGATION
================================================== */

function setupAdminNav(user) {

    let adminNav =
        document.getElementById("admin-nav");

    /*
        Remove/hide the nav if there is
        no logged-in user.
    */

    if (!user) {

        if (adminNav) {
            adminNav.style.display = "none";
        }

        return;

    }


    const role =
        getUserRole(user);


    /*
        ONLY owner/admin get Admin Panel.

        Moderator and Senior Moderator
        do NOT get this button.
    */

    const allowed =
        canAccessAdminPanel(user);


    if (!allowed) {

        if (adminNav) {
            adminNav.style.display = "none";
        }

        return;

    }


    /*
        If the nav already exists,
        simply show it.
    */

    if (adminNav) {

        adminNav.style.display = "flex";

        return;

    }


    /*
        Create Admin Navigation
    */

    adminNav =
        document.createElement("nav");

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


    /*
        Different label depending
        on the user's actual role.
    */

    let roleLabel =
        "Admin";

    if (role === "owner") {
        roleLabel = "Owner";
    }

    if (role === "admin") {
        roleLabel = "Admin";
    }


    adminNav.innerHTML = `

        <strong
            style="
                color:#ffcc00;
                white-space:nowrap;
            "
        >
            🛡️ ${roleLabel}
        </strong>

        <a
            href="/admin.html"
            style="
                color:inherit;
                text-decoration:none;
                font-weight:bold;
            "
        >
            Admin Panel
        </a>

        <span style="opacity:0.5;">
            |
        </span>

        <a
            href="/"
            style="
                color:inherit;
                text-decoration:none;
            "
        >
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

async function checkModerationStatus() {

    try {

        const response = await fetch(
            "/api/me",
            {
                credentials: "include",
                cache: "no-store"
            }
        );

        if (!response.ok) {
            return;
        }

        const data = await response.json();


        // BAN
        if (data.banned === true) {

            console.log("🚫 BAN DETECTED");

            window.location.replace(
                "/login.html"
            );

            return;
        }


        // KICK
        if (data.kicked === true) {

            console.log("🦵 KICK DETECTED");

            window.location.replace(
                "/kicked.html"
            );

            return;
        }

    } catch (error) {

        console.error(
            "MODERATION CHECK ERROR:",
            error
        );

    }

}

if (
    !window.location.pathname
        .toLowerCase()
        .endsWith("/login.html") &&
    !window.location.pathname
        .toLowerCase()
        .endsWith("/kicked.html")
) {

    checkModerationStatus();

    setInterval(
        checkModerationStatus,
        500
    );

}
/* ==================================================
   ADMIN BUTTON / ROLE CHECK
================================================== */

async function checkAdmin() {

    const adminButton =
        document.getElementById("admin-button");

    if (!adminButton) {
        return;
    }

    // Hide by default
    adminButton.style.display = "none";

    try {

        const response =
            await fetch(
                "/api/me",
                {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );

        if (!response.ok) {
            return;
        }

        const data =
            await response.json();

        const user =
            data.user || data;

        if (!user) {
            return;
        }

        const role =
            String(
                user.role ||
                user.user_role ||
                "peasant"
            ).toLowerCase().trim();

        /*
            ADMIN PANEL ACCESS

            owner
            administrator
            admin

            Moderators DO NOT get the
            Admin Panel from this check.
        */

        const canAccessAdminPanel =
            role === "owner" ||
            role === "administrator" ||
            role === "admin" ||
            user.is_admin === true ||
            user.is_admin === 1 ||
            user.is_admin === "true";

        if (canAccessAdminPanel) {

            adminButton.style.display =
                "inline-block";

            console.log(
                "🛡️ Admin Panel access granted:",
                role
            );

        } else {

            adminButton.style.display =
                "none";

            console.log(
                "👤 Admin Panel access denied:",
                role
            );

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
   MODERATION UI
================================================== */

function setupModerationUI(user) {

    if (!user) {
        return;
    }


    const moderationElements =
        document.querySelectorAll(
            "[data-moderator-only]"
        );


    /*
        Moderator+
        can see moderation controls.
    */

    const allowed =
        canModerate(user);


    moderationElements.forEach(
        element => {

            element.style.display =
                allowed
                    ? ""
                    : "none";

        }
    );

}


/* ==================================================
   ROLE UI
================================================== */

function setupRoleUI(user) {

    if (!user) {
        return;
    }


    const role =
        getUserRole(user);


    /*
        Put the role into elements
        using data-role-display.
    */

    document
        .querySelectorAll(
            "[data-role-display]"
        )
        .forEach(
            element => {

                element.textContent =
                    role
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, c =>
                            c.toUpperCase()
                        );

            }
        );


    /*
        Owner-only elements
    */

    document
        .querySelectorAll(
            "[data-owner-only]"
        )
        .forEach(
            element => {

                element.style.display =
                    role === "owner"
                        ? ""
                        : "none";

            }
        );


    /*
        Admin+ elements
    */

    document
        .querySelectorAll(
            "[data-admin-only]"
        )
        .forEach(
            element => {

                element.style.display =
                    canAccessAdminPanel(user)
                        ? ""
                        : "none";

            }
        );


    /*
        Moderator+ elements
    */

    document
        .querySelectorAll(
            "[data-moderator-only]"
        )
        .forEach(
            element => {

                element.style.display =
                    canModerate(user)
                        ? ""
                        : "none";

            }
        );

}
async function clearKick(userId) {

    try {

        const { error } = await supabase
            .from("profiles")
            .update({
                kicked: false
            })
            .eq("id", userId);

        if (error) {
            console.error(
                "CLEAR KICK ERROR:",
                error
            );
            return;
        }

        console.log(
            `🦵 Kick cleared for ${userId}`
        );

    } catch (error) {

        console.error(
            "CLEAR KICK ERROR:",
            error
        );

    }
}
/* ==================================================
   BAN / KICK MONITOR
================================================== */

let moderationCheckRunning = false;


async function checkModerationStatus() {

    if (moderationCheckRunning) {
        return;
    }

    moderationCheckRunning = true;

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


        /* ==========================================
           BAN
        ========================================== */

        if (
            data.banned === true ||
            (
                data.user &&
                data.user.banned === true
            )
        ) {

            console.log(
                "🚫 BAN DETECTED"
            );

            window.location.replace(
                "/login.html"
            );

            return;
        }


        /* ==========================================
           KICK
        ========================================== */

        if (
            data.kicked === true ||
            (
                data.user &&
                data.user.kicked === true
            )
        ) {

            console.log(
                "🦵 KICK DETECTED"
            );

            window.location.replace(
                "/kicked.html"
            );

            return;
        }


    } catch (error) {

        console.error(
            "MODERATION CHECK ERROR:",
            error
        );

    } finally {

        moderationCheckRunning = false;

    }

}


/* ==================================================
   START MONITOR
================================================== */

if (
    !window.location.pathname
        .toLowerCase()
        .endsWith("/login.html") &&

    !window.location.pathname
        .toLowerCase()
        .endsWith("/kicked.html")
) {

    checkModerationStatus();

    setInterval(
        checkModerationStatus,
        2000
    );

}
/* ==================================================
   SESSION CHECK
================================================== */

async function checkLogin() {

    try {

        const response =
            await fetch(
                "/api/me",
                {
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        const data =
            await response.json();


        if (
            response.ok &&
            data.loggedIn &&
            data.user
        ) {

            /*
                Set up ALL role systems.
            */

            setupAdminNav(
                data.user
            );

            setupModerationUI(
                data.user
            );

            setupRoleUI(
                data.user
            );

            checkAdmin();

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

    const adminButton =
        document.getElementById(
            "admin-button"
        );


    if (auth) {
        auth.style.display = "block";
    }


    if (app) {
        app.style.display = "none";
    }


    if (logoutButton) {
        logoutButton.style.display =
            "none";
    }


    if (adminNav) {
        adminNav.style.display =
            "none";
    }


    if (adminButton) {
        adminButton.style.display =
            "none";
    }

}


/* ==================================================
   ROLE DEBUG
================================================== */

function debugUserRole(user) {

    if (!user) {

        console.log(
            "👤 No user logged in."
        );

        return;

    }


    const role =
        getUserRole(user);


    console.log(
        "👤 User:",
        user.username ||
        user.display_name ||
        user.id
    );


    console.log(
        "🎖️ Role:",
        role
    );


    console.log(
        "👑 Owner:",
        isOwner(user)
    );


    console.log(
        "🛡️ Admin:",
        isAdmin(user)
    );


    console.log(
        "⭐ Senior Moderator:",
        isSeniorModerator(user)
    );


    console.log(
        "🔨 Moderator:",
        isModerator(user)
    );


    console.log(
        "📋 Admin Panel:",
        canAccessAdminPanel(user)
    );


    console.log(
        "🔨 Moderation:",
        canModerate(user)
    );

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