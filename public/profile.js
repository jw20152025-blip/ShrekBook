
"use strict";


/* =========================================================
   GET USER ID FROM URL
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


/* =========================================================
   FETCH JSON
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


    let data;


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
            `Server error (${response.status})`
        );

    }


    return data;

}


/* =========================================================
   LOAD PROFILE
========================================================= */

async function loadProfile() {

    if (!profileId) {

        profileName.textContent =
            "Profile not found";

        profileUsername.textContent =
            "";

        profileBio.textContent =
            "No profile ID was provided.";

        return;

    }


    try {

        console.log(
            "👤 Loading profile:",
            profileId
        );


        const data =
            await fetchJSON(
                `/api/users/${encodeURIComponent(profileId)}`
            );


        const user =
            data.user;


        if (!user) {

            throw new Error(
                "User not found."
            );

        }


        /*
         * These names support both your
         * current profiles table and the
         * older naming style.
         */

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


        await loadProfilePosts(
            user.id
        );


    } catch (error) {

        console.error(
            "❌ PROFILE ERROR:",
            error
        );


        profileName.textContent =
            "Unable to load profile";


        profileUsername.textContent =
            "";


        profileBio.textContent =
            error.message;

    }

}


/* =========================================================
   LOAD PROFILE POSTS
========================================================= */

async function loadProfilePosts(
    userId
) {

    if (!profilePosts) {
        return;
    }


    profilePosts.innerHTML =
        `<div class="loading">Loading posts...</div>`;


    try {

        const data =
            await fetchJSON(
                `/api/posts/user/${encodeURIComponent(userId)}`
            );


        const posts =
            Array.isArray(data.posts)
                ? data.posts
                : [];


        if (
            posts.length === 0
        ) {

            profilePosts.innerHTML =
                `<div class="empty">No posts yet.</div>`;

            return;

        }


        profilePosts.innerHTML =
            "";


        posts.forEach(
            post => {

                profilePosts.appendChild(
                    createPostElement(
                        post
                    )
                );

            }
        );


    } catch (error) {

        /*
         * If your posts route doesn't have
         * the user-specific endpoint yet,
         * don't make the entire profile crash.
         */

        console.warn(
            "Profile posts unavailable:",
            error
        );


        profilePosts.innerHTML =
            `<div class="empty">No posts to show.</div>`;

    }

}


/* =========================================================
   CREATE POST ELEMENT
========================================================= */

function createPostElement(
    post
) {

    const article =
        document.createElement(
            "article"
        );


    article.className =
        "post";


    const author =
        post.profiles?.display_name ||
        post.display_name ||
        post.username ||
        "Unknown user";


    const content =
        post.content ||
        "";


    article.innerHTML = `

        <div class="post-header">

            <div>

                <div class="post-author">
                    ${escapeHTML(author)}
                </div>

                ${
                    post.created_at
                    ?
                    `<div class="post-time">
                        ${formatDate(post.created_at)}
                    </div>`
                    :
                    ""
                }

            </div>

        </div>


        <div class="post-content">
            ${escapeHTML(content)}
        </div>

    `;


    return article;

}


/* =========================================================
   ESCAPE HTML
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
    date
) {

    const parsed =
        new Date(date);


    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {

        return "";

    }


    return parsed.toLocaleString();

}


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    loadProfile
);

