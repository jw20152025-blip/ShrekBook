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
// ROLE NAME
// ==================================================

function roleName(role) {

    return (
        ROLE_NAMES[role] ||
        "👤 Peasant"
    );

}


// ==================================================
// SAFE JSON
// ==================================================

async function readJson(response) {

    const text =
        await response.text();

    try {

        return text
            ? JSON.parse(text)
            : {};

    }

    catch {

        return {
            error:
                `Server returned ${response.status} instead of JSON.`
        };

    }

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
                    credentials:
                        "include"
                }
            );


        const data =
            await readJson(
                response
            );


        document
            .getElementById("loading")
            .classList
            .add("hidden");


        if (
            !response.ok ||
            !data.isStaff
        ) {

            document
                .getElementById("not-staff")
                .classList
                .remove("hidden");

            return;

        }


        currentUser =
            data.user || null;

        currentUserRole =
            data.role || "peasant";


        document
            .getElementById("staff-panel")
            .classList
            .remove("hidden");


        updateWelcome();


        await Promise.all([
            loadUsers(),
            loadBans(),
            loadAdmins(),
            loadKicks(),
            loadRevokes()
        ]);

    }

    catch (error) {

        console.error(
            "STAFF CHECK ERROR:",
            error
        );


        document
            .getElementById("loading")
            .innerHTML = `
                <h2>❌ Error</h2>
                <p>Could not check staff status.</p>
            `;

    }

}


// ==================================================
// WELCOME
// ==================================================

function updateWelcome() {

    const welcome =
        document.getElementById(
            "staff-welcome"
        );


    welcome.textContent =
        `Welcome, ${roleName(currentUserRole)}. Use your powers wisely. 🏰`;

}


// ==================================================
// LOAD USERS
// ==================================================

async function loadUsers(
    search = ""
) {

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
                    credentials:
                        "include"
                }
            );


        const data =
            await readJson(
                response
            );


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
                : data.users || [];


        if (!users.length) {

            container.innerHTML =
                "<p>No users found.</p>";

            return;

        }


        container.innerHTML =
            users
                .map(renderUser)
                .join("");

    }

    catch (error) {

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


    const targetPower =
        ROLE_POWER[role] ||
        1;


    const myPower =
        ROLE_POWER[
            currentUserRole
        ] ||
        1;


    const protectedOwner =
        role === "owner";


    const protectedEqual =
        targetPower >= myPower;


    let buttons = "";


    if (
        protectedOwner ||
        protectedEqual
    ) {

        buttons = `
            <button
                class="secondary"
                disabled
            >
                ${
                    protectedOwner
                        ? "👑 Owner Protected"
                        : "🔒 Protected"
                }
            </button>
        `;

    }

    else {

        buttons = `

            <button
                class="success"
                onclick='openRoleModal(${JSON.stringify({
                    id,
                    username,
                    display_name:
                        displayName,
                    role
                }).replace(/'/g, "&#39;")})'
            >
                🔄 Change Role
            </button>


            <button
                class="danger"
                onclick='kickUser(
                    ${JSON.stringify(id)},
                    ${JSON.stringify(displayName)}
                )'
            >
                👢 Kick
            </button>


            ${
                targetPower > 1
                    ? `
                        <button
                            class="secondary"
                            onclick='revokeStaff(
                                ${JSON.stringify(id)},
                                ${JSON.stringify(displayName)}
                            )'
                        >
                            🔒 Revoke Staff
                        </button>
                    `
                    : ""
            }

        `;

    }


    return `

        <div class="user-card">

            <h3>
                ${escapeHtml(displayName)}
            </h3>

            <p class="muted">
                @${escapeHtml(username)}
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
                ${buttons}
            </div>

        </div>

    `;

}


// ==================================================
// SEARCH
// ==================================================

async function searchUsers() {

    const input =
        document.getElementById(
            "user-search"
        );


    await loadUsers(
        input.value.trim()
    );

}


// ==================================================
// ROLE MODAL
// ==================================================

function openRoleModal(user) {

    if (!user?.id) {
        return;
    }


    if (
        user.role ===
        "owner"
    ) {

        alert(
            "👑 The owner is protected."
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
            "Unknown";


    document
        .getElementById(
            "role-current"
        )
        .textContent =
            roleName(
                user.role
            );


    document
        .getElementById(
            "role-select"
        )
        .value =
            user.role ||
            "peasant";


    updateRoleWarning();


    document
        .getElementById(
            "role-modal"
        )
        .classList
        .remove("hidden");

}


function closeRoleModal() {

    selectedRoleUser =
        null;


    document
        .getElementById(
            "role-modal"
        )
        .classList
        .add("hidden");

}


// ==================================================
// ROLE WARNING
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


    if (
        select.value ===
        "owner"
    ) {

        warning.textContent =
            "⚠️ Owner cannot be assigned.";

        return;

    }


    if (
        selectedRoleUser &&
        select.value ===
            selectedRoleUser.role
    ) {

        warning.textContent =
            "No role change will be made.";

        return;

    }


    warning.textContent =
        `Change this user to ${roleName(
            select.value
        )}?`;

}


// ==================================================
// SAVE ROLE
// ==================================================

async function saveRole() {

    if (!selectedRoleUser) {
        return;
    }


    const role =
        document
            .getElementById(
                "role-select"
            )
            .value;


    if (
        role ===
        "owner"
    ) {

        alert(
            "👑 Owner cannot be assigned."
        );

        return;

    }


    if (
        role ===
        selectedRoleUser.role
    ) {

        closeRoleModal();
        return;

    }


    if (
        !confirm(
            `Change ${selectedRoleUser.display_name || selectedRoleUser.username} to ${roleName(role)}?`
        )
    ) {

        return;

    }


    try {

        const response =
            await fetch(
                "/api/admin/role",
                {

                    method:
                        "POST",

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
                            role
                        })

                }
            );


        const data =
            await readJson(
                response
            );


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
            `✅ Role changed to ${roleName(role)}`
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


        await loadAdmins();

    }

    catch (error) {

        console.error(
            "ROLE ERROR:",
            error
        );


        alert(
            "❌ Could not contact server."
        );

    }

}


