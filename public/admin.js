// ==================================================
// SHREKBOOK ADMIN PANEL
// ==================================================

console.log(
    "🛡️ ShrekBook admin loaded"
);


// ==================================================
// API
// ==================================================

async function api(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {
                credentials:
                    "same-origin",

                ...options,

                headers: {
                    "Content-Type":
                        "application/json",

                    ...(options.headers || {})
                }
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
// ESCAPE
// ==================================================

function escapeHTML(
    value
) {

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


// ==================================================
// ADMIN CHECK
// ==================================================

async function checkAdmin() {

    const status =
        document.getElementById(
            "admin-status"
        );


    try {

        const data =
            await api(
                "/api/admin/me"
            );


        if (
            !data.isAdmin
        ) {

            throw new Error(
                "You are not an administrator."
            );

        }


        status.textContent =
            "🛡️ Admin access granted.";


        await loadUsers();


    } catch (error) {

        console.error(
            "ADMIN CHECK ERROR:",
            error
        );


        status.textContent =
            "❌ " +
            error.message;


        const users =
            document.getElementById(
                "users"
            );


        if (users) {

            users.innerHTML =
                "<p>Access denied.</p>";

        }

    }

}


// ==================================================
// LOAD USERS
// ==================================================

let allUsers = [];


async function loadUsers() {

    const container =
        document.getElementById(
            "users"
        );


    container.innerHTML =
        "Loading users...";


    try {

        const data =
            await api(
                "/api/admin/users"
            );


        allUsers =
            data.users || [];


        renderUsers();


    } catch (error) {

        console.error(
            "LOAD USERS ERROR:",
            error
        );


        container.innerHTML =
            `<p>❌ ${escapeHTML(error.message)}</p>`;

    }

}


// ==================================================
// RENDER USERS
// ==================================================

function renderUsers() {

    const container =
        document.getElementById(
            "users"
        );


    const search =
        document.getElementById(
            "search"
        )
            ?.value
            .trim()
            .toLowerCase() ||
        "";


    const users =
        allUsers.filter(
            user => {

                if (!search) {
                    return true;
                }


                return (

                    String(
                        user.username ||
                        ""
                    )
                        .toLowerCase()
                        .includes(search)

                    ||

                    String(
                        user.display_name ||
                        ""
                    )
                        .toLowerCase()
                        .includes(search)

                    ||

                    String(
                        user.id ||
                        ""
                    )
                        .toLowerCase()
                        .includes(search)

                );

            }
        );


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

        const element =
            document.createElement(
                "div"
            );


        element.className =
            "admin-user";


        const revoked =
            user.is_revoked === true;


        const kicked =
            user.kicked_until &&
            new Date(
                user.kicked_until
            ) > new Date();


        let status =
            "🟢 Active";


        if (revoked) {

            status =
                "🚫 REVOKED";

        } else if (kicked) {

            status =
                "🦶 KICKED";

        }


        const adminLabel =
            user.is_admin
                ? " 👑 ADMIN"
                : "";


        element.innerHTML = `

            <div>

                <strong>
                    ${escapeHTML(
                        user.display_name ||
                        user.username ||
                        "Unknown"
                    )}
                </strong>

                <br>

                <small>
                    @${escapeHTML(
                        user.username ||
                        ""
                    )}
                </small>

                <br>

                <small>
                    ${status}${adminLabel}
                </small>

            </div>


            <div>

                ${
                    user.is_admin
                        ? `
                            <span>
                                👑 Admin
                            </span>
                        `
                        : `
                            ${
                                revoked
                                    ? `
                                        <button
                                            onclick="unrevokeUser('${user.id}')"
                                        >
                                            🔓 Unrevoke
                                        </button>
                                    `
                                    : `
                                        <button
                                            onclick="revokeUser('${user.id}')"
                                        >
                                            🚫 Revoke
                                        </button>
                                    `
                            }

                            ${
                                kicked
                                    ? `
                                        <button
                                            onclick="unkickUser('${user.id}')"
                                        >
                                            🔓 Unkick
                                        </button>
                                    `
                                    : `
                                        <button
                                            onclick="kickUser('${user.id}')"
                                        >
                                            🦶 Kick
                                        </button>
                                    `
                            }
                        `
                }

            </div>

        `;


        container.appendChild(
            element
        );

    }

}


// ==================================================
// KICK
// ==================================================

async function kickUser(
    userId
) {

    const minutes =
        prompt(
            "How many minutes should this user be kicked?"
        );


    if (
        minutes === null
    ) {

        return;

    }


    const duration =
        Number(minutes);


    if (
        !Number.isFinite(duration) ||
        duration < 1
    ) {

        alert(
            "Invalid duration."
        );

        return;

    }


    if (
        !confirm(
            `Kick this user for ${duration} minutes?`
        )
    ) {

        return;

    }


    try {

        await api(
            `/api/admin/users/${encodeURIComponent(userId)}/kick`,
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        minutes:
                            duration
                    })
            }
        );


        alert(
            "🦶 User kicked."
        );


        await loadUsers();


    } catch (error) {

        alert(
            "❌ " +
            error.message
        );

    }

}


// ==================================================
// UNKICK
// ==================================================

async function unkickUser(
    userId
) {

    if (
        !confirm(
            "Remove this user's kick?"
        )
    ) {

        return;

    }


    try {

        await api(
            `/api/admin/users/${encodeURIComponent(userId)}/unkick`,
            {
                method:
                    "POST"
            }
        );


        await loadUsers();


    } catch (error) {

        alert(
            "❌ " +
            error.message
        );

    }

}


// ==================================================
// REVOKE
// ==================================================

async function revokeUser(
    userId
) {

    if (
        !confirm(
            "⚠️ REVOKE this account?\n\nThe user will be unable to use ShrekBook."
        )
    ) {

        return;

    }


    try {

        await api(
            `/api/admin/users/${encodeURIComponent(userId)}/revoke`,
            {
                method:
                    "POST"
            }
        );


        alert(
            "🚫 User revoked."
        );


        await loadUsers();


    } catch (error) {

        alert(
            "❌ " +
            error.message
        );

    }

}


// ==================================================
// UNREVOKE
// ==================================================

async function unrevokeUser(
    userId
) {

    if (
        !confirm(
            "Restore this account?"
        )
    ) {

        return;

    }


    try {

        await api(
            `/api/admin/users/${encodeURIComponent(userId)}/unrevoke`,
            {
                method:
                    "POST"
            }
        );


        alert(
            "🔓 User restored."
        );


        await loadUsers();


    } catch (error) {

        alert(
            "❌ " +
            error.message
        );

    }

}


// ==================================================
// SEARCH
// ==================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const search =
            document.getElementById(
                "search"
            );


        if (search) {

            search.addEventListener(
                "input",
                renderUsers
            );

        }


        checkAdmin();

    }
);


// ==================================================
// GLOBAL FUNCTIONS
// ==================================================

window.loadUsers =
    loadUsers;

window.kickUser =
    kickUser;

window.unkickUser =
    unkickUser;

window.revokeUser =
    revokeUser;

window.unrevokeUser =
    unrevokeUser;