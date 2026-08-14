/* ==================================================
   SHREKBOOK PROFILE CLIENT
================================================== */

"use strict";

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
   PROFILE ID
================================================== */

function getProfileId() {

    return new URLSearchParams(
        window.location.search
    ).get("id");

}

/* ==================================================
   UPDATE COUNTS
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

    const allowed = [
        "gyatt",
        "cat",
        "ogred"
    ];

    if (
        !allowed.includes(type)
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

                    credentials:
                        "include",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

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
                "Could not react."
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

/* ==================================================
   LOAD PROFILE
================================================== */

async function loadProfile() {

    const userId =
        getProfileId();

    if (!userId) {

        throw new Error(
            "No profile ID."
        );

    }

    const response =
        await fetch(
            `/api/users/${encodeURIComponent(
                userId
            )}`,
            {
                credentials:
                    "include"
            }
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

    updateReactionCounts(
        data.counts ||
        user.reaction_counts
    );

}

/* ==================================================
   START
================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "🧌 profile.js loaded"
        );

        try {

            await loadProfile();

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
                    `<p>❌ ${
                        escapeHtml(
                            error.message
                        )
                    }</p>`;

            }

        }

    }
);

window.giveReaction =
    giveReaction;

window.loadProfile =
    loadProfile;