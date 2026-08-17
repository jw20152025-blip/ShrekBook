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


        if (!response.ok) {

            container.innerHTML =
                `<p>❌ ${escapeHtml(data.error)}</p>`;

            return;

        }


        if (!data.bans || data.bans.length === 0) {

            container.innerHTML =
                "<p>No active bans.</p>";

            return;

        }


        container.innerHTML =
            data.bans.map(ban => `

                <div class="post">

                    <h3>
                        🚫 ${escapeHtml(ban.email)}
                    </h3>

                    <p>
                        <strong>Reason:</strong>
                        ${escapeHtml(ban.reason || "No reason provided")}
                    </p>

                    <p>
                        Banned:
                        ${new Date(ban.created_at).toLocaleString()}
                    </p>

                    <button
                        onclick="unbanEmail('${encodeURIComponent(ban.email)}')">

                        ✅ Unban

                    </button>

                </div>

            `).join("");

    } catch (error) {

        console.error(
            "LOAD BANS ERROR:",
            error
        );

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
        document.getElementById("ban-status");


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
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                credentials: "include",

                body: JSON.stringify({
                    email,
                    reason
                })
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            status.textContent =
                `❌ ${data.error}`;

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

async function unbanEmail(encodedEmail) {

    const email =
        decodeURIComponent(encodedEmail);


    if (!confirm(
        `Unban ${email}?`
    )) {

        return;

    }


    try {

        const response = await fetch(
            `/api/admin/bans/${encodeURIComponent(email)}`,
            {
                method: "DELETE",
                credentials: "include"
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                "❌ " +
                (data.error || "Unban failed.")
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
                `<p>❌ ${escapeHtml(data.error)}</p>`;

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
                        ${escapeHtml(admin.id)}
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

        const response = await fetch(
            "/api/admin/admins",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                credentials: "include",

                body: JSON.stringify({
                    user_id: userId
                })
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            status.textContent =
                `❌ ${data.error}`;

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
                method: "POST",
                credentials: "include"
            }
        );

    } finally {

        window.location.href = "/";

    }

}


// ==================================================
// START
// ==================================================

checkAdmin();