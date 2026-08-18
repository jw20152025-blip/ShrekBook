
// ============================================================
// SHREKBOOK ADMIN PANEL
// public/admin.js
//
// Wired directly to the unified server.js:
//
// GET    /api/admin/me
// GET    /api/admin/users
// POST   /api/admin/users/:id/kick
// POST   /api/admin/users/:id/revoke
// POST   /api/admin/users/:id/unrevoke
// DELETE /api/admin/users/:id
// ============================================================

console.log("🧌 ShrekBook admin.js loaded");


// ============================================================
// API HELPER
// ============================================================

async function adminAPI(url, options = {}) {

    const response = await fetch(
        url,
        {
            credentials: "same-origin",

            ...options,

            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        }
    );

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


// ============================================================
// ELEMENT HELPERS
// ============================================================

function getElement(id) {
    return document.getElementById(id);
}

function setStatus(message, isError = false) {

    const status =
        getElement("admin-status");

    if (!status) {
        return;
    }

    status.textContent =
        message;

    status.style.color =
        isError
            ? "red"
            : "";

}


// ============================================================
// ADMIN CHECK
// ============================================================

async function checkAdminAccess() {

    setStatus("Checking admin access...");

    try {

        const data =
            await adminAPI(
                "/api/admin/me"
            );

        if (
            !data.isAdmin
        ) {

            setStatus(
                "You are not an administrator.",
                true
            );

            showAccessDenied();

            return false;
        }

        showAdminPanel();

        setStatus(
            `Logged in as ${getAdminName(data.user)}`
        );

        return true;

    } catch (error) {

        console.error(
            "ADMIN CHECK ERROR:",
            error
        );

        setStatus(
            error.message,
            true
        );

        showAccessDenied();

        return false;
    }
}


// ============================================================
// ADMIN NAME
// ============================================================

function getAdminName(user) {

    if (!user) {
        return "Admin";
    }

    return (
        user.display_name ||
        user.username ||
        "Admin"
    );
}


// ============================================================
// SHOW / HIDE ADMIN UI
// ============================================================

function showAdminPanel() {

    const panel =
        getElement("admin-panel");

    const denied =
        getElement("admin-denied");

    if (panel) {
        panel.style.display = "block";
    }

    if (denied) {
        denied.style.display = "none";
    }
}


function showAccessDenied() {

    const panel =
        getElement("admin-panel");

    const denied =
        getElement("admin-denied");

    if (panel) {
        panel.style.display = "none";
    }

    if (denied) {
        denied.style.display = "block";
    }
}


// ============================================================
// LOAD USERS
// ============================================================

async function loadAdminUsers() {

    const container =
        getElement("admin-users");

    if (!container) {

        console.warn(
            "Could not find #admin-users"
        );

        return;
    }

    container.innerHTML =
        "<p>Loading users...</p>";

    try {

        const data =
            await adminAPI(
                "/api/admin/users"
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

            container.appendChild(
                createUserElement(user)
            );

        }

    } catch (error) {

        console.error(
            "LOAD ADMIN USERS ERROR:",
            error
        );

        container.innerHTML =
            `<p style="color:red;">${escapeHTML(error.message)}</p>`;

    }
}


// ============================================================
// CREATE USER CARD
// ============================================================

function createUserElement(user) {

    const card =
        document.createElement(
            "div"
        );

    card.className =
        "admin-user";

    card.style.border =
        "1px solid #ccc";

    card.style.borderRadius =
        "10px";

    card.style.padding =
        "15px";

    card.style.marginBottom =
        "12px";


    // --------------------------------------------------------
    // USER INFORMATION
    // --------------------------------------------------------

    const name =
        user.display_name ||
        user.username ||
        "Unknown user";

    const username =
        user.username ||
        "unknown";

    const id =
        user.id ||
        "";

    const admin =
        user.is_admin === true ||
        user.role === "admin";

    const revoked =
        user.is_revoked === true;

    const kicked =
        isCurrentlyKicked(
            user
        );


    // --------------------------------------------------------
    // AVATAR
    // --------------------------------------------------------

    let avatarHTML =
        `<div style="
            width:60px;
            height:60px;
            border-radius:50%;
            display:flex;
            align-items:center;
            justify-content:center;
            background:#eee;
            font-size:30px;
            overflow:hidden;
        ">🧌</div>`;

    if (
        user.avatar_url
    ) {

        avatarHTML =
            `
            <img
                src="${escapeAttribute(user.avatar_url)}"
                alt="Avatar"
                style="
                    width:60px;
                    height:60px;
                    border-radius:50%;
                    object-fit:cover;
                "
            >
            `;

    }


    // --------------------------------------------------------
    // STATUS
    // --------------------------------------------------------

    let statusHTML =
        `<span>🟢 Active</span>`;

    if (revoked) {

        statusHTML =
            `<span style="color:red;font-weight:bold;">
                🚫 REVOKED
            </span>`;

    } else if (kicked) {

        statusHTML =
            `<span style="color:#d97700;font-weight:bold;">
                🦶 KICKED
            </span>`;

    }


    // --------------------------------------------------------
    // ROLE
    // --------------------------------------------------------

    let roleHTML =
        "";

    if (admin) {

        roleHTML =
            `
            <span style="
                background:#ffd700;
                padding:3px 7px;
                border-radius:5px;
                font-size:12px;
                font-weight:bold;
            ">
                👑 ADMIN
            </span>
            `;

    }


    // --------------------------------------------------------
    // KICK UNTIL
    // --------------------------------------------------------

    let kickHTML =
        "";

    if (
        user.kick_until &&
        kicked
    ) {

        const date =
            new Date(
                user.kick_until
            );

        if (
            !Number.isNaN(
                date.getTime()
            )
        ) {

            kickHTML =
                `
                <div>
                    Kicked until:
                    <strong>
                        ${escapeHTML(
                            date.toLocaleString()
                        )}
                    </strong>
                </div>
                `;

        }

    }


    // --------------------------------------------------------
    // BUILD CARD
    // --------------------------------------------------------

    card.innerHTML = `

        <div style="
            display:flex;
            align-items:center;
            gap:12px;
        ">

            ${avatarHTML}

            <div style="
                flex:1;
            ">

                <div style="
                    font-size:18px;
                    font-weight:bold;
                ">

                    ${escapeHTML(name)}

                    ${roleHTML}

                </div>

                <div>
                    @${escapeHTML(username)}
                </div>

                <small>
                    ID: ${escapeHTML(id)}
                </small>

                <div style="
                    margin-top:5px;
                ">

                    ${statusHTML}

                </div>

                ${kickHTML}

            </div>

        </div>


        <div style="
            margin-top:15px;
            display:flex;
            flex-wrap:wrap;
            gap:8px;
        ">

            <button
                type="button"
                onclick="kickUser('${escapeAttribute(id)}')"
            >
                🦶 Kick
            </button>

            ${
                revoked
                    ? `
                        <button
                            type="button"
                            onclick="unrevokeUser('${escapeAttribute(id)}')"
                        >
                            ✅ Unrevoke
                        </button>
                    `
                    : `
                        <button
                            type="button"
                            onclick="revokeUser('${escapeAttribute(id)}')"
                        >
                            🚫 Revoke
                        </button>
                    `
            }

            <button
                type="button"
                onclick="deleteUser('${escapeAttribute(id)}')"
                style="color:red;"
            >
                🗑️ Delete
            </button>

            <button
                type="button"
                onclick="viewUser('${escapeAttribute(id)}')"
            >
                👤 View Profile
            </button>

        </div>

    `;

    return card;
}


// ============================================================
// KICK USER
// ============================================================

async function kickUser(userId) {

    if (!userId) {
        return;
    }

    const input =
        prompt(
            "How many minutes should this user be kicked?",
            "60"
        );

    if (
        input === null
    ) {
        return;
    }

    let minutes =
        Number(input);

    if (
        !Number.isFinite(minutes) ||
        minutes <= 0
    ) {

        alert(
            "Please enter a valid number of minutes."
        );

        return;
    }

    minutes =
        Math.max(
            1,
            Math.min(
                minutes,
                43200
            )
        );


    try {

        setStatus(
            "Kicking user..."
        );

        const data =
            await adminAPI(
                `/api/admin/users/${encodeURIComponent(userId)}/kick`,
                {
                    method:
                        "POST",

                    body:
                        JSON.stringify({
                            minutes
                        })
                }
            );

        setStatus(
            data.message ||
            "User kicked."
        );

        await loadAdminUsers();

    } catch (error) {

        console.error(
            "KICK ERROR:",
            error
        );

        setStatus(
            error.message,
            true
        );

        alert(
            error.message
        );

    }
}


// ============================================================
// REVOKE USER
// ============================================================

async function revokeUser(userId) {

    if (!userId) {
        return;
    }

    const confirmed =
        confirm(
            "Are you sure you want to revoke this user's account?\n\nThis will also disable their Supabase authentication account."
        );

    if (!confirmed) {
        return;
    }


    try {

        setStatus(
            "Revoking user..."
        );

        const data =
            await adminAPI(
                `/api/admin/users/${encodeURIComponent(userId)}/revoke`,
                {
                    method:
                        "POST"
                }
            );

        setStatus(
            data.message ||
            "User revoked."
        );

        await loadAdminUsers();

    } catch (error) {

        console.error(
            "REVOKE ERROR:",
            error
        );

        setStatus(
            error.message,
            true
        );

        alert(
            error.message
        );

    }
}


// ============================================================
// UNREVOKE USER
// ============================================================

async function unrevokeUser(userId) {

    if (!userId) {
        return;
    }

    const confirmed =
        confirm(
            "Restore this user's account?"
        );

    if (!confirmed) {
        return;
    }


    try {

        setStatus(
            "Restoring user..."
        );

        const data =
            await adminAPI(
                `/api/admin/users/${encodeURIComponent(userId)}/unrevoke`,
                {
                    method:
                        "POST"
                }
            );

        setStatus(
            data.message ||
            "User restored."
        );

        await loadAdminUsers();

    } catch (error) {

        console.error(
            "UNREVOKE ERROR:",
            error
        );

        setStatus(
            error.message,
            true
        );

        alert(
            error.message
        );

    }
}


// ============================================================
// DELETE USER
// ============================================================

async function deleteUser(userId) {

    if (!userId) {
        return;
    }

    const confirmed =
        confirm(
            "⚠️ PERMANENT DELETE\n\nThis will delete the user's Supabase authentication account and profile.\n\nThis cannot be undone.\n\nContinue?"
        );

    if (!confirmed) {
        return;
    }

    const confirmation =
        prompt(
            "Type DELETE to permanently delete this user."
        );

    if (
        confirmation !==
        "DELETE"
    ) {

        alert(
            "Deletion cancelled."
        );

        return;
    }


    try {

        setStatus(
            "Deleting user..."
        );

        const data =
            await adminAPI(
                `/api/admin/users/${encodeURIComponent(userId)}`,
                {
                    method:
                        "DELETE"
                }
            );

        if (
            data.success
        ) {

            setStatus(
                "User permanently deleted."
            );

        }

        await loadAdminUsers();

    } catch (error) {

        console.error(
            "DELETE USER ERROR:",
            error
        );

        setStatus(
            error.message,
            true
        );

        alert(
            error.message
        );

    }
}


// ============================================================
// VIEW PROFILE
// ============================================================

function viewUser(userId) {

    if (!userId) {
        return;
    }

    window.location.href =
        "/profile.html?id=" +
        encodeURIComponent(
            userId
        );
}


// ============================================================
// CHECK KICK STATUS
// ============================================================

function isCurrentlyKicked(user) {

    if (
        !user ||
        !user.kick_until
    ) {

        return false;
    }

    const time =
        new Date(
            user.kick_until
        ).getTime();

    if (
        Number.isNaN(time)
    ) {

        return false;
    }

    return (
        time >
        Date.now()
    );
}


// ============================================================
// REFRESH
// ============================================================

async function refreshAdminUsers() {

    setStatus(
        "Refreshing users..."
    );

    await loadAdminUsers();

    setStatus(
        "User list refreshed."
    );
}


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


// ============================================================
// DOM READY
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const allowed =
            await checkAdminAccess();

        if (
            allowed
        ) {

            await loadAdminUsers();

        }

    }
);


// ============================================================
// GLOBAL FUNCTIONS
// ============================================================

window.checkAdminAccess =
    checkAdminAccess;

window.loadAdminUsers =
    loadAdminUsers;

window.refreshAdminUsers =
    refreshAdminUsers;

window.kickUser =
    kickUser;

window.revokeUser =
    revokeUser;

window.unrevokeUser =
    unrevokeUser;

window.deleteUser =
    deleteUser;

window.viewUser =
    viewUser;

