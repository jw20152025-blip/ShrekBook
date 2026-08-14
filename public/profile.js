console.log(
    "🧌 ShrekBook profile.js loaded"
);


/* ==================================================
   PROFILE ID
================================================== */

function getProfileId() {

    return new URLSearchParams(
        window.location.search
    ).get("id");

}


/* ==================================================
   REACTION COUNTS
================================================== */

function updateReactionCounts(
    counts
) {

    if (!counts) {
        return;
    }


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


/* ==================================================
   GIVE REACTION
================================================== */

async function giveReaction(
    type
) {

    const userId =
        getProfileId();


    if (!userId) {

        alert(
            "❌ No profile ID."
        );

        return;

    }


    if (
        ![
            "gyatt",
            "cat",
            "ogred"
        ].includes(type)
    ) {

        alert(
            "❌ Invalid reaction."
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

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body:
                        JSON.stringify({
                            type
                        })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Reaction failed."
            );

        }


        updateReactionCounts(
            data.counts
        );


    } catch (error) {

        console.error(
            "REACTION ERROR:",
            error
        );


        alert(
            "❌ " +
            error.message
        );

    }

}


window.giveReaction =
    giveReaction;


/* ==================================================
   LOAD PROFILE
================================================== */

async function loadProfile() {

    const userId =
        getProfileId();


    if (!userId) {

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
            data.user;


        const name =
            document.getElementById(
                "profile-display-name"
            );

        const username =
            document.getElementById(
                "profile-username"
            );

        const bio =
            document.getElementById(
                "profile-bio"
            );

        const avatar =
            document.getElementById(
                "profile-avatar"
            );


        if (name) {

            name.textContent =
                user.display_name ||
                user.username ||
                "User";

        }


        if (username) {

            username.textContent =
                "@" +
                (
                    user.username ||
                    "user"
                );

        }


        if (bio) {

            bio.textContent =
                user.bio || "";

        }


        if (avatar) {

            avatar.src =
                user.avatar ||
                "/default-avatar.png";

        }


    } catch (error) {

        console.error(
            "PROFILE ERROR:",
            error
        );

    }

}


document.addEventListener(
    "DOMContentLoaded",
    loadProfile
);