
// ==================================================
// SHREKBOOK ADMIN PANEL
// ==================================================

let currentAdmin = null;
let allUsers = [];


// ==================================================
// API HELPER
// ==================================================

async function api(url, options = {}) {

    const response = await fetch(
        url,
        {
            credentials: "include",

            headers: {
                "Content-Type":
                    "application/json",

                ...(options.headers || {})
            },

            ...options
        }
    );

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {

        throw new Error(
            data?.error ||
            `Request failed (${response.status})`
        );

    }

    return data;
}


// ==================================================
// ELEMENTS
// ==================================================

const statusElement =
    document.getElementById("status");

const usersElement =
    document.getElementById("users");

const searchElement =
    document.getElementById("search");

const refreshButton =
    document.getElementById("refresh-btn");

const currentUserElement =
    document.getElementById("current-user");

const adminPanel =
    document.getElementById("admin-panel");


// ==================================================
// STATUS
// ==================================================

function setStatus(
    message,
    error = false
) {

    if (!statusElement) {
        return;
    }

    statusElement.textContent =
        message;

    statusElement.style.color =
        error
            ? "#dc2626"
            : "#15803d";
}


// ==================================================
// ESCAPE HTML
// ==================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


// ==================================================
// ROLE CLASS
// ==================================================

function roleClass(role) {

    return String(
        role || "peasant"
    )
        .toLowerCase()
        .replace(
            /\s+/g,
            "_"
        );

}


// ==================================================
// CHECK ADMIN
// ==================================================

async function checkAdmin() {

    try {

        setStatus(
            "Checking admin access..."
        );

        const data =
            await api(
                "/api/admin/auth"
            );

        if (
            !data ||
            !data.authorized
        ) {

            throw new Error(
                "You do not have permission to access the admin panel."
            );

        }

        currentAdmin =
            data.user;

        if (currentUserElement) {

            currentUserElement.textContent =
                `👑 ${
                    currentAdmin.display_name ||
                    currentAdmin.username
                } — ${
                    currentAdmin.role
                }`;

        }

        if (adminPanel) {

            adminPanel.classList.remove(
                "hidden"
            );

        }

        setStatus(
            "Admin access granted."
        );

        await loadUsers();

    } catch (error) {

        console.error(
            "ADMIN AUTH ERROR:",
            error
        );

        if (currentUserElement) {

            currentUserElement.textContent =
                "🚫 Access denied";

        }

        setStatus(
            error.message,
            true
        );

    }

}


// ==================================================
// LOAD USERS
// ==================================================

async function loadUsers() {

    try {

        setStatus(
            "Loading users..."
        );

        const data =
            await api(
                "/api/admin/users"
            );

        allUsers =
            Array.isArray(data)
                ? data
                : data.users || [];

        console.log(
            "ADMIN USERS:",
            allUsers
        );

        renderUsers();

        setStatus(
            `Loaded ${allUsers.length} users.`
        );

    } catch (error) {

        console.error(
            "LOAD USERS ERROR:",
            error
        );

        setStatus(
            error.message,
            true
        );

    }

}


// ==================================================
// RENDER USERS
// ==================================================

function renderUsers() {

    if (!usersElement) {
        return;
    }

    const search =
        searchElement
            ? searchElement.value
                .trim()
                .toLowerCase()
            : "";

    const filtered =
        allUsers.filter(
            user => {

                return (

                    String(
                        user.username || ""
                    )
                        .toLowerCase()
                        .includes(search)

                    ||

                    String(
                        user.display_name || ""
                    )
                        .toLowerCase()
                        .includes(search)

                );

            }
        );

    if (!filtered.length) {

        usersElement.innerHTML = `
            <div class="user-card empty">
                No users found.
            </div>
        `;

        return;
    }

    usersElement.innerHTML =
        filtered
            .map(renderUser)
            .join("");

}


// ==================================================
// RENDER USER
// ==================================================

