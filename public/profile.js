/* ==================================================
   SHREKBOOK PROFILE CLIENT
================================================== */

function getProfileId() {

    return new URLSearchParams(
        window.location.search
    ).get("id");

}


function updateReactionCounts(
    counts
) {

    if (!counts) {
        return;
    }


    for (
        const type
        of [
            "gyatt",
            "cat",
            "ogred"
        ]
    ) {

        const element =
            document.getElementById(
                `${type}-count`
            );


        if (element) {

            element.textContent =
                Number(
                    counts[type] || 0
                );

        }

    }

}


/* ==================================================
   REACTION
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

                        Accept:
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


        const text =
            await response.text();


        let data;


        try {

            data =
                JSON.parse(text);

        } catch {

            console.error(
                "REACTION NON JSON:",
                text
            );

            throw new Error(
                "Server returned invalid JSON."
            );

        }


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not give reaction."
            );

        }


        if (data.counts) {

            updateReactionCounts(
                data.counts
            );

        }

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
                )}`,

                {

                    credentials:
                        "include",

                    headers: {

                        Accept:
                            "application/json"

                    }

                }

            );


        const text =
            await response.text();


        let data;


        try {

            data =
                JSON.parse(text);

        } catch {

            console.error(
                "PROFILE NON JSON:",
                text
            );

            throw new Error(
                "Server returned invalid JSON."
            );

        }


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not load profile."
            );

        }


        const user =
            data.user ||
            data;


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


        const bio =
            document.getElementById(
                "profile-bio"
            );


        if (bio) {

            bio.textContent =
                user.bio ||
                "";

        }


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


        updateReactionCounts(
            data.counts ||
            user.reaction_counts
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

            profile.textContent =
                "❌ " +
                error.message;

        }

    }

}


/* ==================================================
   EXPOSE FUNCTIONS
================================================== */

window.giveReaction =
    giveReaction;

window.loadProfile =
    loadProfile;


document.addEventListener(
    "DOMContentLoaded",
    loadProfile
);