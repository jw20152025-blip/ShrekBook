
/* ==================================================
   SHREKBOOK CLIENT SCRIPT
================================================== */

let moderationCheckRunning = false;
let showingSpecificMessage = false;
let onlineHeartbeatStarted = false;
let allPeople = [];
let currentLeaderboard = "overall";


// ==================================================
// ME CACHE
// ==================================================

let meCache = null;
let meCacheTime = 0;
let meRequest = null;

const ME_CACHE_DURATION = 10 * 1000;


// ==================================================
// GET CURRENT USER
// IMPORTANT:
// This function returns PARSED DATA, not a fetch Response.
// ==================================================

async function getMeCached(force = false) {

    const now = Date.now();

    // Return valid cache
    if (
        !force &&
        meCache &&
        (now - meCacheTime) < ME_CACHE_DURATION
    ) {
        return meCache;
    }

    // Reuse an existing request
    if (meRequest) {
        return meRequest;
    }

    meRequest = (async () => {

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

            // Not logged in
            if (response.status === 401) {

                meCache = {
                    loggedIn: false,
                    user: null
                };

                meCacheTime = Date.now();

                return meCache;
            }

            if (!response.ok) {

                throw new Error(
                    `GET /api/me failed: ${response.status}`
                );
            }

            const data =
                await response.json();

            meCache = data;
            meCacheTime = Date.now();

            return data;

        } catch (error) {

            console.error(
                "ME CACHE ERROR:",
                error
            );

            if (meCache) {
                return meCache;
            }

            return {
                loggedIn: false,
                user: null
            };

        } finally {

            meRequest = null;

        }

    })();

    return meRequest;
}


// ==================================================
// FORCE REFRESH ME
// ==================================================

async function refreshMe() {

    meCache = null;
    meCacheTime = 0;

    return getMeCached(true);
}


// ==================================================
// CLEAR ME CACHE
// ==================================================

function clearMeCache() {

    meCache = null;
    meCacheTime = 0;

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
   SAFE JSON RESPONSE
================================================== */

async function getJsonResponse(response) {

    const contentType =
        response.headers.get("content-type") || "";

    if (
        contentType.includes("application/json")
    ) {

        return await response.json();

    }

    const text =
        await response.text();

    return {
        error:
            text ||
            `Request failed with status ${response.status}`
    };

}


/* ==================================================
   INVENTORY
================================================== */

async function loadInventory() {

    try {

        const response =
            await fetch(
                "/api/shop/inventory",
                {
                    credentials: "include",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );

        const data =
            await getJsonResponse(response);

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Failed to load inventory."
            );

        }

        const inventory =
            data.items || [];

        const container =
            document.getElementById(
                "inventory"
            );

        if (!container) {
            return;
        }

        if (!inventory.length) {

            container.innerHTML =
                "<p>You don't own any items yet. 🧌</p>";

            return;
        }

        container.innerHTML =
            inventory.map(item => {

                const shopItem =
                    item.shop_items || {};

                return `

                    <div class="inventory-item">

                        <h3>
                            ${escapeHtml(
                                shopItem.name || "Item"
                            )}
                        </h3>

                        <p>
                            ${escapeHtml(
                                shopItem.description || ""
                            )}
                        </p>

                    </div>

                `;

            }).join("");

    } catch (error) {

        console.error(
            "INVENTORY LOAD ERROR:",
            error
        );

    }

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

    const validTypes = [
        "gyatt",
        "cat",
        "ogred"
    ];

    if (!validTypes.includes(type)) {
        return;
    }

    try {

        const response =
            await fetch(
                `/api/users/${encodeURIComponent(userId)}/${encodeURIComponent(type)}`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );

        const data =
            await getJsonResponse(response);

        if (!response.ok) {

            alert(
                "❌ " +
                (
                    data.error ||
                    "Could not react."
                )
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

        loadLeaderboard(
            currentLeaderboard
        );

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
            "Logging in...";
    }

    try {

        const response =
            await fetch(
                "/api/login",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                        "Accept":
                            "application/json"
                    },

                    credentials: "include",

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
            await getJsonResponse(response);

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Login failed."
            );

        }

        clearMeCache();

        if (status) {

            status.textContent =
                "✅ Logged in!";

        }

        await checkLogin();

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

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                        "Accept":
                            "application/json"
                    },

                    credentials: "include",

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
            await getJsonResponse(response);

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
   LEADERBOARD UI
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
        document.createElement(
            "section"
        );

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
            "
        >

            <button
                id="leaderboard-button-overall"
                onclick="loadLeaderboard('overall')"
            >
                🏆 Overall
            </button>

            <button
                id="leaderboard-button-posts"
                onclick="loadLeaderboard('posts')"
            >
                📝 Posts
            </button>

            <button
                id="leaderboard-button-comments"
                onclick="loadLeaderboard('comments')"
            >
                💬 Comments
            </button>

            <button
                id="leaderboard-button-cat"
                onclick="loadLeaderboard('cat')"
            >
                🐱 Cat
            </button>

            <button
                id="leaderboard-button-gyatt"
                onclick="loadLeaderboard('gyatt')"
            >
                🍑 Gyatt
            </button>

            <button
                id="leaderboard-button-ogred"
                onclick="loadLeaderboard('ogred')"
            >
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

        app.appendChild(
            section
        );

    }

}