function renderUser(user) {

    const role =
        user.role ||
        "peasant";

    const active =
        user.is_active === true;

    // IMPORTANT:
    // Backend field is "banned".
    const banned =
        user.banned === true;


    let statusHTML = "";


    if (banned) {

        statusHTML = `
            <div class="status banned">
                🚫 BANNED
            </div>
        `;

    }

    else if (!active) {

        statusHTML = `
            <div class="status inactive">
                🦵 Page deactivated
            </div>
        `;

    }

    else {

        statusHTML = `
            <div class="status active">
                🟢 Active
            </div>
        `;

    }


    const avatar =
        user.avatar ||
        "/default-avatar.png";


    // ==================================================
    // MODERATION BUTTONS
    //
    // ACTIVE:
    //     Kick + Ban
    //
    // KICKED:
    //     Reactivate + Ban
    //
    // BANNED:
    //     Unban ONLY
    // ==================================================

    let moderationButtons = "";


    if (banned === true) {

        moderationButtons = `
            <button
                type="button"
                class="success unban-user"
                data-id="${escapeHTML(user.id)}"
            >
                🔓 Unban
            </button>
        `;

    }

    else if (active === false) {

        moderationButtons = `
            <button
                type="button"
                class="success reactivate-user"
                data-id="${escapeHTML(user.id)}"
            >
                ♻️ Reactivate
            </button>

            <button
                type="button"
                class="danger ban-user"
                data-id="${escapeHTML(user.id)}"
            >
                🚫 Ban
            </button>
        `;

    }

    else {

        moderationButtons = `
            <button
                type="button"
                class="danger kick-user"
                data-id="${escapeHTML(user.id)}"
            >
                🦵 Kick
            </button>

            <button
                type="button"
                class="danger ban-user"
                data-id="${escapeHTML(user.id)}"
            >
                🚫 Ban
            </button>
        `;

    }


    return `
        <div
            class="user-card"
            data-user-id="${escapeHTML(user.id)}"
        >

            <div class="user-top">

                <img
                    class="avatar"
                    src="${escapeHTML(avatar)}"
                    onerror="this.src='/default-avatar.png'"
                >

                <div>

                    <div class="user-name">
                        ${escapeHTML(
                            user.display_name ||
                            user.username
                        )}
                    </div>

                    <div class="username">
                        @${escapeHTML(
                            user.username
                        )}
                    </div>

                    <span
                        class="role ${roleClass(role)}"
                    >
                        ${escapeHTML(role)}
                    </span>

                    ${statusHTML}

                </div>

            </div>


            <div class="actions">

                <select
                    class="role-select"
                    data-id="${escapeHTML(user.id)}"
                >

                    <option
                        value="owner"
                        ${
                            role === "owner"
                                ? "selected"
                                : ""
                        }
                    >
                        👑 Owner
                    </option>

                    <option
                        value="administrator"
                        ${
                            role === "administrator"
                                ? "selected"
                                : ""
                        }
                    >
                        🛡️ Administrator
                    </option>

                    <option
                        value="senior_moderator"
                        ${
                            role === "senior_moderator"
                                ? "selected"
                                : ""
                        }
                    >
                        ⭐ Senior Moderator
                    </option>

                    <option
                        value="junior_moderator"
                        ${
                            role === "junior_moderator"
                                ? "selected"
                                : ""
                        }
                    >
                        🔨 Junior Moderator
                    </option>

                    <option
                        value="peasant"
                        ${
                            role === "peasant"
                                ? "selected"
                                : ""
                        }
                    >
                        🧌 Peasant
                    </option>

                </select>


                <button
                    type="button"
                    class="success change-role"
                    data-id="${escapeHTML(user.id)}"
                >
                    🔄 Change Role
                </button>


                <button
                    type="button"
                    class="warning revoke-user"
                    data-id="${escapeHTML(user.id)}"
                >
                    ⬇️ Revoke
                </button>


                ${moderationButtons}

            </div>

        </div>
    `;

}


// ==================================================
// CHANGE ROLE
// ==================================================

async function changeRole(userId) {

    const select =
        document.querySelector(
            `.role-select[data-id="${CSS.escape(userId)}"]`
        );

    if (!select) {
        return;
    }

    const role =
        select.value;

    if (
        !confirm(
            `Change this user's role to "${role}"?`
        )
    ) {
        return;
    }

    try {

        await api(
            `/api/admin/users/${encodeURIComponent(userId)}/role`,
            {
                method: "PUT",

                body:
                    JSON.stringify({
                        role
                    })
            }
        );

        setStatus(
            `Role changed to ${role}.`
        );

        await loadUsers();

    } catch (error) {

        console.error(
            "CHANGE ROLE ERROR:",
            error
        );

        setStatus(
            error.message,
            true
        );

    }

}


