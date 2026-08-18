// ==================================================
// SHREKBOOK ADMIN PANEL
// ==================================================

let currentAdmin = false;


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
// CHECK ADMIN
// ==================================================

async function checkAdmin() {

    try {

        const response = await fetch(
            "/api/admin/me",
            {
                credentials: "include"
            }
        );

        const data = await response.json();

        document.getElementById(
            "loading"
        ).style.display = "none";


        if (!response.ok || !data.isAdmin) {

            document.getElementById(
                "not-admin"
            ).style.display = "block";

            return;

        }


        currentAdmin = true;

        document.getElementById(
            "admin-page"
        ).style.display = "block";


        await loadBans();

        await loadAdmins();

    } catch (error) {

        console.error(
            "ADMIN CHECK ERROR:",
            error
        );

        document.getElementById(
            "loading"
        ).innerHTML = `
            <h1>❌ Error</h1>
            <p>Could not check administrator status.</p>
        `;

    }

}


// ==================================================
// LOAD ACTIVE BANS
// ==================================================

async function loadBans() {

    const container =
        document.getElementById("ban-list");

    if (!container) {
        return;
    }

    container.innerHTML =
        "<p>Loading bans...</p>";

    try {

        const response = await fetch(
            "/api/admin/bans",
            {
                credentials: "include"
            }
        );

        const data =
            await response.json();

        if (!response.ok) {

            container.innerHTML =
                `<p>❌ ${escapeHtml(
                    data.error ||
                    "Could not load bans."
                )}</p>`;

            return;

        }


        /*
         * Backend returns:
         *
         * {
         *     bans: [...]
         * }
         */

        const bans =
            Array.isArray(data.bans)
                ? data.bans
                : [];


        /*
         * Only show active bans.
         * This also protects us if the backend
         * accidentally returns inactive bans.
         */

        const activeBans =
            bans.filter(
                ban =>
                    ban.active === true ||
                    ban.active === "true" ||
                    ban.active === 1
            );


        if (activeBans.length === 0) {

            container.innerHTML =
                "<p>No active bans.</p>";

            return;

        }


        container.innerHTML =
            activeBans.map(ban => {

                const email =
                    ban.email ||
                    "No email";

                const reason =
                    ban.reason ||
                    "No reason provided.";

                const date =
                    ban.banned_at
                        ? new Date(
                            ban.banned_at
                        ).toLocaleString()
                        : "Unknown";


                return `

                    <div
                        class="post"
                        style="
                            margin-bottom:15px;
                            padding:15px;
                        ">

                        <h3>
                            🚫
                            ${escapeHtml(email)}
                        </h3>

                        <p>

                            <strong>
                                Reason:
                            </strong>

                            ${escapeHtml(reason)}

                        </p>

                        <p>

                            <strong>
                                Banned:
                            </strong>

                            ${escapeHtml(date)}

                        </p>

                        ${
                            ban.user_id
                                ? `
                                    <p>
                                        <strong>
                                            User ID:
                                        </strong>

                                        <code>
                                            ${escapeHtml(
                                                ban.user_id
                                            )}
                                        </code>
                                    </p>
                                  `
                                : ""
                        }

                        <button
                            onclick="
                                unbanEmail(
                                    '${encodeURIComponent(
                                        ban.id
                                    )}'
                                )
                            ">

                            ✅ Unban

                        </button>

                    </div>

                `;

            }).join("");

    } catch (error) {

        console.error(
            "LOAD BANS ERROR:",
            error
        );

        container.innerHTML =
            `<p>❌ ${escapeHtml(
                error.message ||
                "Could not load bans."
            )}</p>`;

    }

}


// ==================================================
// BAN EMAIL
// ==================================================