/* ==================================================
   LEADERBOARD TITLES
================================================== */

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

function getLeaderboardScore(
    user,
    type
) {

    if (!user) {
        return 0;
    }

    if (
        type === "overall" &&
        user.score !== undefined &&
        user.score !== null
    ) {

        return Number(
            user.score
        ) || 0;

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
        possibleFields[type] ||
        [
            "score",
            "count",
            "total",
            "value"
        ];

    for (
        const field of fields
    ) {

        if (
            user[field] !== undefined &&
            user[field] !== null
        ) {

            return Number(
                user[field]
            ) || 0;

        }

    }

    return 0;

}


/* ==================================================
   LOAD LEADERBOARD
================================================== */

async function loadLeaderboard(
    type = "overall"
) {

    const container =
        document.getElementById(
            "leaderboard"
        );

    if (!container) {
        return;
    }

    currentLeaderboard =
        type;

    const title =
        document.getElementById(
            "leaderboard-title"
        );

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

            button.classList.remove(
                "active"
            );

        });

    const activeButton =
        document.getElementById(
            `leaderboard-button-${type}`
        );

    if (activeButton) {

        activeButton.classList.add(
            "active"
        );

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
                        "Accept":
                            "application/json"
                    }
                }
            );

        const data =
            await getJsonResponse(
                response
            );

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
                    Array.isArray(
                        data.leaderboard
                    )
                        ? data.leaderboard
                        : []
                );

        let currentUser =
            data.currentUser ||
            null;

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
                            Number(
                                user.rank ||
                                index + 1
                            );

                        let medal =
                            String(rank);

                        if (rank === 1) {
                            medal = "🥇";
                        }

                        else if (rank === 2) {
                            medal = "🥈";
                        }

                        else if (rank === 3) {
                            medal = "🥉";
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
                            Number(
                                user.leaderboardScore
                            ) || 0;

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
                                        ${score.toLocaleString()}
                                    </div>

                                </div>

                            </a>

                        `;

                    }
                ).join("");

        }

        if (currentUser) {

            const currentRank =
                currentUser.rank ||
                (
                    users.findIndex(
                        user =>
                            String(user.id) ===
                            String(currentUser.id)
                    ) + 1
                );

            const currentScore =
                Number(
                    currentUser.leaderboardScore ??
                    getLeaderboardScore(
                        currentUser,
                        type
                    )
                ) || 0;

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
                                    ${currentScore.toLocaleString()}
                                </div>

                            </div>

                        </a>

                    </div>

                `;

            }

        }

        container.innerHTML =
            html;

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

    createLeaderboardUI();

    loadPosts();

    loadPeople();

    loadLeaderboard(
        "overall"
    );

    loadInventory();

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

    clearMeCache();

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

    if (mentionUsers !== null) {
        return mentionUsers;
    }

    if (mentionUsersPromise) {
        return mentionUsersPromise;
    }

    mentionUsersPromise =
        (async () => {

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

                mentionUsers =
                    users;

                return mentionUsers;

            } catch (error) {

                console.error(
                    "MENTION USERS ERROR:",
                    error
                );

                mentionUsers = [];

                return mentionUsers;

            } finally {

                mentionUsersPromise =
                    null;

            }

        })();

    return mentionUsersPromise;

}

async function sendHeartbeat() {

    try {

        await fetch("/api/heartbeat", {
            method: "POST",
            credentials: "include"
        });

    } catch (error) {

        console.error(
            "Heartbeat failed:",
            error
        );

    }

}
sendHeartbeat();

setInterval(
    sendHeartbeat,
    10000
);
async function loadOnlineUsers() {

    try {

        const response = await fetch("/api/online", {
            credentials: "include"
        });

        if (!response.ok) {
            console.error(
                "Failed to load online users:",
                response.status
            );
            return;
        }

        const data = await response.json();

        if (!data.success) {
            return;
        }

        // Update every online indicator on the page
        document.querySelectorAll("[data-user-id]").forEach(element => {

            const userId =
                element.getAttribute("data-user-id");

            const user =
                data.users.find(
                    u => String(u.id) === String(userId)
                );

            if (!user) {
                return;
            }

            const dot =
                element.querySelector(".online-dot");

            if (!dot) {
                return;
            }

            if (user.online) {

                dot.classList.add("online");

                dot.classList.remove("offline");

                dot.title = "Online";

            } else {

                dot.classList.add("offline");

                dot.classList.remove("online");

                dot.title = "Offline";

            }

        });

    } catch (error) {

        console.error(
            "ONLINE STATUS ERROR:",
            error
        );

    }

}
loadOnlineUsers();

setInterval(
    loadOnlineUsers,
    10000
);
/* ==================================================
   FORMAT MENTIONS
================================================== */