// ==================================================
// REVOKE
// ==================================================

async function revokeUser(userId) {

    if (
        !confirm(
            "Revoke this user's staff privileges and make them a peasant?"
        )
    ) {
        return;
    }

    try {

        await api(
            `/api/admin/users/${encodeURIComponent(userId)}/role`,
            {
                method: "PUT",

                body:
                    JSON.stringify({
                        role: "peasant"
                    })
            }
        );

        setStatus(
            "User has been revoked."
        );

        await loadUsers();

    } catch (error) {

        console.error(
            "REVOKE ERROR:",
            error
        );

        setStatus(
            error.message,
            true
        );

    }

}


// ==================================================
// KICK
// ==================================================

async function kickUser(userId) {

    if (
        !confirm(
            "Kick this user? Their page will be deactivated, but their account/data will remain."
        )
    ) {
        return;
    }

    try {

        await api(
            `/api/admin/users/${encodeURIComponent(userId)}/kick`,
            {
                method: "POST"
            }
        );

        setStatus(
            "User has been kicked."
        );

        await loadUsers();

    } catch (error) {

        console.error(
            "KICK ERROR:",
            error
        );

        setStatus(
            error.message,
            true
        );

    }

}


// ==================================================
// REACTIVATE
// ==================================================

async function reactivateUser(userId) {

    if (
        !confirm(
            "Reactivate this user's ShrekBook page?"
        )
    ) {
        return;
    }

    try {

        await api(
            `/api/admin/users/${encodeURIComponent(userId)}/reactivate`,
            {
                method: "POST"
            }
        );

        setStatus(
            "User's page has been reactivated."
        );

        await loadUsers();

    } catch (error) {

        console.error(
            "REACTIVATE ERROR:",
            error
        );

        setStatus(
            error.message,
            true
        );

    }

}


// ==================================================
// BAN
// ==================================================

async function banUser(userId) {

    if (
        !confirm(
            "BAN this user? They will be prevented from using ShrekBook."
        )
    ) {
        return;
    }

    try {

        await api(
            `/api/admin/users/${encodeURIComponent(userId)}/ban`,
            {
                method: "POST"
            }
        );

        setStatus(
            "User has been banned."
        );

        await loadUsers();

    } catch (error) {

        console.error(
            "BAN ERROR:",
            error
        );

        setStatus(
            error.message,
            true
        );

    }

}


// ==================================================
// UNBAN
// ==================================================

async function unbanUser(userId) {

    if (
        !confirm(
            "Unban this user? Their page will become active again."
        )
    ) {
        return;
    }

    try {

        await api(
            `/api/admin/users/${encodeURIComponent(userId)}/unban`,
            {
                method: "POST"
            }
        );

        setStatus(
            "User has been unbanned and reactivated."
        );

        await loadUsers();

    } catch (error) {

        console.error(
            "UNBAN ERROR:",
            error
        );

        setStatus(
            error.message,
            true
        );

    }

}


// ==================================================
// BUTTON HANDLER
// ==================================================

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "button"
            );

        if (!button) {
            return;
        }

        const userId =
            button.dataset.id;

        if (!userId) {
            return;
        }

        if (
            button.classList.contains(
                "change-role"
            )
        ) {

            changeRole(userId);

        }

        else if (
            button.classList.contains(
                "revoke-user"
            )
        ) {

            revokeUser(userId);

        }

        else if (
            button.classList.contains(
                "kick-user"
            )
        ) {

            kickUser(userId);

        }

        else if (
            button.classList.contains(
                "reactivate-user"
            )
        ) {

            reactivateUser(userId);

        }

        else if (
            button.classList.contains(
                "ban-user"
            )
        ) {

            banUser(userId);

        }

        else if (
            button.classList.contains(
                "unban-user"
            )
        ) {

            unbanUser(userId);

        }

    }
);


// ==================================================
// SEARCH
// ==================================================

if (searchElement) {

    searchElement.addEventListener(
        "input",
        renderUsers
    );

}


// ==================================================
// REFRESH
// ==================================================

if (refreshButton) {

    refreshButton.addEventListener(
        "click",
        loadUsers
    );

}


// ==================================================
// START
// ==================================================

checkAdmin();
