
// ==================================================
// SHREKBOOK ADMIN.JS
// ==================================================

let currentAdmin = null;
let allUsers = [];


// ==================================================
// DOM
// ==================================================

const usersContainer =
    document.getElementById("users");

const adminInfo =
    document.getElementById("admin-info");

const messageBox =
    document.getElementById("message");

const searchInput =
    document.getElementById("search");


// ==================================================
// MESSAGE
// ==================================================

function showMessage(
    message,
    type = "success"
) {

    messageBox.textContent =
        message;

    messageBox.className =
        type;

    messageBox.style.display =
        "block";


    setTimeout(() => {

        messageBox.style.display =
            "none";

    }, 4000);

}


// ==================================================
// API HELPER
// ==================================================

async function adminApi(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {
                credentials:
                    "include",

                cache:
                    "no-store",

                headers: {
                    "Content-Type":
                        "application/json",

                    "Cache-Control":
                        "no-cache",

                    ...(options.headers || {})
                },

                ...options
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


// ==================================================
// CHECK ADMIN ACCESS
// ==================================================

async function checkAdmin() {

    try {

        const data =
            await adminApi(
                "/api/admin/auth"
            );


        currentAdmin =
            data.user;


        adminInfo.textContent =
            `Logged in as ${currentAdmin.display_name || currentAdmin.username} — ${formatRole(currentAdmin.role)}`;


        await loadUsers();

    }

    catch (error) {

        console.error(
            "ADMIN AUTH ERROR:",
            error
        );


        adminInfo.textContent =
            "Access denied.";


        usersContainer.innerHTML = `
            <div class="loading">
                ❌ ${escapeHtml(error.message)}
            </div>
        `;

    }

}


// ==================================================
// LOAD USERS
// ==================================================

async function loadUsers() {

    try {

        usersContainer.innerHTML = `
            <div class="loading">
                Loading users...
            </div>
        `;


        allUsers =
            await adminApi(
                "/api/admin/users"
            );


        renderUsers(
            allUsers
        );

    }

    catch (error) {

        console.error(
            "LOAD USERS ERROR:",
            error
        );


        usersContainer.innerHTML = `
            <div class="loading">
                ❌ ${escapeHtml(error.message)}
            </div>
        `;

    }

}


// ==================================================
// RENDER
// ==================================================

function renderUsers(
    users
) {

    if (!users.length) {

        usersContainer.innerHTML = `
            <div class="loading">
                No users found.
            </div>
        `;

        return;

    }


    usersContainer.innerHTML =
        users
            .map(
                user =>
                    createUserCard(
                        user
                    )
            )
            .join("");

}


// ==================================================
// USER CARD
// ==================================================

function createUserCard(
    user
) {

    const isSelf =
        currentAdmin &&
        currentAdmin.id === user.id;


    const canManage =
        currentAdmin &&
        !isSelf &&
        roleLevel(
            currentAdmin.role
        ) >
        roleLevel(
            user.role
        );


    let badges = `
        <span class="badge">
            ${escapeHtml(
                formatRole(user.role)
            )}
        </span>
    `;


    if (user.banned) {

        badges += `
            <span class="badge banned">
                BANNED
            </span>
        `;

    }


    if (user.kicked) {

        badges += `
            <span class="badge kicked">
                KICKED
            </span>
        `;

    }


    return `

        <div class="user-card">

            <div class="user-top">

                <div>

                    <div class="user-name">

                        ${escapeHtml(
                            user.display_name ||
                            user.username ||
                            "Unknown"
                        )}

                    </div>

                    <div class="username">

                        @${escapeHtml(
                            user.username ||
                            ""
                        )}

                    </div>

                    <div class="badges">

                        ${badges}

                    </div>

                </div>

            </div>


            ${
                canManage
                ? `
                <div class="actions">

                    <button
                        class="role-button"
                        onclick="changeRole('${user.id}')"
                    >
                        Change Role
                    </button>


                    ${
                        user.banned

                        ? `
                        <button
                            class="unban-button"
                            onclick="unbanUser('${user.id}')"
                        >
                            Unban
                        </button>
                        `

                        : `
                        <button
                            class="ban-button"
                            onclick="banUser('${user.id}')"
                        >
                            Ban
                        </button>
                        `
                    }


                    ${
                        user.kicked

                        ? `
                        <button
                            class="clear-kick-button"
                            onclick="clearKick('${user.id}')"
                        >
                            Clear Kick
                        </button>
                        `

                        : `
                        <button
                            class="kick-button"
                            onclick="kickUser('${user.id}')"
                        >
                            Kick
                        </button>
                        `
                    }

                </div>
                `
                : `
                <div class="actions">
                    <span>
                        ${
                            isSelf
                            ? "This is you."
                            : "Insufficient permissions."
                        }
                    </span>
                </div>
                `
            }

        </div>

    `;

}


// ==================================================
// CHANGE ROLE
// ==================================================

async function changeRole(
    userId
) {

    const user =
        allUsers.find(
            u =>
                u.id === userId
        );


    if (!user) {
        return;
    }


    const newRole =
        prompt(
            `Enter new role for ${user.username}:\n\n` +
            `owner\n` +
            `administrator\n` +
            `senior_moderator\n` +
            `junior_moderator\n` +
            `peasant`,
            user.role
        );


    if (
        newRole === null
    ) {

        return;

    }


    try {

        const data =
            await adminApi(
                `/api/admin/users/${encodeURIComponent(userId)}/role`,
                {
                    method:
                        "PUT",

                    body:
                        JSON.stringify({
                            role:
                                newRole
                        })
                }
            );


        showMessage(
            `${user.username} is now ${formatRole(data.role)}.`
        );


        await loadUsers();

    }

    catch (error) {

        showMessage(
            error.message,
            "error"
        );

    }

}


// ==================================================
// BAN
// ==================================================

async function banUser(
    userId
) {

    const user =
        allUsers.find(
            u =>
                u.id === userId
        );


    if (!user) {
        return;
    }


    if (
        !confirm(
            `Ban ${user.username}?`
        )
    ) {

        return;

    }


    try {

        await adminApi(
            `/api/admin/users/${encodeURIComponent(userId)}/ban`,
            {
                method:
                    "POST"
            }
        );


        showMessage(
            `${user.username} has been banned.`
        );


        await loadUsers();

    }

    catch (error) {

        showMessage(
            error.message,
            "error"
        );

    }

}


// ==================================================
// UNBAN
// ==================================================

async function unbanUser(
    userId
) {

    const user =
        allUsers.find(
            u =>
                u.id === userId
        );


    if (!user) {
        return;
    }


    try {

        await adminApi(
            `/api/admin/users/${encodeURIComponent(userId)}/unban`,
            {
                method:
                    "POST"
            }
        );


        showMessage(
            `${user.username} has been unbanned.`
        );


        await loadUsers();

    }

    catch (error) {

        showMessage(
            error.message,
            "error"
        );

    }

}


// ==================================================
// KICK
// ==================================================

async function kickUser(
    userId
) {

    const user =
        allUsers.find(
            u =>
                u.id === userId
        );


    if (!user) {
        return;
    }


    if (
        !confirm(
            `Kick ${user.username}?`
        )
    ) {

        return;

    }


    try {

        await adminApi(
            `/api/admin/users/${encodeURIComponent(userId)}/kick`,
            {
                method:
                    "POST"
            }
        );


        showMessage(
            `${user.username} has been kicked.`
        );


        await loadUsers();

    }

    catch (error) {

        showMessage(
            error.message,
            "error"
        );

    }

}


// ==================================================
// CLEAR KICK
// ==================================================

async function clearKick(
    userId
) {

    try {

        await adminApi(
            `/api/admin/users/${encodeURIComponent(userId)}/clear-kick`,
            {
                method:
                    "POST"
            }
        );


        showMessage(
            "Kick cleared."
        );


        await loadUsers();

    }

    catch (error) {

        showMessage(
            error.message,
            "error"
        );

    }

}


// ==================================================
// SEARCH
// ==================================================

searchInput.addEventListener(
    "input",
    () => {

        const query =
            searchInput.value
                .trim()
                .toLowerCase();


        if (!query) {

            renderUsers(
                allUsers
            );

            return;

        }


        const filtered =
            allUsers.filter(
                user => {

                    const username =
                        String(
                            user.username ||
                            ""
                        )
                        .toLowerCase();

                    const displayName =
                        String(
                            user.display_name ||
                            ""
                        )
                        .toLowerCase();

                    return (
                        username.includes(
                            query
                        ) ||
                        displayName.includes(
                            query
                        )
                    );

                }
            );


        renderUsers(
            filtered
        );

    }
);


// ==================================================
// ROLE HELPERS
// ==================================================

function roleLevel(
    role
) {

    const levels = {

        peasant:
            0,

        junior_moderator:
            1,

        senior_moderator:
            2,

        administrator:
            3,

        owner:
            4

    };


    return (
        levels[role] ??
        -1
    );

}


function formatRole(
    role
) {

    return String(
        role || "peasant"
    )
        .replace(
            /_/g,
            " "
        )
        .replace(
            /\b\w/g,
            letter =>
                letter.toUpperCase()
        );

}


// ==================================================
// HTML ESCAPE
// ==================================================

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
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

async function resetUserPassword() {

    const userId =
        document.getElementById("resetUserId")
            .value.trim();

    const newPassword =
        document.getElementById("resetNewPassword")
            .value;

    const status =
        document.getElementById("resetPasswordStatus");


    if (!userId) {

        status.textContent =
            "❌ Enter the user's ID.";

        return;
    }


    if (!newPassword) {

        status.textContent =
            "❌ Enter a new password.";

        return;
    }


    if (newPassword.length < 6) {

        status.textContent =
            "❌ Password must be at least 6 characters.";

        return;
    }


    if (!confirm(
        "Reset this user's password?"
    )) {
        return;
    }


    status.textContent =
        "Resetting password...";


    try {

        const response =
            await fetch(
                "/api/admin/reset-password",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        userId,
                        newPassword
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Password reset failed."
            );

        }


        status.textContent =
            "✅ Password reset successfully!";


        document.getElementById(
            "resetNewPassword"
        ).value = "";


    } catch (error) {

        console.error(
            "PASSWORD RESET ERROR:",
            error
        );

        status.textContent =
            "❌ " + error.message;
    }
}

// ==================================================
// MESSAGE USER DROPDOWN
// ==================================================

function populateMessageUsers(users) {

    const select =
        document.getElementById(
            "specificUserId"
        );

    if (!select) return;


    select.innerHTML = `
        <option value="">
            Select a user...
        </option>
    `;


    users.forEach(user => {

        const option =
            document.createElement("option");


        option.value =
            user.id;


        option.textContent =
            `${user.display_name || user.username}
            (@${user.username})`;


        select.appendChild(option);

    });

}


// ==================================================
// GLOBAL MESSAGE
// ==================================================

async function sendGlobalMessage() {

    const input =
        document.getElementById(
            "globalMessage"
        );

    const status =
        document.getElementById(
            "globalMessageStatus"
        );


    const message =
        input.value.trim();


    if (!message) {

        status.textContent =
            "❌ Enter a message.";

        return;

    }


    if (!confirm(
        "Send this message to everyone currently online?"
    )) {

        return;

    }


    status.textContent =
        "Sending...";


    try {

        const response =
            await fetch(
                "/api/admin/global-message",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials:
                        "include",

                    body:
                        JSON.stringify({
                            message
                        })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Failed to send global message."
            );

        }


        input.value = "";


        status.textContent =
            "✅ Global message sent!";


    } catch (error) {

        console.error(
            "GLOBAL MESSAGE ERROR:",
            error
        );


        status.textContent =
            "❌ " +
            error.message;

    }

}


