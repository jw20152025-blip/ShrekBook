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

// ==================================================
// LOAD BANS
// ==================================================

async function loadBans() {

    try {

        const response = await fetch(
            "/api/admin/bans",
            {
                credentials: "include"
            }
        );

        const data = await response.json();

        const container =
            document.getElementById("ban-list");

        if (!container) {
            return;
        }

        if (!response.ok) {

            container.innerHTML =
                `<p>❌ ${escapeHtml(
                    data.error || "Could not load bans."
                )}</p>`;

            return;
        }

        const bans =
            data.bans || [];

        if (bans.length === 0) {

            container.innerHTML =
                "<p>No active bans. 👍</p>";

            return;
        }

        container.innerHTML =
            bans.map(ban => {

                const email =
                    ban.email || "No email";

                const reason =
                    ban.reason ||
                    "No reason provided.";

                const bannedAt =
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
                        "
                    >

                        <h3>
                            🚫 ${escapeHtml(email)}
                        </h3>

                        ${
                            ban.user_id
                                ? `
                                    <p>
                                        <strong>User ID:</strong><br>
                                        <small>
                                            ${escapeHtml(
                                                ban.user_id
                                            )}
                                        </small>
                                    </p>
                                  `
                                : ""
                        }

                        <p>
                            <strong>Reason:</strong>
                            ${escapeHtml(reason)}
                        </p>

                        <p>
                            <strong>Banned:</strong>
                            ${escapeHtml(bannedAt)}
                        </p>

                        <button
                            type="button"
                            onclick="
                                unbanEmail(
                                    '${encodeURIComponent(
                                        email
                                    )}'
                                )
                            "
                        >
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

        const container =
            document.getElementById("ban-list");

        if (container) {

            container.innerHTML =
                "<p>❌ Could not load bans.</p>";

        }

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

async function unbanEmail(
    encodedBanId
) {

    const banId =
        decodeURIComponent(
            encodedBanId
        );


    if (!confirm(
        "Unban this ban?"
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
                    "Unban failed."
                )
            );

            return;

        }


        /*
         * Reload active bans.
         * The unbanned row now has
         * active = false, so it disappears.
         */

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

        const response = await fetch(
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


        if (!response.ok) {

            container.innerHTML =
                `<p>❌ ${escapeHtml(
                    data.error ||
                    "Could not load administrators."
                )}</p>`;

            return;

        }


        if (
            !data.admins ||
            data.admins.length === 0
        ) {

            container.innerHTML =
                "<p>No administrators.</p>";

            return;

        }


        container.innerHTML =
            data.admins.map(admin => `

                <div class="post">

                    <p>

                        🛡️

                        <strong>

                            ${escapeHtml(
                                admin.display_name ||
                                admin.username ||
                                "Administrator"
                            )}

                        </strong>

                    </p>

                    <small>

                        ${escapeHtml(
                            admin.id ||
                            admin.user_id ||
                            ""
                        )}

                    </small>

                </div>

            `).join("");

    } catch (error) {

        console.error(
            "LOAD ADMINS ERROR:",
            error
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