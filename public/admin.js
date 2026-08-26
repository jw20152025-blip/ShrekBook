
// ==================================================
// SHREKBOOK ADMIN.JS
// ==================================================

let currentAdmin = null;
let allUsers = [];


// ==================================================
// DOM HELPERS
// ==================================================

function getElement(id) {
    return document.getElementById(id);
}


// ==================================================
// MESSAGE
// ==================================================

function showMessage(message, type = "success") {

    const messageBox = getElement("message");

    if (!messageBox) {
        return;
    }

    messageBox.textContent = message;
    messageBox.className = type;
    messageBox.style.display = "block";

    setTimeout(() => {

        messageBox.style.display = "none";

    }, 4000);

}


// ==================================================
// API HELPER
// ==================================================

async function adminApi(url, options = {}) {

    const response = await fetch(
        url,
        {
            credentials: "include",
            cache: "no-store",

            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",

                ...(options.headers || {})
            },

            ...options
        }
    );


    let data = {};


    try {

        data = await response.json();

    }

    catch {

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

        const data = await adminApi(
            "/api/admin/auth"
        );


        currentAdmin = data.user;


        if (!currentAdmin) {

            throw new Error(
                "Administrator information unavailable."
            );

        }


        const adminInfo =
            getElement("admin-info");


        if (adminInfo) {

            adminInfo.textContent =
                `Logged in as ${
                    currentAdmin.display_name ||
                    currentAdmin.username ||
                    "Administrator"
                } — ${
                    formatRole(
                        currentAdmin.role
                    )
                }`;

        }


        await loadUsers();

        await loadMessageUsers();

    }

    catch (error) {

        console.error(
            "ADMIN AUTH ERROR:",
            error
        );


        const adminInfo =
            getElement("admin-info");


        if (adminInfo) {

            adminInfo.textContent =
                "Access denied.";

        }


        const usersContainer =
            getElement("users");


        if (usersContainer) {

            usersContainer.innerHTML = `

                <div class="loading">

                    ❌ ${
                        escapeHtml(
                            error.message
                        )
                    }

                </div>

            `;

        }

    }

}


// ==================================================
// LOAD USERS
// ==================================================

async function loadUsers() {

    try {

        const usersContainer =
            getElement("users");


        if (usersContainer) {

            usersContainer.innerHTML = `

                <div class="loading">
                    Loading users...
                </div>

            `;

        }


        allUsers =
            await adminApi(
                "/api/admin/users"
            );


        if (!Array.isArray(allUsers)) {

            throw new Error(
                "/api/admin/users did not return an array."
            );

        }


        renderUsers(allUsers);

        populateMessageUsers(allUsers);


        console.log(
            "📋 ADMIN USERS:",
            allUsers
        );

    }

    catch (error) {

        console.error(
            "LOAD USERS ERROR:",
            error
        );


        const usersContainer =
            getElement("users");


        if (usersContainer) {

            usersContainer.innerHTML = `

                <div class="loading">

                    ❌ ${
                        escapeHtml(
                            error.message
                        )
                    }

                </div>

            `;

        }

    }

}


// ==================================================
// RENDER USERS
// ==================================================

function renderUsers(users) {

    const usersContainer =
        getElement("users");


    if (!usersContainer) {
        return;
    }


    if (
        !Array.isArray(users) ||
        !users.length
    ) {

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
                    createUserCard(user)
            )
            .join("");

}


// ==================================================
// USER CARD
// ==================================================

