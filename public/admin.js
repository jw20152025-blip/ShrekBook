// ==================================================
// SHREKBOOK — ADMIN / MODERATOR PANEL
// ==================================================

let currentUser = null;
let currentRank = null;


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
// RANK INFORMATION
// ==================================================

const RANK_INFO = {

    owner: {
        name: "Owner",
        emoji: "👑",
        description:
            "The owner has absolute control over ShrekBook. The owner cannot be banned, revoked, or kicked by other staff."
    },

    administrator: {
        name: "Administrator",
        emoji: "🛡️",
        description:
            "Administrators manage users, bans, revokes, and major moderation actions. They cannot punish the Owner."
    },

    senior_moderator: {
        name: "Senior Moderator",
        emoji: "⚔️",
        description:
            "Senior Moderators are trusted staff members who can kick users and coordinate moderation. They cannot ban or revoke higher-ranking staff."
    },

    moderator: {
        name: "Moderator",
        emoji: "🔨",
        description:
            "Moderators handle everyday moderation and can kick users when necessary."
    },

    user: {
        name: "Peasant",
        emoji: "👨‍🌾",
        description:
            "Regular ShrekBook users. They have no administrative powers."
    }

};


// ==================================================
// RANK NORMALIZATION
// ==================================================

function normalizeRank(rank) {

    if (!rank) {
        return "user";
    }

    rank = String(rank)
        .trim()
        .toLowerCase()
        .replace(/-/g, "_")
        .replace(/ /g, "_");

    if (
        rank === "owner" ||
        rank === "administrator" ||
        rank === "admin" ||
        rank === "senior_moderator" ||
        rank === "moderator" ||
        rank === "user"
    ) {

        if (rank === "admin") {
            return "administrator";
        }

        return rank;

    }

    return "user";
}


// ==================================================
// LOAD CURRENT USER / RANK
// ==================================================

async function loadCurrentUser() {

    try {

        const response = await fetch(
            "/api/admin/me",
            {
                credentials: "include"
            }
        );

        const data = await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not determine your rank."
            );

        }

        currentUser =
            data.user ||
            data.currentUser ||
            null;

        currentRank =
            normalizeRank(
                data.rank ||
                data.role ||
                data.user?.rank ||
                data.user?.role
            );

        renderWelcome();

        applyPermissions();

        return true;

    } catch (error) {

        console.error(
            "CURRENT USER ERROR:",
            error
        );

        showError(
            error.message ||
            "Could not determine your rank."
        );

        return false;
    }

}


// ==================================================
// WELCOME MESSAGE
// ==================================================

function renderWelcome() {

    const welcome =
        document.getElementById(
            "welcome"
        );

    if (!welcome) {
        return;
    }

    const rank =
        RANK_INFO[currentRank] ||
        RANK_INFO.user;

    const username =
        currentUser?.display_name ||
        currentUser?.username ||
        currentUser?.email ||
        "Staff member";

    welcome.innerHTML = `

        <div class="welcome-box">

            <h1>
                ${rank.emoji}
                Welcome, ${escapeHtml(username)}!
            </h1>

            <h2>
                Rank: ${escapeHtml(rank.name)}
            </h2>

            <p>
                ${escapeHtml(rank.description)}
            </p>

        </div>

    `;
}


// ==================================================
// ROLE EXPLANATIONS
// ==================================================

function renderRoles() {

    const container =
        document.getElementById(
            "role-list"
        );

    if (!container) {
        return;
    }

    container.innerHTML = Object.values(
        RANK_INFO
    ).map(rank => `

        <div class="role-card">

            <div class="role-title">
                ${rank.emoji}
                ${escapeHtml(rank.name)}
            </div>

            <div class="role-description">
                ${escapeHtml(rank.description)}
            </div>

        </div>

    `).join("");
}


// ==================================================
// PERMISSIONS
// ==================================================

function applyPermissions() {

    const isOwner =
        currentRank === "owner";

    const isAdmin =
        currentRank === "administrator";

    const isSeniorMod =
        currentRank === "senior_moderator";

    const isModerator =
        currentRank === "moderator";

    const canManageUsers =
        isOwner ||
        isAdmin;

    const canKick =
        isOwner ||
        isAdmin ||
        isSeniorMod ||
        isModerator;

    const canBan =
        isOwner ||
        isAdmin;

    const canRevoke =
        isOwner ||
        isAdmin;

    const canManageAdmins =
        isOwner;

    document
        .querySelectorAll(
            "[data-permission='ban']"
        )
        .forEach(element => {

            element.style.display =
                canBan
                    ? ""
                    : "none";

        });

    document
        .querySelectorAll(
            "[data-permission='revoke']"
        )
        .forEach(element => {

            element.style.display =
                canRevoke
                    ? ""
                    : "none";

        });

    document
        .querySelectorAll(
            "[data-permission='kick']"
        )
        .forEach(element => {

            element.style.display =
                canKick
                    ? ""
                    : "none";

        });

    document
        .querySelectorAll(
            "[data-permission='admins']"
        )
        .forEach(element => {

            element.style.display =
                canManageAdmins
                    ? ""
                    : "none";

        });

    document
        .querySelectorAll(
            "[data-permission='users']"
        )
        .forEach(element => {

            element.style.display =
                canManageUsers
                    ? ""
                    : "none";

        });
}


// ==================================================
// LOAD BANS
// ==================================================

