
// ==================================================
// SHREKBOOK STAFF PANEL
// ==================================================

let currentUser = null;
let currentUserRole = null;
let selectedRoleUser = null;


// ==================================================
// ROLE DEFINITIONS
// ==================================================

const ROLE_POWER = {
    peasant: 1,
    moderator: 2,
    senior_moderator: 3,
    administrator: 4,
    owner: 5
};


const ROLE_NAMES = {
    peasant: "👤 Peasant",
    moderator: "🔨 Moderator",
    senior_moderator: "⚔️ Senior Moderator",
    administrator: "🛡️ Administrator",
    owner: "👑 Owner"
};


// ==================================================
// ESCAPE HTML
// ==================================================

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// ==================================================
// GET ROLE NAME
// ==================================================

function roleName(role) {

    return (
        ROLE_NAMES[role] ||
        "👤 Peasant"
    );

}


// ==================================================
// CHECK STAFF
// ==================================================

async function checkStaff() {

    try {

        const response =
            await fetch(
                "/api/admin/me",
                {
                    credentials: "include"
                }
            );

        const data =
            await response.json();

        document
            .getElementById("loading")
            .classList.add("hidden");


        if (
            !response.ok ||
            !data.isAdmin
        ) {

            document
                .getElementById("not-staff")
                .classList.remove("hidden");

            return;

        }


        currentUser =
            data.user ||
            null;

        currentUserRole =
            data.role ||
            "administrator";


        document
            .getElementById("staff-panel")
            .classList.remove("hidden");


        updateWelcome();


        await Promise.all([
            loadUsers(),
            loadBans(),
            loadAdmins(),
            loadKicks(),
            loadRevokes()
        ]);


    } catch (error) {

        console.error(
            "STAFF CHECK ERROR:",
            error
        );

        document
            .getElementById("loading")
            .innerHTML = `
                <h2>❌ Error</h2>
                <p>
                    Could not check staff status.
                </p>
            `;

    }

}


// ==================================================
// WELCOME MESSAGE
// ==================================================

function updateWelcome() {

    const welcome =
        document.getElementById(
            "staff-welcome"
        );

    const role =
        roleName(
            currentUserRole
        );

    welcome.textContent =
        `Welcome, ${role}. Use your powers wisely. 🏰`;

}


// ==================================================
// LOAD USERS
// ==================================================

async function loadUsers(search = "") {

    const container =
        document.getElementById(
            "user-list"
        );

    if (!container) {
        return;
    }


    container.innerHTML =
        "<p>Loading users...</p>";


    try {

        const url =
            search
                ? `/api/admin/users?search=${encodeURIComponent(search)}`
                : "/api/admin/users";


        const response =
            await fetch(
                url,
                {
                    credentials: "include"
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            container.innerHTML =
                `<p class="error">
                    ❌ ${escapeHtml(
                        data.error ||
                        "Could not load users."
                    )}
                </p>`;

            return;

        }


        const users =
            Array.isArray(data)
                ? data
                : Array.isArray(data.users)
                    ? data.users
                    : [];


        if (users.length === 0) {

            container.innerHTML =
                "<p>No users found.</p>";

            return;

        }


        container.innerHTML =
            users.map(
                renderUser
            ).join("");


    } catch (error) {

        console.error(
            "LOAD USERS ERROR:",
            error
        );

        container.innerHTML =
            `<p class="error">
                ❌ Could not load users.
            </p>`;

    }

}


// ==================================================
// RENDER USER
// ==================================================

function renderUser(user) {

    const id =
        user.id ||
        user.user_id ||
        "";

    const username =
        user.username ||
        "Unknown";

    const displayName =
        user.display_name ||
        username;

    const role =
        user.role ||
        "peasant";


    const isOwner =
        role === "owner";


    return `

        <div class="user-card">

            <h3>
                ${escapeHtml(
                    displayName
                )}
            </h3>

            <p class="muted">
                @${escapeHtml(
                    username
                )}
            </p>

            <span class="role-badge">
                ${escapeHtml(
                    roleName(role)
                )}
            </span>

            <p class="muted">
                ID:
                ${escapeHtml(id)}
            </p>

            <div class="actions">

                ${
                    isOwner

                    ?

                    `
                    <button
                        class="secondary"
                        disabled
                    >
                        👑 Owner Protected
                    </button>
                    `

                    :

                    `
                    <button
                        class="success"
                        onclick='openRoleModal(
                            ${JSON.stringify({
                                id,
                                username,
                                display_name:
                                    displayName,
                                role
                            })}
                        )'
                    >
                        🔄 Change Role
                    </button>
                    `
                }

            </div>

        </div>

    `;

}


