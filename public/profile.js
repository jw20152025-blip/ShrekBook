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
            Number(
                counts.gyatt || 0
            );

    }


    if (cat) {

        cat.textContent =
            Number(
                counts.cat || 0
            );

    }


    if (ogred) {

        ogred.textContent =
            Number(
                counts.ogred || 0
            );

    }

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


    if (
        !allowedTypes.includes(type)
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


        const text =
            await response.text();


        let data;


        try {

            data =
                JSON.parse(text);

        } catch {

            console.error(
                "NON-JSON RESPONSE:",
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


        if (
            data.counts
        ) {

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
            "No profile ID."
        );

        return;

    }


    try {

        const response =
            await fetch(

                `/api/users/${encodeURIComponent(
                    userId
                )}`,

                {

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

        } catch {

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
                user.bio || "";

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


        if (
            data.counts
        ) {

            updateReactionCounts(
                data.counts
            );

        }

    } catch (error) {

        console.error(
            "PROFILE ERROR:",
            error
        );

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


/*
 * Makes inline onclick="giveReaction(...)"
 * work reliably.
 */

window.giveReaction =
    giveReaction;