// ==================================================
// KICK USER
// ==================================================

async function kickUser(
    userId,
    displayName
) {

    const reason =
        prompt(
            `Why are you kicking ${displayName}?`
        );


    if (
        reason ===
        null
    ) {
        return;
    }


    try {

        const response =
            await fetch(
                "/api/admin/kicks",
                {

                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials:
                        "include",

                    body:
                        JSON.stringify({

                            user_id:
                                userId,

                            reason:
                                reason.trim()

                        })

                }
            );


        const data =
            await readJson(
                response
            );


        if (!response.ok) {

            alert(
                "❌ " +
                (
                    data.error ||
                    "Kick failed."
                )
            );

            return;

        }


        alert(
            `👢 ${displayName} was kicked.`
        );


        await loadKicks();

    }

    catch (error) {

        console.error(
            "KICK ERROR:",
            error
        );


        alert(
            "❌ Could not contact server."
        );

    }

}


// ==================================================
// REVOKE STAFF
// ==================================================

async function revokeStaff(
    userId,
    displayName
) {

    const reason =
        prompt(
            `Why are you revoking ${displayName}'s staff powers?`
        );


    if (
        reason ===
        null
    ) {
        return;
    }


    try {

        const response =
            await fetch(
                "/api/admin/revoke",
                {

                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials:
                        "include",

                    body:
                        JSON.stringify({

                            user_id:
                                userId,

                            reason:
                                reason.trim()

                        })

                }
            );


        const data =
            await readJson(
                response
            );


        if (!response.ok) {

            alert(
                "❌ " +
                (
                    data.error ||
                    "Revocation failed."
                )
            );

            return;

        }


        alert(
            `🔒 ${displayName}'s staff powers were revoked.`
        );


        await loadUsers(
            document
                .getElementById(
                    "user-search"
                )
                .value
                .trim()
        );


        await loadAdmins();

    }

    catch (error) {

        console.error(
            "REVOKE ERROR:",
            error
        );


        alert(
            "❌ Could not contact server."
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
                    credentials:
                        "include"
                }
            );


        const data =
            await readJson(
                response
            );


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
            data.bans || [];


        const active =
            bans.filter(
                ban =>
                    ban.active === true ||
                    ban.active === "true" ||
                    ban.active === 1
            );


        if (!active.length) {

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
                                ban.user_id ||
                                "Unknown"
                            )}
                        </h3>

                        <p>
                            Reason:
                            ${escapeHtml(
                                ban.reason ||
                                "No reason provided."
                            )}
                        </p>

                        <button
                            class="success"
                            onclick="unban('${encodeURIComponent(ban.id)}')"
                        >
                            ✅ Unban
                        </button>

                    </div>

                `
            ).join("");

    }

    catch (error) {

        console.error(
            "BANS ERROR:",
            error
        );

        container.innerHTML =
            "<p class='error'>❌ Could not load bans.</p>";

    }

}


// ==================================================
// BAN
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

                    method:
                        "POST",

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
            await readJson(
                response
            );


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

    }

    catch (error) {

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

                    method:
                        "POST",

                    credentials:
                        "include"

                }
            );


        const data =
            await readJson(
                response
            );


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

    }

    catch (error) {

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
                    credentials:
                        "include"
                }
            );


        const data =
            await readJson(
                response
            );


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
            data.admins || [];


        if (!admins.length) {

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
                            ${escapeHtml(
                                roleName(
                                    admin.role
                                )
                            )}
                        </p>

                    </div>

                `
            ).join("");

    }

    catch (error) {

        console.error(
            "ADMINS ERROR:",
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

                    method:
                        "POST",

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
            await readJson(
                response
            );


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
        await loadUsers();

    }

    catch (error) {

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
                    credentials:
                        "include"
                }
            );


        const data =
            await readJson(
                response
            );


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
            data.kicks || [];


        if (!kicks.length) {

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
                                kick.user_id ||
                                "Unknown"
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
                                kick.created_at ||
                                ""
                            )}
                        </p>

                    </div>

                `
            ).join("");

    }

    catch (error) {

        console.error(
            "KICKS ERROR:",
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
                    credentials:
                        "include"
                }
            );


        const data =
            await readJson(
                response
            );


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
            data.revokes || [];


        if (!revokes.length) {

            container.innerHTML =
                "<p>No staff revocations recorded.</p>";

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
                                revoke.user_id ||
                                "Unknown"
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

                    </div>

                `
            ).join("");

    }

    catch (error) {

        console.error(
            "REVOKES ERROR:",
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
                method:
                    "POST",
                credentials:
                    "include"
            }
        );

    }

    finally {

        window.location.href =
            "/";

    }

}


// ==================================================
// EVENTS
// ==================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        document
            .getElementById(
                "role-select"
            )
            ?.addEventListener(
                "change",
                updateRoleWarning
            );


        document
            .getElementById(
                "role-modal"
            )
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


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                        "Enter" &&
                    document.activeElement?.id ===
                        "user-search"
                ) {

                    searchUsers();

                }

            }
        );


        checkStaff();

    }
);