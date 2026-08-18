// ==================================================
// SHREKBOOK ADMIN PANEL
// ==================================================

let currentAdmin = false;


// ==================================================
// HELPERS
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
// API JSON HELPER
// ==================================================

async function getJson(response) {

    const text = await response.text();

    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch {

        console.error(
            "SERVER RETURNED NON-JSON:",
            text
        );

        return {
            error: text
        };

    }

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

        const data =
            await getJson(response);


        document.getElementById(
            "loading"
        ).style.display = "none";


        if (
            !response.ok ||
            data.isAdmin !== true
        ) {

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

            <p>
                Could not check administrator status.
            </p>
        `;

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
            await getJson(response);


        if (!response.ok) {

            container.innerHTML =
                `<p>❌ ${escapeHtml(
                    data.error ||
                    "Could not load bans."
                )}</p>`;

            return;

        }


        /*
         * Supports BOTH:
         *
         * [...]
         *
         * and:
         *
         * { bans: [...] }
         */

        let bans = [];


        if (Array.isArray(data)) {

            bans = data;

        } else if (
            Array.isArray(data.bans)
        ) {

            bans = data.bans;

        }


        console.log(
            "BANS RECEIVED:",
            bans
        );


        const activeBans =
            bans.filter(
                ban =>
                    ban.active === true ||
                    ban.active === "true" ||
                    ban.active === 1 ||
                    ban.active === "1"
            );


        if (
            activeBans.length === 0
        ) {

            container.innerHTML =
                "<p>No active bans.</p>";

            return;

        }


        container.innerHTML =
            activeBans.map(
                ban => {

                    /*
                     * THIS MUST BE THE
                     * SUPABASE bans.id
                     */

                    const banId =
                        ban.id;


                    if (
                        banId === undefined ||
                        banId === null ||
                        banId === ""
                    ) {

                        return `

                            <div class="post">

                                <h3>
                                    🚫
                                    ${escapeHtml(
                                        ban.email ||
                                        "Unknown"
                                    )}
                                </h3>

                                <p>
                                    ❌ Ban is missing
                                    its database ID.
                                </p>

                            </div>

                        `;

                    }


                    const email =
                        ban.email ||
                        "No email";


                    const reason =
                        ban.reason ||
                        "No reason provided.";


                    const bannedAt =
                        ban.banned_at
                            ? new Date(
                                ban.banned_at
                            ).toLocaleString()
                            : "Unknown";


                    const userId =
                        ban.user_id ||
                        null;


                    return `

                        <div
                            class="post"
                            style="
                                margin-bottom:15px;
                                padding:15px;
                            "
                        >

                            <h3>
                                🚫
                                ${escapeHtml(
                                    email
                                )}
                            </h3>


                            <p>

                                <strong>
                                    Reason:
                                </strong>

                                ${escapeHtml(
                                    reason
                                )}

                            </p>


                            <p>

                                <strong>
                                    Banned:
                                </strong>

                                ${escapeHtml(
                                    bannedAt
                                )}

                            </p>


                            ${
                                userId
                                    ? `

                                        <p>

                                            <strong>
                                                User ID:
                                            </strong>

                                            <code>
                                                ${escapeHtml(
                                                    userId
                                                )}
                                            </code>

                                        </p>

                                    `
                                    : ""
                            }


                            <button
                                type="button"
                                onclick="unbanEmail(${JSON.stringify(
                                    String(banId)
                                )})"
                            >

                                ✅ Unban

                            </button>

                        </div>

                    `;

                }
            ).join("");


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

    const emailInput =
        document.getElementById(
            "ban-email"
        );


    const reasonInput =
        document.getElementById(
            "ban-reason"
        );


    const status =
        document.getElementById(
            "ban-status"
        );


    const email =
        emailInput.value.trim();


    const reason =
        reasonInput.value.trim();


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
            await getJson(response);


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


        emailInput.value = "";

        reasonInput.value = "";


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
    banId
) {

    if (
        banId === undefined ||
        banId === null ||
        banId === ""
    ) {

        alert(
            "❌ Invalid ban ID."
        );

        return;

    }


    if (
        !confirm(
            "Unban this user/email?"
        )
    ) {

        return;

    }


    console.log(
        "UNBANNING BAN ID:",
        banId
    );


    try {

        const response =
            await fetch(
                `/api/admin/bans/${encodeURIComponent(
                    banId
                )}/unban`,
                {

                    method: "POST",

                    credentials:
                        "include"

                }
            );


        const data =
            await getJson(response);


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


        alert(
            "✅ Ban removed."
        );


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


    if (!container) {
        return;
    }


    container.innerHTML =
        "<p>Loading administrators...</p>";


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
            await getJson(response);


        if (!response.ok) {

            container.innerHTML =
                `<p>❌ ${escapeHtml(
                    data.error ||
                    "Could not load administrators."
                )}</p>`;

            return;

        }


        /*
         * Supports BOTH:
         *
         * [...]
         *
         * and:
         *
         * { admins: [...] }
         */

        let admins = [];


        if (Array.isArray(data)) {

            admins = data;

        } else if (
            Array.isArray(data.admins)
        ) {

            admins =
                data.admins;

        }


        console.log(
            "ADMINS RECEIVED:",
            admins
        );


        if (
            admins.length === 0
        ) {

            container.innerHTML =
                "<p>No administrators found.</p>";

            return;

        }


        container.innerHTML =
            admins.map(
                admin => {

                    const userId =
                        admin.id ||
                        admin.user_id ||
                        admin.auth_id;


                    const name =
                        admin.display_name ||
                        admin.username ||
                        admin.email ||
                        "Administrator";


                    if (!userId) {

                        return `

                            <div class="post">

                                <h3>
                                    🛡️
                                    ${escapeHtml(
                                        name
                                    )}
                                </h3>

                                <p>
                                    ❌ This administrator
                                    has no user ID.
                                </p>

                            </div>

                        `;

                    }


                    return `

                        <div
                            class="post"
                            style="
                                margin-bottom:15px;
                                padding:15px;
                            "
                        >

                            <h3>
                                🛡️
                                ${escapeHtml(
                                    name
                                )}
                            </h3>


                            <p>

                                <small>

                                    ${escapeHtml(
                                        userId
                                    )}

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
                                    onclick="revokeAdmin(${JSON.stringify(
                                        String(userId)
                                    )})"
                                >

                                    🚫 Revoke Admin

                                </button>


                                <button
                                    type="button"
                                    onclick="kickUser(
                                        ${JSON.stringify(
                                            String(userId)
                                        )},
                                        ${JSON.stringify(
                                            String(name)
                                        )}
                                    )"
                                >

                                    👢 Kick

                                </button>

                            </div>

                        </div>

                    `;

                }
            ).join("");


    } catch (error) {

        console.error(
            "LOAD ADMINS ERROR:",
            error
        );


        container.innerHTML =
            `<p>❌ ${escapeHtml(
                error.message ||
                "Could not load administrators."
            )}</p>`;

    }

}


// ==================================================
// ADD ADMIN
// ==================================================

async function addAdmin() {

    const input =
        document.getElementById(
            "admin-user-id"
        );


    const status =
        document.getElementById(
            "admin-status"
        );


    const userId =
        input.value.trim();


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
            await getJson(response);


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


        input.value = "";


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
// REVOKE ADMIN
// ==================================================

async function revokeAdmin(
    userId
) {

    if (!userId) {

        alert(
            "❌ Missing user ID."
        );

        return;

    }


    if (
        !confirm(
            "Revoke administrator access from this user?"
        )
    ) {

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
            await getJson(response);


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

    if (!userId) {

        alert(
            "❌ Missing user ID."
        );

        return;

    }


    if (
        !confirm(
            `Kick ${username} from ShrekBook?`
        )
    ) {

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
            await getJson(response);


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