async function loadBans() {

    const container =
        document.getElementById(
            "ban-list"
        );

    if (!container) {
        return;
    }

    container.innerHTML =
        "<p>Loading bans...</p>";

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

            throw new Error(
                data.error ||
                "Could not load bans."
            );

        }

        const bans =
            Array.isArray(data)
                ? data
                : Array.isArray(data.bans)
                    ? data.bans
                    : [];

        const activeBans =
            bans.filter(
                ban =>
                    ban.active === true ||
                    ban.active === "true" ||
                    ban.active === 1
            );

        if (!activeBans.length) {

            container.innerHTML =
                "<p>No active bans.</p>";

            return;
        }

        container.innerHTML =
            activeBans.map(ban => `

                <div class="staff-card">

                    <h3>
                        🚫
                        ${escapeHtml(
                            ban.email ||
                            ban.user_id ||
                            "Unknown user"
                        )}
                    </h3>

                    <p>
                        <strong>Reason:</strong>
                        ${escapeHtml(
                            ban.reason ||
                            "No reason provided."
                        )}
                    </p>

                    <p>
                        <strong>Date:</strong>
                        ${escapeHtml(
                            ban.banned_at
                                ? new Date(
                                    ban.banned_at
                                ).toLocaleString()
                                : "Unknown"
                        )}
                    </p>

                    <button
                        onclick="unbanUser('${escapeHtml(
                            ban.id
                        )}')">

                        ✅ Unban

                    </button>

                </div>

            `).join("");

    } catch (error) {

        console.error(
            "LOAD BANS ERROR:",
            error
        );

        container.innerHTML =
            `<p>❌ ${escapeHtml(
                error.message
            )}</p>`;
    }
}


// ==================================================
// UNBAN
// ==================================================

async function unbanUser(banId) {

    if (!confirm(
        "Unban this user?"
    )) {
        return;
    }

    try {

        const response =
            await fetch(
                `/api/admin/bans/${encodeURIComponent(
                    banId
                )}/unban`,
                {
                    method: "POST",
                    credentials: "include"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Unban failed."
            );

        }

        await loadBans();

    } catch (error) {

        alert(
            "❌ " +
            error.message
        );

    }
}


// ==================================================
// LOAD ADMINS / STAFF
// ==================================================

async function loadAdmins() {

    const container =
        document.getElementById(
            "admin-list"
        );

    if (!container) {
        return;
    }

    container.innerHTML =
        "<p>Loading staff...</p>";

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

            throw new Error(
                data.error ||
                "Could not load staff."
            );

        }

        const admins =
            Array.isArray(data)
                ? data
                : Array.isArray(data.admins)
                    ? data.admins
                    : [];

        if (!admins.length) {

            container.innerHTML =
                "<p>No administrators found.</p>";

            return;
        }

        container.innerHTML =
            admins.map(admin => {

                const rank =
                    normalizeRank(
                        admin.rank ||
                        admin.role
                    );

                const info =
                    RANK_INFO[rank] ||
                    RANK_INFO.administrator;

                return `

                    <div class="staff-card">

                        <h3>
                            ${info.emoji}
                            ${escapeHtml(
                                admin.display_name ||
                                admin.username ||
                                "Unknown"
                            )}
                        </h3>

                        <p>
                            <strong>
                                Rank:
                            </strong>

                            ${escapeHtml(
                                info.name
                            )}
                        </p>

                        <small>
                            ${escapeHtml(
                                admin.user_id ||
                                admin.id ||
                                ""
                            )}
                        </small>

                    </div>

                `;

            }).join("");

    } catch (error) {

        console.error(
            "LOAD STAFF ERROR:",
            error
        );

        container.innerHTML =
            `<p>❌ ${escapeHtml(
                error.message
            )}</p>`;
    }
}


// ==================================================
// BAN USER
// ==================================================

async function banUser() {

    if (
        currentRank !== "owner" &&
        currentRank !== "administrator"
    ) {

        alert(
            "❌ Your rank cannot ban users."
        );

        return;
    }

    const email =
        document
            .getElementById("ban-email")
            ?.value
            .trim();

    const reason =
        document
            .getElementById("ban-reason")
            ?.value
            .trim();

    const status =
        document.getElementById(
            "ban-status"
        );

    if (!email) {

        if (status) {
            status.textContent =
                "❌ Enter an email.";
        }

        return;
    }

    if (status) {
        status.textContent =
            "Banning...";
    }

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

            throw new Error(
                data.error ||
                "Ban failed."
            );
        }

        if (status) {
            status.textContent =
                "✅ User banned.";
        }

        document.getElementById(
            "ban-email"
        ).value = "";

        document.getElementById(
            "ban-reason"
        ).value = "";

        await loadBans();

    } catch (error) {

        console.error(
            "BAN ERROR:",
            error
        );

        if (status) {
            status.textContent =
                "❌ " +
                error.message;
        }
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
                credentials: "include"
            }
        );

    } finally {

        window.location.href =
            "/";

    }
}


// ==================================================
// ERROR DISPLAY
// ==================================================

function showError(message) {

    const loading =
        document.getElementById(
            "loading"
        );

    if (loading) {

        loading.innerHTML = `
            <h2>❌ Error</h2>
            <p>
                ${escapeHtml(message)}
            </p>
        `;

    }
}


// ==================================================
// START
// ==================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        renderRoles();

        const allowed =
            await loadCurrentUser();

        if (!allowed) {
            return;
        }

        const loading =
            document.getElementById(
                "loading"
            );

        const panel =
            document.getElementById(
                "admin-page"
            );

        if (loading) {
            loading.style.display =
                "none";
        }

        if (panel) {
            panel.style.display =
                "block";
        }

        await loadBans();
        await loadAdmins();

    }
);