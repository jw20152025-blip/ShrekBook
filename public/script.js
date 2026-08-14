/* ==================================================
   LOAD PEOPLE
================================================== */

async function loadPeople() {

    console.log(
        "🔥 Loading people..."
    );


    try {

        const response =
            await fetch(
                "/api/users",
                {

                    method:
                        "GET",

                    headers: {

                        "Accept":
                            "application/json"

                    },

                    credentials:
                        "include"

                }
            );


        const text =
            await response.text();


        console.log(
            "PEOPLE RAW RESPONSE:",
            text
        );


        let data;


        try {

            data =
                JSON.parse(text);

        } catch {

            throw new Error(
                "Server returned invalid JSON."
            );

        }


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not load users."
            );

        }


        const users =
            Array.isArray(data.users)
                ? data.users
                : Array.isArray(data.data)
                    ? data.data
                    : null;


        if (!users) {

            console.error(
                "INVALID USERS RESPONSE:",
                data
            );

            throw new Error(
                "Invalid users response."
            );

        }


        console.log(
            "✅ PEOPLE:",
            users
        );


        /*
         * Change this ID if your People
         * container has a different ID.
         */

        const peopleContainer =
            document.getElementById(
                "people"
            );


        if (!peopleContainer) {

            console.error(
                "❌ #people element not found."
            );

            return;

        }


        peopleContainer.innerHTML =
            "";


        users.forEach(
            user => {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "person-card";


                const name =
                    user.display_name ||
                    user.username ||
                    "User";


                const username =
                    user.username
                        ? `@${user.username}`
                        : "";


                const avatar =
                    user.avatar ||
                    "/default-avatar.png";


                card.innerHTML = `

                    <img
                        src="${avatar}"
                        alt="${escapeHtml(name)}"
                        class="person-avatar"
                        onerror="this.src='/default-avatar.png'"
                    >

                    <div class="person-info">

                        <div class="person-name">
                            ${escapeHtml(name)}
                        </div>

                        <div class="person-username">
                            ${escapeHtml(username)}
                        </div>

                    </div>

                `;


                card.addEventListener(
                    "click",
                    () => {

                        window.location.href =
                            `/profile.html?id=${encodeURIComponent(
                                user.id
                            )}`;

                    }
                );


                peopleContainer.appendChild(
                    card
                );

            }
        );


    } catch (error) {

        console.error(
            "PEOPLE ERROR:",
            error
        );

    }

}