function formatMentions(
    text,
    users = []
) {

    if (!text) {
        return "";
    }

    return String(text).replace(
        /(^|[\s.,!?;:()[\]{}"'`<>])@([A-Za-z0-9_.-]+)/g,
        (
            match,
            before,
            username
        ) => {

            const normalized =
                username.toLowerCase();

            const user =
                users.find(
                    u =>
                        String(
                            u.username || ""
                        )
                        .toLowerCase() ===
                        normalized
                );

            if (!user) {
                return match;
            }

            return (
                before +
                `<a
                    class="post-mention"
                    href="/profile.html?id=${encodeURIComponent(
                        user.id
                    )}"
                >@${escapeHtml(
                    user.username
                )}</a>`
            );

        }
    );

}


/* ==================================================
   FORMAT POST CONTENT
================================================== */

async function formatPostContent(
    content
) {

    if (
        content === null ||
        content === undefined
    ) {
        return "";
    }

    const users =
        await loadMentionUsers();

    let text =
        String(content);

    text =
        text
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n");

    text =
        escapeHtml(text);

    const lines =
        text.split("\n");

    return lines.map(
        line => {

            // ### Small
            if (
                line.startsWith("### ")
            ) {

                const value =
                    line.substring(4);

                return `
                    <div
                        class="post-heading post-heading-small"
                    >
                        ${formatMentions(
                            value,
                            users
                        )}
                    </div>
                `;

            }

            // ## Medium
            if (
                line.startsWith("## ")
            ) {

                const value =
                    line.substring(3);

                return `
                    <div
                        class="post-heading post-heading-medium"
                    >
                        ${formatMentions(
                            value,
                            users
                        )}
                    </div>
                `;

            }

            // # Large
            if (
                line.startsWith("# ")
            ) {

                const value =
                    line.substring(2);

                return `
                    <div
                        class="post-heading post-heading-large"
                    >
                        ${formatMentions(
                            value,
                            users
                        )}
                    </div>
                `;

            }

            // Empty line
            if (
                line.trim() === ""
            ) {

                return `
                    <div
                        class="post-line-break"
                    ></div>
                `;

            }

            // Normal line
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

        }
    ).join("");

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
                    credentials: "include",
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );

        const posts =
            await getJsonResponse(
                response
            );

        if (!response.ok) {

            throw new Error(
                posts.error ||
                "Could not load posts."
            );

        }

        if (!Array.isArray(posts)) {

            throw new Error(
                "Invalid posts response."
            );

        }

        if (!posts.length) {

            container.innerHTML =
                "<p>No posts yet. Be the first! 🧌</p>";

            return;

        }


        // ==========================================
        // RENDER POSTS
        // ==========================================

        const renderedPosts =
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


                        // ======================================
                        // MEDIA
                        // ======================================

                        let imageHTML = "";
                        console.log("POST IMAGE URL:", post.image_url);
                        console.log("FULL POST:", post);

                        if (post.image_url) {

                            const mediaURL =
                                escapeHtml(
                                    post.image_url
                                );

                            const lowerURL =
                                String(
                                    post.image_url
                                ).toLowerCase();


                            // Detect video
                            const isVideo =
                                lowerURL.includes(".mp4") ||
                                lowerURL.includes("video/mp4") ||
                                lowerURL.includes(".webm") ||
                                lowerURL.includes("video/webm") ||
                                lowerURL.includes(".mov") ||
                                lowerURL.includes("video/quicktime") ||
                                lowerURL.includes(".m4v");


                            if (isVideo) {

                                imageHTML = `

                                    <div
                                        class="post-image-container"
                                        style="
                                            margin-top:12px;
                                            width:100%;
                                        "
                                    >

                                        <video
                                            controls
                                            playsinline
                                            preload="metadata"
                                            style="
                                                max-width:100%;
                                                max-height:600px;
                                                width:100%;
                                                border-radius:12px;
                                                object-fit:contain;
                                                display:block;
                                                background:#000;
                                            "
                                        >

                                            <source
                                                src="${mediaURL}"
                                                type="video/mp4"
                                            >

                                            Your browser does not support MP4 video.

                                        </video>

                                    </div>

                                `;

                            } else {

                                imageHTML = `

                                    <div
                                        class="post-image-container"
                                        style="
                                            margin-top:12px;
                                        "
                                    >

                                        <img
                                            src="${mediaURL}"
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

                        }


                        // ======================================
                        // FORMAT CONTENT
                        // ======================================

                        const formattedContent =
                            post.content
                                ? await formatPostContent(
                                    post.content
                                )
                                : "";


                        // ======================================
                        // RETURN POST
                        // ======================================

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
                                    formattedContent
                                        ? `
                                            <div
                                                class="post-content"
                                                style="
                                                    margin-top:10px;
                                                "
                                            >
                                                ${formattedContent}
                                            </div>
                                        `
                                        : ""
                                }


                                ${imageHTML}


                                <button
                                    onclick="
                                        toggleComments(
                                            '${escapeHtml(
                                                String(post.id)
                                            )}'
                                        )
                                    "
                                >
                                    💬 Comments
                                </button>


                                <div
                                    id="comments-${escapeHtml(
                                        String(post.id)
                                    )}"
                                    class="comments"
                                    style="
                                        display:none;
                                    "
                                >

                                    <div
                                        id="comment-list-${escapeHtml(
                                            String(post.id)
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
                                                String(post.id)
                                            )}"
                                            placeholder="Write a comment..."
                                            maxlength="500"
                                        >


                                        <input
                                            id="comment-image-${escapeHtml(
                                                String(post.id)
                                            )}"
                                            type="file"
                                            accept="
                                                image/png,
                                                image/jpeg,
                                                image/webp,
                                                image/gif,
                                                video/mp4,
                                                video/webm,
                                                video/quicktime
                                            "
                                        >


                                        <button
                                            onclick="
                                                submitComment(
                                                    '${escapeHtml(
                                                        String(post.id)
                                                    )}'
                                                )
                                            "
                                        >
                                            Send
                                        </button>


                                        <div
                                            id="comment-preview-${escapeHtml(
                                                String(post.id)
                                            )}"
                                            style="
                                                display:none;
                                                margin-top:8px;
                                            "
                                        >

                                            <img
                                                id="comment-preview-image-${escapeHtml(
                                                    String(post.id)
                                                )}"
                                                alt="Comment image preview"
                                                style="
                                                    max-width:200px;
                                                    max-height:200px;
                                                    border-radius:10px;
                                                    display:none;
                                                "
                                            >


                                            <video
                                                id="comment-preview-video-${escapeHtml(
                                                    String(post.id)
                                                )}"
                                                controls
                                                style="
                                                    max-width:300px;
                                                    max-height:300px;
                                                    border-radius:10px;
                                                    display:none;
                                                "
                                            ></video>


                                            <br>


                                            <button
                                                type="button"
                                                onclick="
                                                    clearCommentImage(
                                                        '${escapeHtml(
                                                            String(post.id)
                                                        )}'
                                                    )
                                                "
                                            >
                                                ❌ Remove media
                                            </button>

                                        </div>

                                    </div>

                                </div>

                            </article>

                        `;

                    }
                )

            );


        container.innerHTML =
            renderedPosts.join("");


        // ==========================================
        // COMMENT FILE PICKERS
        // ==========================================

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

                const previewVideo =
                    document.getElementById(
                        `comment-preview-video-${post.id}`
                    );


                if (
                    !input ||
                    !preview ||
                    !previewImage ||
                    !previewVideo
                ) {
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

                            previewImage.style.display =
                                "none";

                            previewVideo.style.display =
                                "none";

                            previewVideo.src =
                                "";

                            return;

                        }


                        // ==================================
                        // ALLOW IMAGE OR VIDEO
                        // ==================================

                        const isImage =
                            file.type.startsWith(
                                "image/"
                            );

                        const isVideo =
                            file.type.startsWith(
                                "video/"
                            );


                        if (
                            !isImage &&
                            !isVideo
                        ) {

                            alert(
                                "❌ Please choose an image or video."
                            );

                            input.value =
                                "";

                            return;

                        }


                        // ==================================
                        // 5MB LIMIT
                        // ==================================

                        if (
                            file.size >
                            5 * 1024 * 1024
                        ) {

                            alert(
                                "❌ File must be under 5MB."
                            );

                            input.value =
                                "";

                            return;

                        }


                        // ==================================
                        // IMAGE PREVIEW
                        // ==================================

                        if (isImage) {

                            previewVideo.pause();

                            previewVideo.src =
                                "";

                            previewVideo.style.display =
                                "none";

                            const reader =
                                new FileReader();

                            reader.onload =
                                event => {

                                    previewImage.src =
                                        event.target.result;

                                    previewImage.style.display =
                                        "inline-block";

                                    preview.style.display =
                                        "block";

                                };

                            reader.readAsDataURL(
                                file
                            );

                            return;

                        }


                        // ==================================
                        // VIDEO PREVIEW
                        // ==================================

                        if (isVideo) {

                            previewImage.src =
                                "";

                            previewImage.style.display =
                                "none";

                            const videoURL =
                                URL.createObjectURL(
                                    file
                                );

                            previewVideo.src =
                                videoURL;

                            previewVideo.style.display =
                                "inline-block";

                            preview.style.display =
                                "block";

                        }

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
   LOGIN / SIGNUP UI
================================================== */

function showSignup() {

    console.log(
        "🧌 Switching to signup UI..."
    );

    const loginBox =
        document.getElementById(
            "login-box"
        );

    const signupBox =
        document.getElementById(
            "signup-box"
        );

    if (!loginBox || !signupBox) {

        console.error(
            "❌ Login or signup box not found."
        );

        return;
    }

    loginBox.style.display =
        "none";

    signupBox.style.display =
        "block";

    const loginStatus =
        document.getElementById(
            "login-status"
        );

    if (loginStatus) {
        loginStatus.textContent =
            "";
    }

    const signupStatus =
        document.getElementById(
            "signup-status"
        );

    if (signupStatus) {
        signupStatus.textContent =
            "";
    }

    const username =
        document.getElementById(
            "signup-username"
        );

    if (username) {

        setTimeout(
            () => username.focus(),
            50
        );

    }

}


function showLogin() {

    console.log(
        "🧌 Switching to login UI..."
    );

    const loginBox =
        document.getElementById(
            "login-box"
        );

    const signupBox =
        document.getElementById(
            "signup-box"
        );

    if (!loginBox || !signupBox) {

        console.error(
            "❌ Login or signup box not found."
        );

        return;
    }

    signupBox.style.display =
        "none";

    loginBox.style.display =
        "block";

    const signupStatus =
        document.getElementById(
            "signup-status"
        );

    if (signupStatus) {
        signupStatus.textContent =
            "";
    }

    const email =
        document.getElementById(
            "login-email"
        );

    if (email) {

        setTimeout(
            () => email.focus(),
            50
        );

    }

}


window.showSignup =
    showSignup;

window.showLogin =
    showLogin;


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


    // ==========================================
    // CHECK POST
    // ==========================================

    if (!content && !file) {

        if (status) {

            status.textContent =
                "❌ Write something or select an image/video.";

        }

        return;

    }


    // ==========================================
    // CHECK FILE TYPE
    // ==========================================

    if (file) {

        const allowedTypes = [

            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/bmp",
            "video/mp4"

        ];

        if (
            !allowedTypes.includes(
                file.type
            )
        ) {

            if (status) {

                status.textContent =
                    "❌ Only images and MP4 videos are allowed.";

            }

            return;

        }

    }


    if (status) {

        status.textContent =
            "Posting...";

    }


    try {

        let image = null;


        // ==========================================
        // PREPARE FILE
        // ==========================================

        if (file) {

            // MP4 files must NOT go through
            // image compression/resizing.

            if (
                file.type ===
                "video/mp4"
            ) {

                image =
                    await fileToBase64(
                        file
                    );

            } else {

                image =
                    await prepareImage(
                        file
                    );

            }

        }


        // ==========================================
        // CREATE POST
        // ==========================================

        const response =
            await fetch(
                "/api/posts",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"

                    },

                    credentials:
                        "include",

                    body:
                        JSON.stringify({

                            content:
                                content,

                            image:
                                image,

                            mediaType:
                                file
                                    ? file.type
                                    : null

                        })

                }
            );


        const data =
            await getJsonResponse(
                response
            );


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not create post."
            );

        }


        // ==========================================
        // CLEAR FORM
        // ==========================================

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


        // ==========================================
        // RELOAD
        // ==========================================

        loadPosts();

        loadLeaderboard(
            currentLeaderboard
        );


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