async function banEmail() {

    const email =
        document
            .getElementById("ban-email")
            .value
            .trim();

    const reason =
        document
            .getElementById("ban-reason")
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

        const response = await fetch(
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
            "✅ Email banned.";


        document.getElementById(
            "ban-email"
        ).value = "";


        document.getElementById(
            "ban-reason"
        ).value = "";


        /*
         * Immediately reload the list.
         */

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

// ==================================================
// UNBAN
// ==================================================

async function unbanEmail(banId) {

    if (!confirm("Unban this user/email?")) {
        return;
    }

    try {

        const response = await fetch(
            `/api/admin/bans/${encodeURIComponent(banId)}/unban`,
            {
                method: "POST",
                credentials: "include"
            }
        );

        const data = await response.json();

        if (!response.ok) {

            alert(
                "❌ " +
                (data.error || "Unban failed.")
            );

            return;
        }

        alert("✅ Ban removed.");

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

        const container =
            document.getElementById(
                "admin-list"
            );

        if (!container) {
            return;
        }

        if (!response.ok) {

            container.innerHTML =
                `<p>❌ ${escapeHtml(
                    data.error ||
                    "Could not load administrators."
                )}</p>`;

            return;
        }

        const admins =
            data.admins || [];

        if (admins.length === 0) {

            container.innerHTML =
                "<p>No administrators.</p>";

            return;
        }

        container.innerHTML =
            admins.map(admin => {

                const name =
                    admin.display_name ||
                    admin.username ||
                    "Administrator";

                const userId =
                    admin.id ||
                    admin.user_id;

                return `

                    <div
                        class="post"
                        style="
                            margin-bottom:15px;
                            padding:15px;
                        "
                    >

                        <h3>
                            🛡️ ${escapeHtml(name)}
                        </h3>

                        <p>
                            <small>
                                ${escapeHtml(userId)}
                            </small>
                        </p>

                        <div
                            style="
                                display:flex;
                                gap:10px;
                                flex-wrap:wrap;
                                margin-top:10px;
                            "
                        >

                            <button
                                type="button"
                                onclick="
                                    revokeAdmin(
                                        '${escapeHtml(userId)}'
                                    )
                                "
                            >
                                🚫 Revoke Admin
                            </button>

                            <button
                                type="button"
                                onclick="
                                    kickUser(
                                        '${escapeHtml(userId)}',
                                        '${escapeHtml(name)}'
                                    )
                                "
                            >
                                👢 Kick
                            </button>

                        </div>

                    </div>

                `;

            }).join("");

    } catch (error) {

        console.error(
            "LOAD ADMINS ERROR:",
            error
        );

    }

}
// ==================================================
// REVOKE ADMIN
// ==================================================

async function revokeAdmin(userId) {

    if (!confirm(
        "Revoke administrator access from this user?"
    )) {

        return;

    }

    try {

        const response =
            await fetch(
                `/api/admin/admins/${encodeURIComponent(
                    userId
                )}`,
                {
                    method:
                        "DELETE",

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
                    "Could not revoke administrator."
                )
            );

            return;

        }

        alert(
            "✅ Administrator access revoked."
        );

        await loadAdmins();

    } catch (error) {

        console.error(
            "REVOKE ADMIN ERROR:",
            error
        );

        alert(
            "❌ Server error."
        );

    }

}
// ==================================================
// KICK USER
// ==================================================

async function kickUser(
    userId,
    username
) {

    if (!confirm(
        `Kick ${username} from ShrekBook?`
    )) {

        return;

    }

    try {

        const response =
            await fetch(
                `/api/admin/kick/${encodeURIComponent(
                    userId
                )}`,
                {
                    method:
                        "POST",

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
                    "Could not kick user."
                )
            );

            return;

        }

        alert(
            "👢 User kicked."
        );

    } catch (error) {

        console.error(
            "KICK ERROR:",
            error
        );

        alert(
            "❌ Server error."
        );

    }

}
// ==================================================
// ADD ADMIN
// ==================================================

async function addAdmin() {

    const userId =
        document
            .getElementById("admin-user-id")
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


        document.getElementById(
            "admin-user-id"
        ).value = "";


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

    } finally {

        window.location.href =
            "/";

    }

}


// ==================================================
// START
// ==================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        checkAdmin();

    }
);