// ==================================================
// SEARCH USERS
// ==================================================

async function searchUsers() {

    const input =
        document.getElementById(
            "user-search"
        );

    const search =
        input.value.trim();


    await loadUsers(
        search
    );

}


// ==================================================
// ENTER TO SEARCH
// ==================================================

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            document.activeElement?.id ===
                "user-search"
        ) {

            searchUsers();

        }

    }
);


// ==================================================
// OPEN ROLE MODAL
// ==================================================

function openRoleModal(user) {

    if (!user || !user.id) {
        return;
    }


    if (
        user.role === "owner"
    ) {

        alert(
            "👑 The owner cannot be modified."
        );

        return;

    }


    selectedRoleUser =
        user;


    document
        .getElementById(
            "role-user-name"
        )
        .textContent =
            user.display_name ||
            user.username ||
            "Unknown User";


    document
        .getElementById(
            "role-current"
        )
        .textContent =
            roleName(
                user.role
            );


    const select =
        document.getElementById(
            "role-select"
        );


    select.value =
        user.role ||
        "peasant";


    updateRoleWarning();


    document
        .getElementById(
            "role-modal"
        )
        .classList.remove(
            "hidden"
        );

}


// ==================================================
// CLOSE ROLE MODAL
// ==================================================

function closeRoleModal() {

    selectedRoleUser =
        null;


    document
        .getElementById(
            "role-modal"
        )
        .classList.add(
            "hidden"
        );

}


// ==================================================
// ROLE CHANGE WARNING
// ==================================================

function updateRoleWarning() {

    const select =
        document.getElementById(
            "role-select"
        );

    const warning =
        document.getElementById(
            "role-warning"
        );


    const newRole =
        select.value;


    if (
        newRole === "owner"
    ) {

        warning.textContent =
            "⚠️ Owner is reserved for the site owner.";

        return;

    }


    if (
        selectedRoleUser &&
        newRole === selectedRoleUser.role
    ) {

        warning.textContent =
            "No role change will be made.";

        return;

    }


    warning.textContent =
        `Change this user's role to ${roleName(newRole)}?`;

}


document
    .getElementById("role-select")
    ?.addEventListener(
        "change",
        updateRoleWarning
    );


// ==================================================
// SAVE ROLE
// ==================================================

async function saveRole() {

    if (
        !selectedRoleUser
    ) {
        return;
    }


    const newRole =
        document.getElementById(
            "role-select"
        ).value;


    if (
        newRole === "owner"
    ) {

        alert(
            "👑 Owner cannot be assigned through this panel."
        );

        return;

    }


    if (
        newRole ===
        selectedRoleUser.role
    ) {

        closeRoleModal();
        return;

    }


    const confirmed =
        confirm(
            `Change ${
                selectedRoleUser.display_name ||
                selectedRoleUser.username
            } to ${roleName(newRole)}?`
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                "/api/admin/role",
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

                            user_id:
                                selectedRoleUser.id,

                            role:
                                newRole

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
                    "Could not change role."
                )
            );

            return;

        }


        alert(
            `✅ Role changed to ${roleName(newRole)}`
        );


        closeRoleModal();


        await loadUsers(
            document
                .getElementById(
                    "user-search"
                )
                .value
                .trim()
        );


    } catch (error) {

        console.error(
            "CHANGE ROLE ERROR:",
            error
        );

        alert(
            "❌ Server error while changing role."
        );

    }

}


// ==================================================
// LOAD BANS
// ==================================================

