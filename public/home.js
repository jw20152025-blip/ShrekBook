/* ==================================================
   SHREKBOOK HOME
================================================== */


/* ==================================================
   FETCH JSON
================================================== */

async function homeFetchJSON(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {

                credentials:
                    "include",

                ...options,

                headers: {

                    "Accept":
                        "application/json",

                    ...(options.headers || {})

                }

            }
        );


    const text =
        await response.text();


    let data = {};


    try {

        data =
            text
                ? JSON.parse(text)
                : {};

    }

    catch {

        throw new Error(
            "Invalid server response."
        );

    }


    if (!response.ok) {

        throw new Error(
            data.error ||
            `Server error (${response.status})`
        );

    }


    return data;

}


/* ==================================================
   LOAD CURRENT USER
================================================== */

async function loadCurrentUser() {

    console.log(
        "👤 Checking current user..."
    );


    try {

        const data =
            await homeFetchJSON(
                "/api/me"
            );


        if (!data.loggedIn) {

            console.log(
                "Not logged in."
            );


            window.location.replace(
                "/login.html"
            );


            return;

        }


        console.log(
            "✅ Logged in as:",
            data.user
        );


        const name =
            document.getElementById(
                "home-display-name"
            );


        if (name) {

            name.textContent =
                data.user.display_name ||
                data.user.username ||
                "User";

        }


        const username =
            document.getElementById(
                "home-username"
            );


        if (username) {

            username.textContent =
                "@" +
                (
                    data.user.username ||
                    "user"
                );

        }


        const avatar =
            document.getElementById(
                "home-avatar"
            );


        if (avatar) {

            avatar.src =
                data.user.avatar ||
                "/default-avatar.png";

        }


        window.currentUser =
            data.user;

    }

    catch (error) {

        console.error(
            "HOME USER ERROR:",
            error
        );

    }

}


/* ==================================================
   LOAD PEOPLE
================================================== */

async function loadPeople() {

    console.log(
        "🔥 Loading people..."
    );


    const container =
        document.getElementById(
            "people-list"
        );


    if (!container) {

        return;

    }


    try {

        const data =
            await homeFetchJSON(
                "/api/users"
            );


        const users =
            Array.isArray(data.users)
                ? data.users
                : [];


        container.innerHTML = "";


        if (users.length === 0) {

            container.innerHTML =
                "<p>No users yet.</p>";

            return;

        }


        users.forEach(user => {

            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "person";


            element.innerHTML = `

                <img
                    src="${
                        user.avatar ||
                        "/default-avatar.png"
                    }"
                    class="person-avatar"
                    onerror="
                        this.src='/default-avatar.png'
                    "
                >

                <div class="person-info">

                    <strong>
                        ${
                            escapeHomeHtml(
                                user.display_name ||
                                user.username ||
                                "User"
                            )
                        }
                    </strong>

                    <span>
                        @${escapeHomeHtml(
                            user.username ||
                            "user"
                        )}
                    </span>

                </div>

            `;


            element.addEventListener(
                "click",
                () => {

                    window.location.href =
                        `/profile.html?id=${encodeURIComponent(
                            user.id
                        )}`;

                }
            );


            container.appendChild(
                element
            );

        });

    }

    catch (error) {

        console.error(
            "PEOPLE ERROR:",
            error
        );


        container.innerHTML =
            `<p>❌ ${
                escapeHomeHtml(
                    error.message
                )
            }</p>`;

    }

}


/* ==================================================
   ESCAPE HTML
================================================== */

function escapeHomeHtml(text) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        text ?? "";


    return div.innerHTML;

}


/* ==================================================
   START HOME
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "🧌 ShrekBook home loaded"
        );


        await loadCurrentUser();

        await loadPeople();

    }
);