// ==================================================
// SPECIFIC MESSAGE
// ==================================================

async function sendSpecificMessageAdmin() {

    const userSelect =
        document.getElementById(
            "specificUserId"
        );

    const messageInput =
        document.getElementById(
            "specificMessage"
        );

    const status =
        document.getElementById(
            "specificMessageStatus"
        );


    const userId =
        userSelect.value;


    const message =
        messageInput.value.trim();


    if (!userId) {

        status.textContent =
            "❌ Select a user.";

        return;

    }


    if (!message) {

        status.textContent =
            "❌ Enter a message.";

        return;

    }


    if (!confirm(
        "Send this message to this user?"
    )) {

        return;

    }


    status.textContent =
        "Sending...";


    try {

        const response =
            await fetch(
                "/api/admin/specific-message",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials:
                        "include",

                    body:
                        JSON.stringify({

                            userId,
                            message

                        })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Failed to send message."
            );

        }


        messageInput.value = "";


        status.textContent =
            "✅ Message sent!";


    } catch (error) {

        console.error(
            "SPECIFIC MESSAGE ERROR:",
            error
        );


        status.textContent =
            "❌ " +
            error.message;

    }

}

async function loadMessageUsers() {

    const select =
        document.getElementById("specificUserId");

    if (!select) {

        console.error(
            "❌ specificUserId dropdown does not exist."
        );

        return;
    }


    try {

        const response =
            await fetch("/api/users", {

                method: "GET",

                credentials: "include",

                cache: "no-store"

            });


        if (!response.ok) {

            throw new Error(
                "HTTP " +
                response.status
            );

        }


        // YOUR /api/users RETURNS A PLAIN ARRAY
        const users =
            await response.json();


        console.log(
            "API USERS:",
            users
        );


        if (!Array.isArray(users)) {

            console.error(
                "❌ /api/users did not return an array:",
                users
            );

            return;
        }


        // Clear dropdown
        select.innerHTML = "";


        // Default option
        const defaultOption =
            document.createElement("option");

        defaultOption.value = "";

        defaultOption.textContent =
            "Select a user...";

        select.appendChild(
            defaultOption
        );


        // Add every user
        users.forEach(user => {

            const option =
                document.createElement("option");


            option.value =
                user.id;


            option.textContent =
                user.display_name ||
                user.username ||
                "Unknown user";


            select.appendChild(
                option
            );

        });


        console.log(
            "✅ Added",
            users.length,
            "users to specific message dropdown."
        );

    } catch (error) {

        console.error(
            "❌ DROPDOWN ERROR:",
            error
        );

    }

}






// ==================================================
// START
// ==================================================

checkAdmin();


document.addEventListener(
    "DOMContentLoaded",
    function () {

        console.log(
            "🧌 Admin page loaded."
        );

        loadMessageUsers();

    }
);