async function loadBans() {

    const container =
        document.getElementById(
            "ban-list"
        );


    try {

        const response =
            await fetch(
                "/api/admin/bans",
                {
                    credentials: "include"
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            container.innerHTML =
                `<p class="error">
                    ❌ ${escapeHtml(
                        data.error ||
                        "Could not load bans."
                    )}
                </p>`;

            return;

        }


        const bans =
            Array.isArray(data)
                ? data
                : data.bans || [];


        const active =
            bans.filter(
                ban =>
                    ban.active === true ||
                    ban.active === "true" ||
                    ban.active === 1
            );


        if (
            active.length === 0
        ) {

            container.innerHTML =
                "<p>No active bans.</p>";

            return;

        }


        container.innerHTML =
            active.map(
                ban => `

                    <div class="ban-card">

                        <h3>
                            🚫
                            ${escapeHtml(
                                ban.email ||
                                "Unknown"
                            )}
                        </h3>

                        <p>
                            <strong>
                                Reason:
                            </strong>

                            ${escapeHtml(
                                ban.reason ||
                                "No reason provided."
                            )}
                        </p>

                        <p class="muted">
                            ${escapeHtml(
                                ban.banned_at
                                    ? new Date(
                                        ban.banned_at
                                    ).toLocaleString()
                                    : ""
                            )}
                        </p>

                        <button
                            class="success"
                            onclick="unban(
                                '${encodeURIComponent(
                                    ban.id
                                )}'
                            )"
                        >
                            Unban
                        </button>

                    </div>

                `
            ).join("");


    } catch (error) {

        console.error(
            "LOAD BANS ERROR:",
            error
        );

        container.innerHTML =
            "<p class='error'>❌ Could not load bans.</p>";

    }

}


// ==================================================
// BAN USER
// ==================================================

async function banEmail() {

    const email =
        document
            .getElementById(
                "ban-email"
            )
            .value
            .trim();


    const reason =
        document
            .getElementById(
                "ban-reason"
            )
            .value
            .trim();


    const status =
        document.getElementById(
            "ban-status"
        );


    if (!email) {

        status.textContent =
            "❌ Enter an email.";

        return;

    }


    status.textContent =
        "Banning...";


    try {

        const response =
            await fetch(
                "/api/admin/bans",
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
                            email,
                            reason
                        })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            status.textContent =
                `❌ ${
                    data.error ||
                    "Ban failed."
                }`;

            return;

        }


        status.textContent =
            "✅ User banned.";


        document
            .getElementById(
                "ban-email"
            )
            .value = "";


        document
            .getElementById(
                "ban-reason"
            )
            .value = "";


        await loadBans();


    } catch (error) {

        console.error(
            "BAN ERROR:",
            error
        );

        status.textContent =
            "❌ Server error.";

    }

}


// ==================================================
// UNBAN
// ==================================================