function createUserCard(user) {

    const isSelf =
        currentAdmin &&
        currentAdmin.id === user.id;


    const canManage =
        currentAdmin &&
        !isSelf &&
        roleLevel(currentAdmin.role) >
        roleLevel(user.role);


    let badges = `

        <span class="badge">

            ${
                escapeHtml(
                    formatRole(
                        user.role
                    )
                )
            }

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

                        ${
                            escapeHtml(
                                user.display_name ||
                                user.username ||
                                "Unknown"
                            )
                        }

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
                            onclick="changeRole('${escapeHtml(user.id)}')"
                        >
                            Change Role
                        </button>


                        ${
                            user.banned

                            ? `

                                <button
                                    class="unban-button"
                                    onclick="unbanUser('${escapeHtml(user.id)}')"
                                >
                                    Unban
                                </button>

                            `

                            : `

                                <button
                                    class="ban-button"
                                    onclick="banUser('${escapeHtml(user.id)}')"
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
                                    onclick="clearKick('${escapeHtml(user.id)}')"
                                >
                                    Clear Kick
                                </button>

                            `

                            : `

                                <button
                                    class="kick-button"
                                    onclick="kickUser('${escapeHtml(user.id)}')"
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

async function changeRole(userId) {

    const user =
        allUsers.find(
            u => u.id === userId
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


    if (newRole === null) {
        return;
    }


    const validRoles = [
        "owner",
        "administrator",
        "senior_moderator",
        "junior_moderator",
        "peasant"
    ];


    if (!validRoles.includes(newRole.trim())) {

        showMessage(
            "Invalid role.",
            "error"
        );

        return;

    }


    try {

        const data =
            await adminApi(
                `/api/admin/users/${encodeURIComponent(userId)}/role`,
                {
                    method: "PUT",

                    body: JSON.stringify({
                        role: newRole.trim()
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

async function banUser(userId) {

    const user =
        allUsers.find(
            u => u.id === userId
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
                method: "POST"
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

async function unbanUser(userId) {

    const user =
        allUsers.find(
            u => u.id === userId
        );


    if (!user) {
        return;
    }


    try {

        await adminApi(
            `/api/admin/users/${encodeURIComponent(userId)}/unban`,
            {
                method: "POST"
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

async function kickUser(userId) {

    const user =
        allUsers.find(
            u => u.id === userId
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
                method: "POST"
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

async function clearKick(userId) {

    try {

        await adminApi(
            `/api/admin/users/${encodeURIComponent(userId)}/clear-kick`,
            {
                method: "POST"
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

function setupSearch() {

    const searchInput =
        getElement("search");


    if (!searchInput) {
        return;
    }


    searchInput.addEventListener(
        "input",
        () => {

            const query =
                searchInput.value
                    .trim()
                    .toLowerCase();


            if (!query) {

                renderUsers(allUsers);

                return;

            }


            const filtered =
                allUsers.filter(
                    user => {

                        const username =
                            String(
                                user.username || ""
                            )
                            .toLowerCase();


                        const displayName =
                            String(
                                user.display_name || ""
                            )
                            .toLowerCase();


                        return (
                            username.includes(query) ||
                            displayName.includes(query)
                        );

                    }
                );


            renderUsers(filtered);

        }
    );

}


// ==================================================
// ROLE HELPERS
// ==================================================

function roleLevel(role) {

    const levels = {

        peasant: 0,

        junior_moderator: 1,

        senior_moderator: 2,

        administrator: 3,

        owner: 4

    };


    return (
        levels[role] ??
        -1
    );

}


function formatRole(role) {

    return String(
        role || "peasant"
    )
        .replace(/_/g, " ")
        .replace(
            /\b\w/g,
            letter =>
                letter.toUpperCase()
        );

}


// ==================================================
// HTML ESCAPE
// ==================================================

function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// ==================================================
// RESET USER PASSWORD
// ==================================================

async function resetUserPassword() {

    const userId =
        getElement("resetUserId")
            ?.value
            .trim();


    const newPassword =
        getElement("resetNewPassword")
            ?.value;


    const status =
        getElement(
            "resetPasswordStatus"
        );


    if (!status) {
        return;
    }


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


    if (
        !confirm(
            "Reset this user's password?"
        )
    ) {
        return;
    }


    status.textContent =
        "Resetting password...";


    try {

        const data =
            await adminApi(
                "/api/admin/reset-password",
                {
                    method: "POST",

                    body: JSON.stringify({
                        userId,
                        newPassword
                    })
                }
            );


        status.textContent =
            "✅ Password reset successfully!";


        console.log(
            "PASSWORD RESET:",
            data
        );


        const passwordInput =
            getElement(
                "resetNewPassword"
            );


        if (passwordInput) {
            passwordInput.value = "";
        }

    }

    catch (error) {

        console.error(
            "PASSWORD RESET ERROR:",
            error
        );


        status.textContent =
            "❌ " +
            error.message;

    }

}


// ==================================================
// GLOBAL MESSAGE
// ==================================================

async function sendGlobalMessage() {

    const input =
        getElement(
            "globalMessage"
        );


    const status =
        getElement(
            "globalMessageStatus"
        );


    if (!input || !status) {
        return;
    }


    const message =
        input.value.trim();


    if (!message) {

        status.textContent =
            "❌ Enter a message.";

        return;

    }


    if (message.length > 1000) {

        status.textContent =
            "❌ Message is too long.";

        return;

    }


    if (
        !confirm(
            "Send this message to everyone currently online?"
        )
    ) {
        return;
    }


    status.textContent =
        "Sending...";


    try {

        const data =
            await adminApi(
                "/api/admin/global-message",
                {
                    method: "POST",

                    body: JSON.stringify({
                        message
                    })
                }
            );


        input.value = "";


        status.textContent =
            "✅ Global message sent!";


        console.log(
            "GLOBAL MESSAGE:",
            data
        );

    }

    catch (error) {

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
// SPECIFIC MESSAGE USER DROPDOWN
// ==================================================

function populateMessageUsers(users) {

    const select =
        getElement(
            "specificUserId"
        );


    if (!select) {
        return;
    }


    const previousValue =
        select.value;


    select.innerHTML = "";


    const defaultOption =
        document.createElement(
            "option"
        );


    defaultOption.value = "";

    defaultOption.textContent =
        "Select a user...";


    select.appendChild(
        defaultOption
    );


    if (!Array.isArray(users)) {
        return;
    }


    users.forEach(user => {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            user.id;


        option.textContent =
            `${
                user.display_name ||
                user.username ||
                "Unknown"
            } (@${
                user.username ||
                "unknown"
            })`;


        select.appendChild(
            option
        );

    });


    if (
        previousValue &&
        users.some(
            user =>
                user.id ===
                previousValue
        )
    ) {

        select.value =
            previousValue;

    }

}


// ==================================================
// LOAD MESSAGE USERS
// ==================================================

async function loadMessageUsers() {

    const select =
        getElement(
            "specificUserId"
        );


    if (!select) {

        console.warn(
            "specificUserId dropdown not found."
        );

        return;

    }


    try {

        const response =
            await fetch(
                "/api/users",
                {
                    method: "GET",

                    credentials: "include",

                    cache: "no-store",

                    headers: {
                        "Cache-Control":
                            "no-cache"
                    }
                }
            );


        const users =
            await response.json();


        if (!response.ok) {

            throw new Error(
                users.error ||
                `HTTP ${response.status}`
            );

        }


        if (!Array.isArray(users)) {

            throw new Error(
                "/api/users did not return an array."
            );

        }


        console.log(
            "📋 API USERS:",
            users
        );


        populateMessageUsers(
            users
        );


        console.log(
            "✅ Added",
            users.length,
            "users to specific message dropdown."
        );

    }

    catch (error) {

        console.error(
            "❌ DROPDOWN ERROR:",
            error
        );


        select.innerHTML = `

            <option value="">
                Failed to load users
            </option>

        `;

    }

}


// ==================================================
// SEND SPECIFIC MESSAGE
// ==================================================

async function sendSpecificMessageAdmin() {

    const userSelect =
        getElement(
            "specificUserId"
        );


    const messageInput =
        getElement(
            "specificMessage"
        );


    const status =
        getElement(
            "specificMessageStatus"
        );


    if (
        !userSelect ||
        !messageInput ||
        !status
    ) {

        console.error(
            "❌ Specific message elements missing."
        );

        return;

    }


    const userId =
        userSelect.value;


    const message =
        messageInput.value.trim();


    // ==================================================
    // VALIDATION
    // ==================================================

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


    if (message.length > 1000) {

        status.textContent =
            "❌ Message is too long.";

        return;

    }


    // Prevent accidental self-message
    if (
        currentAdmin &&
        currentAdmin.id === userId
    ) {

        status.textContent =
            "❌ You cannot send a specific message to yourself.";

        return;

    }


    const selectedOption =
        userSelect.options[
            userSelect.selectedIndex
        ];


    const username =
        selectedOption
            ? selectedOption.textContent
            : "this user";


    if (
        !confirm(
            `Send this message to ${username}?`
        )
    ) {
        return;
    }


    status.textContent =
        "Sending...";


    try {

        const data =
            await adminApi(
                "/api/admin/specific-message",
                {
                    method: "POST",

                    body: JSON.stringify({
                        userId,
                        message
                    })
                }
            );


        console.log(
            "📨 SPECIFIC MESSAGE SENT:",
            data
        );


        status.textContent =
            "✅ Specific message sent!";


        // Clear only the message.
        // Keep the selected user so you can
        // send another message immediately.
        messageInput.value = "";


    }

    catch (error) {

        console.error(
            "❌ SPECIFIC MESSAGE ERROR:",
            error
        );


        status.textContent =
            "❌ " +
            error.message;

    }

}


// ==================================================
// IMPORTANT:
// MAKE INLINE HTML onclick="" FUNCTIONS GLOBAL
// ==================================================

window.sendSpecificMessageAdmin =
    sendSpecificMessageAdmin;

window.sendGlobalMessage =
    sendGlobalMessage;

window.resetUserPassword =
    resetUserPassword;

window.changeRole =
    changeRole;

window.banUser =
    banUser;

window.unbanUser =
    unbanUser;

window.kickUser =
    kickUser;

window.clearKick =
    clearKick;


// ==================================================
// START
// ==================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "🧌 ShrekBook admin panel loaded."
        );


        setupSearch();

        checkAdmin();

    }
);
