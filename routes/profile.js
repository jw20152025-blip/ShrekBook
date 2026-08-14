/* ==================================================
   SHREKBOOK PROFILE CLIENT
================================================== */


/* ==================================================
   ESCAPE HTML
================================================== */

function escapeHtml(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text ?? "";

    return div.innerHTML;
}


/* ==================================================
   GET PROFILE ID
================================================== */

function getProfileId() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    return params.get("id");

}


/* ==================================================
   UPDATE REACTION COUNTS
================================================== */

function updateReactionCounts(counts) {

    if (!counts) {
        return;
    }


    const gyattCount =
        document.getElementById(
            "gyatt-count"
        );

    const catCount =
        document.getElementById(
            "cat-count"
        );

    const ogredCount =
        document.getElementById(
            "ogred-count"
        );


    if (gyattCount) {

        gyattCount.textContent =
            Number(counts.gyatt || 0);

    }


    if (catCount) {

        catCount.textContent =
            Number(counts.cat || 0);

    }


    if (ogredCount) {

        ogredCount.textContent =
            Number(counts.ogred || 0);

    }

}


/* ==================================================
   GIVE REACTION
================================================== */

async function giveReaction(type) {

    console.log(
        "Giving reaction:",
        type
    );


    const userId =
        getProfileId();


    if (!userId) {

        alert(
            "❌ No profile ID."
        );

        return;

    }


    const allowedTypes = [
        "gyatt",
        "cat",
        "ogred"
    ];


    if (!allowedTypes.includes(type)) {

        alert(
            "❌ Invalid reaction type."
        );

        return;

    }


    try {

        const response =
            await fetch(
                `/api/users/${encodeURIComponent(
                    userId
                )}/reaction`,
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"

                    },

                    credentials:
                        "include",

                    body:
                        JSON.stringify({

                            type:
                                type

                        })

                }
            );


        /*
         * Don't blindly call response.json().
         *
         * If the server accidentally sends
         * HTML, this prevents:
         *
         * Unexpected token '<'
         */

        const text =
            await response.text();


        let data;


        try {

            data =
                JSON.parse(text);

        } catch (jsonError) {

            console.error(
                "SERVER RETURNED NON-JSON:",
                text
            );

            throw new Error(
                "Server returned an invalid response."
            );

        }


        if (!response.ok) {

            alert(
                "❌ " +
                (
                    data.error ||
                    "Could not give reaction."
                )
            );

            return;

        }


        /*
         * Server response:
         *
         * {
         *     success: true,
         *     reaction: {...},
         *     counts: {
         *         gyatt: 0,
         *         cat: 0,
         *         ogred: 0
         *     }
         * }
         */


        if (data.counts) {

            updateReactionCounts(
                data.counts
            );

        }


        /*
         * Extra fallback in case the server
         * only returns `count`.
         */

        if (
            data.count !== undefined &&
            data.counts
        ) {

            const element =
                document.getElementById(
                    `${type}-count`
                );


            if (element) {

                element.textContent =
                    data.count;

            }

        }


    } catch (error) {

        console.error(
            "REACTION ERROR:",
            error
        );


        alert(
            "❌ " +
            (
                error.message ||
                "Could not give reaction."
            )
        );

    }

}


/* ==================================================
   LOAD PROFILE
================================================== */

async function loadProfile() {

    const userId =
        getProfileId();


    if (!userId) {

        console.error(
            "No profile ID in URL."
        );

        const profile =
            document.getElementById(
                "profile"
            );

        if (profile) {

            profile.innerHTML =
                "<p>❌ No profile ID.</p>";

        }

        return;

    }


    console.log(
        "Loading profile:",
        userId
    );


    try {

        const response =
            await fetch(
                `/api/users/${encodeURIComponent(
                    userId
                )}`,
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


        let data;


        try {

            data =
                JSON.parse(text);

        } catch (jsonError) {

            console.error(
                "PROFILE SERVER RESPONSE:",
                text
            );

            throw new Error(
                "Server returned an invalid response."
            );

        }


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not load profile."
            );

        }


        /*
         * Supports either:
         *
         * {
         *     user: {...},
         *     counts: {...}
         * }
         *
         * OR:
         *
         * {...user}
         */

        const user =
            data.user ||
            data;


        /* ==================================================
           DISPLAY NAME
        ================================================== */

        const displayName =
            document.getElementById(
                "profile-display-name"
            );


        if (displayName) {

            displayName.textContent =
                user.display_name ||
                user.username ||
                "User";

        }


        /* ==================================================
           USERNAME
        ================================================== */

        const username =
            document.getElementById(
                "profile-username"
            );


        if (username) {

            username.textContent =
                "@" +
                (
                    user.username ||
                    "user"
                );

        }


        /* ==================================================
           BIO
        ================================================== */

        const bio =
            document.getElementById(
                "profile-bio"
            );


        if (bio) {

            bio.textContent =
                user.bio ||
                "";

        }


        /* ==================================================
           AVATAR
        ================================================== */

        const avatar =
            document.getElementById(
                "profile-avatar"
            );


        if (avatar) {

            avatar.src =
                user.avatar ||
                "/default-avatar.png";


            avatar.onerror =
                () => {

                    avatar.onerror =
                        null;

                    avatar.src =
                        "/default-avatar.png";

                };

        }


        /* ==================================================
           REACTION COUNTS
        ================================================== */

        const counts =
            data.counts ||
            user.reaction_counts ||
            null;


        if (counts) {

            updateReactionCounts(
                counts
            );

        }


        console.log(
            "✅ Profile loaded:",
            user
        );


    } catch (error) {

        console.error(
            "PROFILE ERROR:",
            error
        );


        const profile =
            document.getElementById(
                "profile"
            );


        if (profile) {

            profile.innerHTML =
                `
                <p>
                    ❌ ${escapeHtml(
                        error.message
                    )}
                </p>
                `;

        }

    }

}


/* ==================================================
   START
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "🧌 ShrekBook profile.js loaded"
        );

        loadProfile();

    }
);