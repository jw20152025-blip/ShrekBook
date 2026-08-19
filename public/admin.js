
// ==================================================
// SHREKBOOK ADMIN PANEL
// ==================================================

const userList =
    document.getElementById("user-list");

const messageBox =
    document.getElementById("message");


// ==================================================
// API HELPER
// ==================================================

async function api(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {
                credentials: "include",

                ...options,

                headers: {
                    "Content-Type":
                        "application/json",

                    ...(options.headers || {})
                }
            }
        );


    let data;

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
// MESSAGE
// ==================================================

function showMessage(
    text,
    type = "success"
) {

    messageBox.textContent =
        text;

    messageBox.className =
        `message ${type}`;

    messageBox.style.display =
        "block";

}


// ==================================================
// CHECK ADMIN
// ==================================================

async function checkAdmin() {

    try {

        await api(
            "/api/admin/auth"
        );

    } catch (error) {

        showMessage(
            error.message,
            "error"
        );

        userList.innerHTML = `
            <div class="empty">
                🚫 You do not have permission
                to access the admin panel.
            </div>
        `;

        throw error;

    }

}


// ==================================================
// LOAD USERS
// ==================================================

async function loadUsers() {

    userList.innerHTML =
        "Loading users...";


    try {

        await checkAdmin();


        const users =
            await api(
                "/api/admin/users"
            );


        renderUsers(
            users
        );


    } catch (error) {

        console.error(
            "LOAD USERS ERROR:",
            error
        );

        if (
            !userList.innerHTML.includes(
                "permission"
            )
        ) {

            userList.innerHTML = `
                <div class="empty">
                    ❌ ${escapeHtml(
                        error.message
                    )}
                </div>
            `;

        }

    }

}


// ==================================================
// RENDER USERS
// ==================================================

function renderUsers(
    users
) {

    if (
        !users ||
        users.length === 0
    ) {

        userList.innerHTML = `
            <div class="empty">
                No users found.
            </div>
        `;

        return;

    }


    userList.innerHTML =
        users.map(
            user => {

                const avatar =
                    escapeHtml(
                        user.avatar ||
                        "/default-avatar.png"
                    );


                const username =
                    escapeHtml(
                        user.username ||
                        "Unknown"
                    );


                const displayName =
                    escapeHtml(
                        user.display_name ||
                        ""
                    );


                const role =
                    escapeHtml(
                        user.role ||
                        "peasant"
                    );


                const active =
                    user.is_active !== false;


                return `

                    <div
                        class="user"
                        data-user-id="${escapeHtml(
                            user.id
                        )}"
                    >

                        <img
                            class="avatar"
                            src="${avatar}"
                            alt="Avatar"
                            onerror="this.src='/default-avatar.png'"
                        >


                        <div class="info">

                            <div class="username">
                                ${username}
                            </div>

                            <div class="display-name">
                                ${displayName}
                            </div>


                            <span class="role">
                                👑 ${role}
                            </span>


                            <span
                                class="status ${
                                    active
                                        ? "active"
                                        : "inactive"
                                }"
                            >
                                ${
                                    active
                                        ? "ACTIVE"
                                        : "DEACTIVATED"
                                }
                            </span>

                        </div>


                        <div class="actions">

                            ${
                                user.role === "admin"
                                ? `
                                    <button
                                        class="revoke"
                                        onclick="revokeAdmin('${escapeHtml(user.id)}')"
                                    >
                                        🔻 Revoke
                                    </button>
                                `
                                : ""
                            }


                            ${
                                active
                                ? `
                                    <button
                                        class="kick"
                                        onclick="kickUser('${escapeHtml(user.id)}')"
                                    >
                                        🚫 Kick
                                    </button>
                                `
                                : `
                                    <button
                                        class="reactivate"
                                        onclick="reactivateUser('${escapeHtml(user.id)}')"
                                    >
                                        ♻️ Reactivate
                                    </button>
                                `
                            }

                        </div>

                    </div>

                `;

            }
        ).join("");

}


// ==================================================
// REVOKE ADMIN
// ==================================================

async function revokeAdmin(
    userId
) {

    const confirmed =
        confirm(
            "Revoke this user's admin privileges and make them a peasant?"
        );


    if (!confirmed) {
        return;
    }


    try {

        await api(
            `/api/admin/users/${encodeURIComponent(
                userId
            )}/revoke`,
            {
                method: "POST"
            }
        );


        showMessage(
            "Admin privileges revoked."
        );


        await loadUsers();


    } catch (error) {

        showMessage(
            error.message,
            "error"
        );

    }

}


// ==================================================
// KICK USER
// ==================================================

async function kickUser(
    userId
) {

    const confirmed =
        confirm(
            "Kick this user? Their ShrekBook page will be deactivated."
        );


    if (!confirmed) {
        return;
    }


    try {

        await api(
            `/api/admin/users/${encodeURIComponent(
                userId
            )}/kick`,
            {
                method: "POST"
            }
        );


        showMessage(
            "User has been deactivated."
        );


        await loadUsers();


    } catch (error) {

        showMessage(
            error.message,
            "error"
        );

    }

}


// ==================================================
// REACTIVATE USER
// ==================================================

async function reactivateUser(
    userId
) {

    const confirmed =
        confirm(
            "Reactivate this user's ShrekBook page?"
        );


    if (!confirmed) {
        return;
    }


    try {

        await api(
            `/api/admin/users/${encodeURIComponent(
                userId
            )}/reactivate`,
            {
                method: "POST"
            }
        );


        showMessage(
            "User has been reactivated."
        );


        await loadUsers();


    } catch (error) {

        showMessage(
            error.message,
            "error"
        );

    }

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


// ==================================================
// START
// ==================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadUsers();

    }
);