async function toggleComments(
    postId
) {

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

async function loadComments(
    postId
) {

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
                `/api/posts/${encodeURIComponent(postId)}/comments`,
                {
                    credentials: "include",
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );

        const comments =
            await getJsonResponse(
                response
            );

        if (!response.ok) {

            throw new Error(
                comments.error ||
                "Could not load comments."
            );

        }

        if (!Array.isArray(comments)) {

            throw new Error(
                "Invalid comments response."
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

                        const formattedContent =
                            comment.content
                                ? await formatPostContent(
                                    comment.content
                                )
                                : "";

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
                                    formattedContent
                                        ? `
                                            <div
                                                class="comment-content"
                                            >
                                                ${formattedContent}
                                            </div>
                                        `
                                        : ""
                                }

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

async function submitComment(
    postId
) {

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
            await prepareImage(
                file
            );

        const response =
            await fetch(
                `/api/posts/${encodeURIComponent(postId)}/comments`,
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                        "Accept":
                            "application/json"
                    },

                    credentials: "include",

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
            await getJsonResponse(
                response
            );

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

        loadLeaderboard(
            currentLeaderboard
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

function clearCommentImage(
    postId
) {

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
        document.getElementById("people");

    if (!container) {
        return;
    }

    try {

        const response =
            await fetch("/api/users", {
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            });

        const users =
            await getJsonResponse(response);

        if (!response.ok) {

            throw new Error(
                users.error ||
                "Could not load people."
            );

        }

        if (!Array.isArray(users)) {

            throw new Error(
                "Invalid users response."
            );

        }

        allPeople = users;

        renderPeople(allPeople);

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


function renderPeople(users) {

    const container =
        document.getElementById("people");

    if (!container) {
        return;
    }

    if (!users.length) {

        container.innerHTML =
            "<p>No users found. 🧌</p>";

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

            const lastSeen =
                user.last_seen
                    ? new Date(
                        user.last_seen
                    ).getTime()
                    : 0;

            const isOnline =
                lastSeen > 0 &&
                (
                    Date.now() -
                    lastSeen
                ) < 30000;

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
                        ></span>

                    </div>

                    <div>

                        <strong>
                            ${escapeHtml(
                                displayName
                            )}
                        </strong>

                        <p>
                            @${escapeHtml(
                                user.username ||
                                "user"
                            )}
                        </p>

                    </div>

                </a>

            `;

        }).join("");

}


function searchPeople(query) {

    query =
        query
            .trim()
            .toLowerCase();

    if (!query) {

        renderPeople(
            allPeople
        );

        return;

    }

    const results =
        allPeople.filter(user => {

            const username =
                (
                    user.username ||
                    ""
                ).toLowerCase();

            const displayName =
                (
                    user.display_name ||
                    ""
                ).toLowerCase();

            return (
                username.includes(query) ||
                displayName.includes(query)
            );

        });

    renderPeople(results);

}
loadPeople();

setInterval(() => {
    loadPeople();
}, 10000);
const peopleSearch =
    document.getElementById(
        "people-search"
    );

if (peopleSearch) {

    peopleSearch.addEventListener(
        "input",
        () => {

            searchPeople(
                peopleSearch.value
            );

        }
    );

}
/* ==================================================
   SHREKBOOK POPUP MESSAGE
================================================== */

function showShrekBookMessage(
    title,
    message
) {

    const existing =
        document.getElementById(
            "shrekbook-message-popup"
        );

    if (existing) {
        existing.remove();
    }

    const popup =
        document.createElement(
            "div"
        );

    popup.id =
        "shrekbook-message-popup";

    popup.innerHTML = `

        <div class="shrekbook-message-box">

            <h2>
                ${escapeHtml(title)}
            </h2>

            <p>
                ${escapeHtml(message)}
            </p>

            <button
                id="closeShrekMessage"
            >
                OK
            </button>

        </div>

    `;

    document.body.appendChild(
        popup
    );

    const closeButton =
        document.getElementById(
            "closeShrekMessage"
        );

    if (closeButton) {

        closeButton.onclick =
            () => {

                popup.remove();

            };

    }

}


/* ==================================================
   MESSAGE TRACKING
================================================== */

let lastGlobalMessageId =
    localStorage.getItem(
        "shrekbook_last_global_message_id"
    );

let lastSpecificMessageId =
    localStorage.getItem(
        "shrekbook_last_specific_message_id"
    );


/* ==================================================
   SHREKCOIN DISPLAY
================================================== */

async function loadShrekCoins() {

    const display =
        document.getElementById(
            "shrekcoin-display"
        );

    const count =
        document.getElementById(
            "shrekcoin-count"
        );

    if (!display || !count) {
        return;
    }

    try {

        // getMeCached() already returns parsed data.
        const data =
            await getMeCached();

        if (
            !data ||
            !data.loggedIn
        ) {

            display.style.display =
                "none";

            return;
        }

        const coins =
            Number(
                data.user?.shrekcoins ??
                data.shrekcoins ??
                0
            );

        count.textContent =
            coins.toLocaleString();

        display.style.display =
            "block";

    } catch (error) {

        console.error(
            "SHREKCOIN LOAD ERROR:",
            error
        );

        display.style.display =
            "none";

    }

}


// Load immediately
loadShrekCoins();


// Refresh every 5 seconds
setInterval(
    loadShrekCoins,
    5000
);


/* ==================================================
   CHECK MESSAGES
================================================== */

async function checkMessages() {

    try {

        // IMPORTANT:
        // getMeCached() returns DATA.
        // It does NOT return Response.

        const data =
            await getMeCached();

        if (
            !data ||
            !data.loggedIn
        ) {
            return;
        }

        // GLOBAL MESSAGE

        if (
            data.globalMessage &&
            data.globalMessage.id !==
                lastGlobalMessageId
        ) {

            lastGlobalMessageId =
                data.globalMessage.id;

            localStorage.setItem(
                "shrekbook_last_global_message_id",
                String(
                    data.globalMessage.id
                )
            );

            showShrekBookMessage(
                "📢 ShrekBook Announcement",
                data.globalMessage.message
            );

        }

        // SPECIFIC MESSAGE

        if (
            data.specificMessage &&
            data.specificMessage.id !==
                lastSpecificMessageId
        ) {

            lastSpecificMessageId =
                data.specificMessage.id;

            localStorage.setItem(
                "shrekbook_last_specific_message_id",
                String(
                    data.specificMessage.id
                )
            );

            showShrekBookMessage(
                "📨 ShrekBook Message",
                data.specificMessage.message
            );

        }

    } catch (error) {

        console.error(
            "MESSAGE CHECK ERROR:",
            error
        );

    }

}


// Check immediately
checkMessages();


// Check every 2 seconds
setInterval(
    checkMessages,
    2000
);


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

                    method: "POST",

                    credentials: "include",

                    headers: {
                        "Content-Type":
                            "application/json",
                        "Accept":
                            "application/json"
                    }

                }
            );

        // 401 = not logged in.
        // Do not spam console.
        if (
            response.status === 401
        ) {
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

function startOnlineHeartbeat() {

    if (onlineHeartbeatStarted) {
        return;
    }

    onlineHeartbeatStarted =
        true;

    updateOnlineStatus();

    setInterval(
        updateOnlineStatus,
        30000
    );

}


/* ==================================================
   ROLE SYSTEM
================================================== */

function getUserRole(
    user
) {

    if (!user) {
        return "peasant";
    }

    let role =
        user.role ||
        user.user_role ||
        user.rank ||
        "peasant";

    role =
        String(role)
            .toLowerCase()
            .trim()
            .replace(
                /[\s-]+/g,
                "_"
            );

    const validRoles = [
        "owner",
        "admin",
        "administrator",
        "senior_moderator",
        "junior_moderator",
        "moderator",
        "peasant"
    ];

    if (
        !validRoles.includes(
            role
        )
    ) {
        return "peasant";
    }

    // Treat administrator as admin internally.
    if (
        role === "administrator"
    ) {
        return "admin";
    }

    return role;

}


/* ==================================================
   ROLE PERMISSIONS
================================================== */

function hasRole(
    user,
    requiredRole
) {

    const roleLevels = {

        peasant:
            0,

        moderator:
            1,

        junior_moderator:
            1,

        senior_moderator:
            2,

        admin:
            3,

        owner:
            4

    };

    const userRole =
        getUserRole(
            user
        );

    const userLevel =
        roleLevels[userRole] ??
        0;

    const requiredLevel =
        roleLevels[requiredRole] ??
        0;

    return (
        userLevel >=
        requiredLevel
    );

}


/* ==================================================
   INDIVIDUAL ROLE CHECKS
================================================== */

function isOwner(
    user
) {

    return hasRole(
        user,
        "owner"
    );

}


function isAdmin(
    user
) {

    return hasRole(
        user,
        "admin"
    );

}


function isSeniorModerator(
    user
) {

    return hasRole(
        user,
        "senior_moderator"
    );

}


function isJuniorModerator(
    user
) {

    return hasRole(
        user,
        "junior_moderator"
    );

}


/* ==================================================
   ADMIN PANEL ACCESS
================================================== */

function canAccessAdminPanel(
    user
) {

    if (!user) {
        return false;
    }

    const role =
        getUserRole(
            user
        );

    return (
        role === "owner" ||
        role === "admin"
    );

}


/* ==================================================
   MODERATION ACCESS
================================================== */

function canModerate(
    user
) {

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

function setupAdminNav(
    user
) {

    let adminNav =
        document.getElementById(
            "admin-nav"
        );

    if (!user) {

        if (adminNav) {
            adminNav.style.display =
                "none";
        }

        return;
    }

    const role =
        getUserRole(
            user
        );

    const allowed =
        canAccessAdminPanel(
            user
        );

    if (!allowed) {

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

    let roleLabel =
        "Admin";

    if (role === "owner") {
        roleLabel =
            "Owner";
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


/* ==================================================
   SPECIFIC ADMIN MESSAGE
================================================== */

let showingSpecificMessageCheck =
    false;


/* ==================================================
   CHECK SPECIFIC MESSAGE
================================================== */

async function checkSpecificMessages() {

    if (
        showingSpecificMessageCheck
    ) {
        return;
    }

    showingSpecificMessageCheck =
        true;

    try {

        const response =
            await fetch(
                "/api/specific-message",
                {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        "Accept":
                            "application/json",
                        "Cache-Control":
                            "no-cache"
                    }
                }
            );

        if (
            response.status === 401
        ) {
            return;
        }

        if (!response.ok) {
            return;
        }

        const data =
            await getJsonResponse(
                response
            );

        const message =
            data.message;

        if (!message) {
            return;
        }

        if (
            lastSpecificMessageId ===
            message.id
        ) {
            return;
        }

        lastSpecificMessageId =
            message.id;

        localStorage.setItem(
            "shrekbook_last_specific_message_id",
            String(
                message.id
            )
        );

        showSpecificMessage(
            message
        );

    } catch (error) {

        console.error(
            "SPECIFIC MESSAGE CHECK ERROR:",
            error
        );

    } finally {

        showingSpecificMessageCheck =
            false;

    }

}


/* ==================================================
   SHOW SPECIFIC MESSAGE
================================================== */

function showSpecificMessage(
    message
) {

    showingSpecificMessage =
        true;

    const sender =
        message.senderDisplayName ||
        message.senderUsername ||
        "Administrator";

    const overlay =
        document.createElement(
            "div"
        );

    overlay.id =
        "specific-message-overlay";

    overlay.style.cssText = `
        position:fixed;
        inset:0;
        background:rgba(0,0,0,0.65);
        display:flex;
        align-items:center;
        justify-content:center;
        z-index:999999;
        padding:20px;
    `;

    const box =
        document.createElement(
            "div"
        );

    box.style.cssText = `
        background:white;
        width:100%;
        max-width:500px;
        border-radius:18px;
        padding:30px;
        box-shadow:0 10px 40px rgba(0,0,0,0.3);
        text-align:center;
    `;

    box.innerHTML = `

        <div
            style="
                font-size:50px;
                margin-bottom:10px;
            "
        >
            🧌
        </div>

        <h2>
            ShrekBook Message
        </h2>

        <p
            style="
                color:#666;
                margin-bottom:20px;
            "
        >
            Message from
            <strong>
                ${escapeHtml(
                    sender
                )}
            </strong>
        </p>

        <div
            style="
                background:#f5f5f5;
                border-radius:12px;
                padding:18px;
                text-align:left;
                white-space:pre-wrap;
                overflow-wrap:anywhere;
                margin-bottom:25px;
            "
        >
            ${escapeHtml(
                message.message
            )}
        </div>

        <button
            id="specific-message-close"
            style="
                padding:12px 25px;
                border:none;
                border-radius:10px;
                cursor:pointer;
                font-weight:bold;
            "
        >
            Got it
        </button>

    `;

    overlay.appendChild(
        box
    );

    document.body.appendChild(
        overlay
    );

    const closeButton =
        document.getElementById(
            "specific-message-close"
        );

    if (closeButton) {

        closeButton.onclick =
            async () => {

                try {

                    await fetch(
                        "/api/specific-message",
                        {
                            method: "DELETE",
                            credentials:
                                "include"
                        }
                    );

                } catch (error) {

                    console.error(
                        "CLEAR SPECIFIC MESSAGE ERROR:",
                        error
                    );

                }

                overlay.remove();

                showingSpecificMessage =
                    false;

            };

    }

}


/* ==================================================
   MODERATION STATUS
   ONLY ONE VERSION OF THIS FUNCTION
================================================== */

async function checkModerationStatus() {

    if (moderationCheckRunning) {
        return;
    }

    moderationCheckRunning =
        true;

    try {

        const data =
            await getMeCached();

        if (
            !data ||
            !data.loggedIn
        ) {
            return;
        }

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

        moderationCheckRunning =
            false;

    }

}


/* ==================================================
   START MODERATION MONITOR
================================================== */

const currentPath =
    window.location.pathname
        .toLowerCase();

if (
    !currentPath.endsWith(
        "/login.html"
    ) &&
    !currentPath.endsWith(
        "/kicked.html"
    )
) {

    checkModerationStatus();

    setInterval(
        checkModerationStatus,
        2000
    );

}


/* ==================================================
   ADMIN BUTTON / ROLE CHECK
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

        const data =
            await getMeCached();

        if (
            !data ||
            !data.loggedIn
        ) {
            return;
        }

        const user =
            data.user ||
            null;

        if (!user) {
            return;
        }

        const role =
            getUserRole(
                user
            );

        const allowed =
            canAccessAdminPanel(
                user
            );

        if (allowed) {

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

function setupModerationUI(
    user
) {

    if (!user) {
        return;
    }

    const moderationElements =
        document.querySelectorAll(
            "[data-moderator-only]"
        );

    const allowed =
        canModerate(
            user
        );

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

function setupRoleUI(
    user
) {

    if (!user) {
        return;
    }

    const role =
        getUserRole(
            user
        );

    document
        .querySelectorAll(
            "[data-role-display]"
        )
        .forEach(
            element => {

                element.textContent =
                    role
                        .replace(
                            /_/g,
                            " "
                        )
                        .replace(
                            /\b\w/g,
                            c =>
                                c.toUpperCase()
                        );

            }
        );


    // Owner-only
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


    // Admin+
    document
        .querySelectorAll(
            "[data-admin-only]"
        )
        .forEach(
            element => {

                element.style.display =
                    canAccessAdminPanel(
                        user
                    )
                        ? ""
                        : "none";

            }
        );


    // Moderator+
    document
        .querySelectorAll(
            "[data-moderator-only]"
        )
        .forEach(
            element => {

                element.style.display =
                    canModerate(
                        user
                    )
                        ? ""
                        : "none";

            }
        );

}


/* ==================================================
   SESSION CHECK
================================================== */

async function checkLogin() {

    try {

        // IMPORTANT:
        // getMeCached() returns parsed data.

        const data =
            await getMeCached();

        if (
            data &&
            data.loggedIn &&
            data.user
        ) {

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

    if (adminButton) {

        adminButton.style.display =
            "none";

    }

}


/* ==================================================
   ROLE DEBUG
================================================== */

function debugUserRole(
    user
) {

    if (!user) {

        console.log(
            "👤 No user logged in."
        );

        return;

    }

    const role =
        getUserRole(
            user
        );

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
        "🔨 Junior Moderator:",
        isJuniorModerator(user)
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


/* ==================================================
   OPTIONAL GLOBAL FUNCTIONS
   Makes HTML onclick handlers work reliably.
================================================== */

window.login =
    login;

window.signup =
    signup;

window.logout =
    logout;

window.createPost =
    createPost;

window.giveReaction =
    giveReaction;

window.toggleComments =
    toggleComments;

window.submitComment =
    submitComment;

window.clearCommentImage =
    clearCommentImage;

window.clearPostImage =
    clearPostImage;

window.loadLeaderboard =
    loadLeaderboard;

window.loadPeople =
    loadPeople;

window.loadPosts =
    loadPosts;

window.loadInventory =
    loadInventory;

window.warn =
    warn;

window.debugUserRole =
    debugUserRole;

