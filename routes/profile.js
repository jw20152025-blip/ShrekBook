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
   LOAD REACTIONS
================================================== */

async function loadReactions() {

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
                )}/reactions`
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not load reactions."
            );

        }


        const counts =
            data.counts || {};


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
                counts.gyatt || 0;

        }


        if (cat) {

            cat.textContent =
                counts.cat || 0;

        }


        if (ogred) {

            ogred.textContent =
                counts.ogred || 0;

        }


    } catch (error) {

        console.error(
            "LOAD REACTIONS ERROR:",
            error
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

            throw new Error(

                data.error ||
                "Could not give reaction."

            );

        }


        const counts =
            data.counts || {};


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
                counts.gyatt || 0;

        }


        if (cat) {

            cat.textContent =
                counts.cat || 0;

        }


        if (ogred) {

            ogred.textContent =
                counts.ogred || 0;

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
            data.user ||
            data;


        const displayName =
            document.getElementById(
                "profile-display-name"
            );


        const username =
            document.getElementById(
                "profile-username"
            );


        const avatar =
            document.getElementById(
                "profile-avatar"
            );


        if (displayName) {

            displayName.textContent =
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


/* ==================================================
   START
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadProfile();

        loadReactions();

    }
);