async function unban(
    encodedId
) {

    const id =
        decodeURIComponent(
            encodedId
        );


    if (
        !confirm(
            "Unban this user?"
        )
    ) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/admin/bans/${encodeURIComponent(id)}/unban`,
                {

                    method: "POST",

                    credentials:
                        "include"

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                "❌ " +
                (
                    data.error ||
                    "Unban failed."
                )
            );

            return;

        }


        await loadBans();


    } catch (error) {

        console.error(
            "UNBAN ERROR:",
            error
        );

        alert(
            "❌ Server error."
        );

    }

}


// ==================================================
// LOAD ADMINS
// ==================================================

async function loadAdmins() {

    const container =
        document.getElementById(
            "admin-list"
        );


    try {

        const response =
            await fetch(
                "/api/admin/admins",
                {
                    credentials: "include"
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            container.innerHTML =
                `<p class="error">
                    ❌ ${escapeHtml(
                        data.error ||
                        "Could not load administrators."
                    )}
                </p>`;

            return;

        }


        const admins =
            data.admins ||
            [];


        if (
            admins.length === 0
        ) {

            container.innerHTML =
                "<p>No administrators.</p>";

            return;

        }


        container.innerHTML =
            admins.map(
                admin => `

                    <div class="admin-card">

                        <h3>
                            🛡️
                            ${escapeHtml(
                                admin.display_name ||
                                admin.username ||
                                "Administrator"
                            )}
                        </h3>

                        <p>
                            Administrator
                        </p>

                        <small>
                            ${escapeHtml(
                                admin.id ||
                                admin.user_id ||
                                ""
                            )}
                        </small>

                    </div>

                `
            ).join("");


    } catch (error) {

        console.error(
            "LOAD ADMINS ERROR:",
            error
        );

        container.innerHTML =
            "<p class='error'>❌ Could not load administrators.</p>";

    }

}


// ==================================================
// ADD ADMIN
// ==================================================

async function addAdmin() {

    const userId =
        document
            .getElementById(
                "admin-user-id"
            )
            .value
            .trim();


    const status =
        document.getElementById(
            "admin-status"
        );


    if (!userId) {

        status.textContent =
            "❌ Enter a user UUID.";

        return;

    }


    status.textContent =
        "Adding...";


    try {

        const response =
            await fetch(
                "/api/admin/admins",
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
                            user_id:
                                userId
                        })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            status.textContent =
                `❌ ${
                    data.error ||
                    "Could not add administrator."
                }`;

            return;

        }


        status.textContent =
            "✅ Administrator added.";


        document
            .getElementById(
                "admin-user-id"
            )
            .value = "";


        await loadAdmins();


    } catch (error) {

        console.error(
            "ADD ADMIN ERROR:",
            error
        );

        status.textContent =
            "❌ Server error.";

    }

}


// ==================================================
// LOAD KICKS
// ==================================================

async function loadKicks() {

    const container =
        document.getElementById(
            "kick-list"
        );


    try {

        const response =
            await fetch(
                "/api/admin/kicks",
                {
                    credentials: "include"
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            container.innerHTML =
                `<p class="error">
                    ❌ ${escapeHtml(
                        data.error ||
                        "Could not load kicks."
                    )}
                </p>`;

            return;

        }


        const kicks =
            data.kicks ||
            (Array.isArray(data)
                ? data
                : []);


        if (
            kicks.length === 0
        ) {

            container.innerHTML =
                "<p>No kicks recorded.</p>";

            return;

        }


        container.innerHTML =
            kicks.map(
                kick => `

                    <div class="kick-card">

                        <h3>
                            👢 Kick
                        </h3>

                        <p>
                            User:
                            ${escapeHtml(
                                kick.user_id
                            )}
                        </p>

                        <p>
                            Reason:
                            ${escapeHtml(
                                kick.reason ||
                                "No reason provided."
                            )}
                        </p>

                        <p class="muted">
                            ${escapeHtml(
                                kick.kicked_at ||
                                ""
                            )}
                        </p>

                    </div>

                `
            ).join("");


    } catch (error) {

        console.error(
            "LOAD KICKS ERROR:",
            error
        );

        container.innerHTML =
            "<p class='error'>❌ Could not load kicks.</p>";

    }

}


// ==================================================
// LOAD REVOKES
// ==================================================

async function loadRevokes() {

    const container =
        document.getElementById(
            "revoke-list"
        );


    try {

        const response =
            await fetch(
                "/api/admin/revokes",
                {
                    credentials: "include"
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            container.innerHTML =
                `<p class="error">
                    ❌ ${escapeHtml(
                        data.error ||
                        "Could not load revocations."
                    )}
                </p>`;

            return;

        }


        const revokes =
            data.revokes ||
            (Array.isArray(data)
                ? data
                : []);


        if (
            revokes.length === 0
        ) {

            container.innerHTML =
                "<p>No staff revocations.</p>";

            return;

        }


        container.innerHTML =
            revokes.map(
                revoke => `

                    <div class="revoke-card">

                        <h3>
                            🔒 Staff Revocation
                        </h3>

                        <p>
                            User:
                            ${escapeHtml(
                                revoke.user_id
                            )}
                        </p>

                        <p>
                            Previous role:
                            ${escapeHtml(
                                roleName(
                                    revoke.previous_role
                                )
                            )}
                        </p>

                        <p>
                            Reason:
                            ${escapeHtml(
                                revoke.reason ||
                                "No reason provided."
                            )}
                        </p>

                        <p class="muted">
                            ${escapeHtml(
                                revoke.revoked_at ||
                                ""
                            )}
                        </p>

                    </div>

                `
            ).join("");


    } catch (error) {

        console.error(
            "LOAD REVOKES ERROR:",
            error
        );

        container.innerHTML =
            "<p class='error'>❌ Could not load revocations.</p>";

    }

}


// ==================================================
// LOGOUT
// ==================================================

async function logout() {

    try {

        await fetch(
            "/api/logout",
            {

                method: "POST",

                credentials:
                    "include"

            }
        );

    } finally {

        window.location.href =
            "/";

    }

}


// ==================================================
// CLOSE MODAL WHEN CLICKING BACKDROP
// ==================================================

document
    .getElementById("role-modal")
    ?.addEventListener(
        "click",
        event => {

            if (
                event.target.id ===
                "role-modal"
            ) {

                closeRoleModal();

            }

        }
    );


// ==================================================
// START
// ==================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        checkStaff();

    }
);

