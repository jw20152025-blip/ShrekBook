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

    return new URLSearchParams(
        window.location.search
    ).get("id");

}


/* ==================================================
   GIVE REACTION
================================================== */

async function giveReaction(type) {

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
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            type:
                                type

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
                    "Could not give reaction."
                )
            );

            return;

        }


        /*
         * Server returns:
         *
         * {
         *     success: true,
         *     counts: {
         *         gyatt,
         *         cat,
         *         ogred
         *     }
         * }
         */


        if (data.counts) {

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
                    data.counts.gyatt ?? 0;

            }


            if (catCount) {

                catCount.textContent =
                    data.counts.cat ?? 0;

            }


            if (ogredCount) {

                ogredCount.textContent =
                    data.counts.ogred ?? 0;

            }

        }


    } catch (error) {

        console.error(
            "REACTION ERROR:",
            error
        );

        alert(
            "❌ Could not give reaction."
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

        return;

    }


    try {

        const response =
            await fetch(
                `/api/users/${encodeURIComponent(
                    userId
                )}`
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not load profile."
            );

        }


        const user =
            data.user || data;


        /* ------------------------------------------
           NAME
        ------------------------------------------ */

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


        /* ------------------------------------------
           USERNAME
        ------------------------------------------ */

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


        /* ------------------------------------------
           BIO
        ------------------------------------------ */

        const bio =
            document.getElementById(
                "profile-bio"
            );


        if (bio) {

            bio.textContent =
                user.bio ||
                "";

        }


        /* ------------------------------------------
           AVATAR
        ------------------------------------------ */

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

                    avatar.src =
                        "/default-avatar.png";

                };

        }


        /* ------------------------------------------
           REACTION COUNTS
        ------------------------------------------ */

        const counts =
            data.counts ||
            user.reaction_counts ||
            null;


        if (counts) {

            const gyatt =
                document.getElementById(
                    "gyatt-count"
                );

            const cat =
                document.getElementById(
                    "cat-count"
                );

            const ogred =
                document.getElementById(
                    "ogred-count"
                );


            if (gyatt) {

                gyatt.textContent =
                    counts.gyatt ?? 0;

            }


            if (cat) {

                cat.textContent =
                    counts.cat ?? 0;

            }


            if (ogred) {

                ogred.textContent =
                    counts.ogred ?? 0;

            }

        }


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

        loadProfile();

    }
);