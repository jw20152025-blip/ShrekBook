
"use strict";


/* =========================================================
   PROFILE ID
========================================================= */

const params =
    new URLSearchParams(
        window.location.search
    );


const profileId =
    params.get("id");


/* =========================================================
   ELEMENTS
========================================================= */

const profileName =
    document.getElementById(
        "profile-name"
    );

const profileUsername =
    document.getElementById(
        "profile-username"
    );

const profileBio =
    document.getElementById(
        "profile-bio"
    );

const profilePosts =
    document.getElementById(
        "profile-posts"
    );

const profileError =
    document.getElementById(
        "profile-error"
    );

const logoutButton =
    document.getElementById(
        "logout-button"
    );


/* =========================================================
   API
========================================================= */

async function fetchJSON(
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

    } catch {

        throw new Error(
            "Server returned invalid JSON."
        );

    }


    if (!response.ok) {

        throw new Error(
            data.error ||
            `Request failed (${response.status})`
        );

    }


    return data;

}


/* =========================================================
   ESCAPE
========================================================= */

function escapeHTML(
    value
) {

    return String(
        value ?? ""
    )
    .replaceAll(
        "&",
        "&amp;"
    )
    .replaceAll(
        "<",
        "&lt;"
    )
    .replaceAll(
        ">",
        "&gt;"
    )
    .replaceAll(
        '"',
        "&quot;"
    )
    .replaceAll(
        "'",
        "&#039;"
    );

}


/* =========================================================
   DATE
========================================================= */

function formatDate(
    value
) {

    if (!value) {
        return "";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "";

    }


    return date.toLocaleString();

}


/* =========================================================
   LOAD PROFILE
========================================================= */

async function loadProfile() {

    console.log(
        "👤 PROFILE ID:",
        profileId
    );


    if (!profileId) {

        showProfileError(
            "No profile ID was supplied."
        );

        return;

    }


    try {

        const data =
            await fetchJSON(
                `/api/users/${encodeURIComponent(
                    profileId
                )}`
            );


        console.log(
            "PROFILE RESPONSE:",
            data
        );


        const user =
            data.user;


        if (!user) {

            throw new Error(
                "User not found."
            );

        }


        const name =
            user.display_name ||
            user.username ||
            "Unknown user";


        const username =
            user.username
                ? `@${user.username}`
                : "";


        const bio =
            user.bio ||
            "No bio yet.";


        profileName.textContent =
            name;


        profileUsername.textContent =
            username;


        profileBio.textContent =
            bio;


        document.title =
            `${name} — ShrekBook`;


        /*
         * Load posts separately.
         * If this fails, the profile itself
         * remains functional.
         */

        loadProfilePosts(
            user.id
        );


    } catch (error) {

        console.error(
            "❌ PROFILE ERROR:",
            error
        );


        showProfileError(
            error.message
        );

    }

}


/* =========================================================
   PROFILE ERROR
========================================================= */

function showProfileError(
    message
) {

    if (profileError) {

        profileError.style.display =
            "block";

        profileError.textContent =
            message;

    }


    if (profileName) {

        profileName.textContent =
            "Profile unavailable";

    }


    if (profileUsername) {

        profileUsername.textContent =
            "";

    }


    if (profileBio) {

        profileBio.textContent =
            "";

    }

}


/* =========================================================
   PROFILE POSTS
========================================================= */

async function loadProfilePosts(
    userId
) {

    if (!profilePosts) {
        return;
    }


    try {

        const data =
            await fetchJSON(
                `/api/posts/user/${encodeURIComponent(
                    userId
                )}`
            );


        const posts =
            Array.isArray(
                data.posts
            )
                ? data.posts
                : Array.isArray(data)
                    ? data
                    : [];


        if (
            posts.length === 0
        ) {

            profilePosts.innerHTML =
                `<div class="empty">
                    No posts yet.
                </div>`;

            return;

        }


        profilePosts.innerHTML =
            "";


        posts.forEach(
            post => {

                const article =
                    document.createElement(
                        "article"
                    );


                article.className =
                    "post";


                article.innerHTML = `

                    <div class="post-content">
                        ${escapeHTML(
                            post.content ||
                            ""
                        )}
                    </div>

                    ${
                        post.image_url
                            ?
                            `<img
                                class="post-image"
                                src="${escapeHTML(
                                    post.image_url
                                )}"
                                alt="Post image"
                            >`
                            :
                            ""
                    }

                    <div class="post-time">
                        ${escapeHTML(
                            formatDate(
                                post.created_at
                            )
                        )}
                    </div>

                `;


                profilePosts.appendChild(
                    article
                );

            }
        );


    } catch (error) {

        /*
         * Don't destroy the profile if the
         * user-post endpoint doesn't exist.
         */

        console.warn(
            "PROFILE POSTS:",
            error
        );


        profilePosts.innerHTML =
            `<div class="empty">
                No posts to show.
            </div>`;

    }

}


/* =========================================================
   LOGOUT
========================================================= */

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


        window.location.replace(
            "/login.html"
        );


    } catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );

    }

}


if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        logout
    );

}


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    loadProfile
);

