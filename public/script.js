
"use strict";

/* =========================================================
   SHREKBOOK HOME
========================================================= */


/* =========================================================
   ELEMENTS
========================================================= */

const welcomeText =
    document.getElementById(
        "welcome-text"
    );

const createPost =
    document.getElementById(
        "create-post"
    );

const postContent =
    document.getElementById(
        "post-content"
    );

const postButton =
    document.getElementById(
        "post-button"
    );

const postMessage =
    document.getElementById(
        "post-message"
    );

const peopleContainer =
    document.getElementById(
        "people"
    );

const postsContainer =
    document.getElementById(
        "posts"
    );

const loginNav =
    document.getElementById(
        "login-nav"
    );

const profileNav =
    document.getElementById(
        "profile-nav"
    );

const logoutButton =
    document.getElementById(
        "logout-button"
    );


/* =========================================================
   API HELPER
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

    } catch (error) {

        console.error(
            "INVALID JSON FROM:",
            url,
            text
        );

        throw new Error(
            "The server returned an invalid response."
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
   FORMAT DATE
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
   LOAD SESSION
========================================================= */

async function loadSession() {

    console.log(
        "🔐 Checking login session..."
    );


    try {

        const data =
            await fetchJSON(
                "/api/session"
            );


        console.log(
            "SESSION:",
            data
        );


        if (
            data.loggedIn &&
            data.user
        ) {

            const user =
                data.user;


            /* -------------------------
               WELCOME
            ------------------------- */

            if (welcomeText) {

                welcomeText.innerHTML =
                    `Welcome back, <strong>${escapeHTML(
                        user.display_name ||
                        user.username ||
                        "Shrek"
                    )}</strong>! 🧌`;

            }


            /* -------------------------
               CREATE POST
            ------------------------- */

            if (createPost) {

                createPost.style.display =
                    "block";

            }


            /* -------------------------
               LOGIN BUTTON
            ------------------------- */

            if (loginNav) {

                loginNav.style.display =
                    "none";

            }


            /* -------------------------
               PROFILE
            ------------------------- */

            if (profileNav) {

                profileNav.style.display =
                    "inline-block";

                profileNav.href =
                    `/profile.html?id=${encodeURIComponent(
                        user.id
                    )}`;

            }


            /* -------------------------
               LOGOUT
            ------------------------- */

            if (logoutButton) {

                logoutButton.style.display =
                    "inline-block";

            }

        } else {

            /* -------------------------
               LOGGED OUT
            ------------------------- */

            if (welcomeText) {

                welcomeText.innerHTML =
                    `Welcome to ShrekBook! 🧌<br>
                    <span style="font-size:16px;color:var(--muted);">
                        Log in to post, chat, and interact with people.
                    </span>`;

            }


            if (createPost) {

                createPost.style.display =
                    "none";

            }


            if (loginNav) {

                loginNav.style.display =
                    "inline-block";

            }


            if (profileNav) {

                profileNav.style.display =
                    "none";

            }


            if (logoutButton) {

                logoutButton.style.display =
                    "none";

            }

        }


        return data;

    } catch (error) {

        console.error(
            "❌ SESSION ERROR:",
            error
        );


        if (welcomeText) {

            welcomeText.textContent =
                "Unable to check login status.";

        }


        return {
            loggedIn: false
        };

    }

}


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

    if (!logoutButton) {
        return;
    }


    logoutButton.disabled =
        true;


    try {

        await fetchJSON(
            "/api/logout",
            {

                method:
                    "POST"

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


        alert(
            error.message ||
            "Logout failed."
        );


        logoutButton.disabled =
            false;

    }

}


if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        logout
    );

}


/* =========================================================
   LOAD PEOPLE
========================================================= */

async function loadPeople() {

    if (!peopleContainer) {
        return;
    }


    peopleContainer.innerHTML =
        `<div class="loading">
            Loading people...
        </div>`;


    try {

        console.log(
            "👥 Loading people..."
        );


        const data =
            await fetchJSON(
                "/api/users"
            );


        console.log(
            "PEOPLE RESPONSE:",
            data
        );


        const users =
            Array.isArray(
                data.users
            )
                ? data.users
                : [];


        if (
            users.length === 0
        ) {

            peopleContainer.innerHTML =
                `<div class="empty">
                    No users yet.
                </div>`;

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
                    "Unknown user";


                const username =
                    user.username
                        ? `@${user.username}`
                        : "";


                /*
                 * IMPORTANT:
                 * The View button uses the
                 * Supabase profile ID.
                 */

                card.innerHTML = `

                    <div class="person-name">
                        ${escapeHTML(name)}
                    </div>

                    <div class="person-username">
                        ${escapeHTML(username)}
                    </div>

                    <a
                        class="view-button"
                        href="/profile.html?id=${encodeURIComponent(
                            user.id
                        )}"
                    >
                        View Profile
                    </a>

                `;


                peopleContainer.appendChild(
                    card
                );

            }
        );


    } catch (error) {

        console.error(
            "❌ PEOPLE ERROR:",
            error
        );


        peopleContainer.innerHTML =
            `<div class="empty">
                Couldn't load people.<br>
                <small>${escapeHTML(
                    error.message
                )}</small>
            </div>`;

    }

}


/* =========================================================
   LOAD POSTS
========================================================= */

async function loadPosts() {

    if (!postsContainer) {
        return;
    }


    postsContainer.innerHTML =
        `<div class="loading">
            Loading posts...
        </div>`;


    try {

        console.log(
            "📝 Loading posts..."
        );


        const data =
            await fetchJSON(
                "/api/posts"
            );


        console.log(
            "POSTS RESPONSE:",
            data
        );


        /*
         * Support either:
         *
         * { posts: [...] }
         *
         * or
         *
         * [...] 
         */

        let posts;


        if (
            Array.isArray(
                data
            )
        ) {

            posts =
                data;

        } else {

            posts =
                Array.isArray(
                    data.posts
                )
                    ? data.posts
                    : [];

        }


        if (
            posts.length === 0
        ) {

            postsContainer.innerHTML =
                `<div class="empty">
                    No posts yet. Be the first to post! 🧌
                </div>`;

            return;

        }


        postsContainer.innerHTML =
            "";


        posts.forEach(
            post => {

                postsContainer.appendChild(
                    createPost(
                        post
                    )
                );

            }
        );


    } catch (error) {

        console.error(
            "❌ POSTS ERROR:",
            error
        );


        postsContainer.innerHTML =
            `<div class="empty">
                Couldn't load posts.<br>
                <small>${escapeHTML(
                    error.message
                )}</small>
            </div>`;

    }

}


/* =========================================================
   CREATE POST
========================================================= */

function createPost(
    post
) {

    const article =
        document.createElement(
            "article"
        );


    article.className =
        "post";


    /*
     * Your posts may return the profile
     * in several different shapes.
     */

    const profile =
        post.profiles ||
        post.profile ||
        {};


    const author =
        post.display_name ||
        profile.display_name ||
        post.username ||
        profile.username ||
        "Unknown user";


    const authorId =
        post.user_id ||
        post.author_id ||
        post.from_user_id ||
        profile.id ||
        "";


    const content =
        post.content ||
        post.text ||
        "";


    article.innerHTML = `

        <div class="post-header">

            <div>

                <a
                    class="post-author"
                    href="${
                        authorId
                            ? `/profile.html?id=${encodeURIComponent(
                                authorId
                            )}`
                            : "#"
                    }"
                >
                    ${escapeHTML(author)}
                </a>

                <div class="post-time">
                    ${escapeHTML(
                        formatDate(
                            post.created_at
                        )
                    )}
                </div>

            </div>

        </div>


        <div class="post-content">
            ${escapeHTML(content)}
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


        <div class="post-actions">

            <button
                type="button"
                onclick="viewPost('${escapeHTML(
                    post.id || ""
                )}')"
            >
                👁️ View
            </button>

        </div>

    `;


    return article;

}


/* =========================================================
   VIEW POST
========================================================= */

function viewPost(
    postId
) {

    if (!postId) {

        console.warn(
            "No post ID supplied."
        );

        return;

    }


    /*
     * This supports a normal post view
     * page if you have one.
     */

    window.location.href =
        `/view.html?id=${encodeURIComponent(
            postId
        )}`;

}


window.viewPost =
    viewPost;


/* =========================================================
   CREATE POST
========================================================= */

async function createNewPost() {

    if (!postContent) {
        return;
    }


    const content =
        postContent.value.trim();


    if (!content) {

        if (postMessage) {

            postMessage.textContent =
                "Write something first!";

            postMessage.style.color =
                "var(--danger)";

        }

        return;

    }


    postButton.disabled =
        true;

    postButton.textContent =
        "Posting...";


    try {

        const data =
            await fetchJSON(
                "/api/posts",
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            content:
                                content

                        })

                }
            );


        console.log(
            "POST CREATED:",
            data
        );


        postContent.value =
            "";


        if (postMessage) {

            postMessage.textContent =
                "✅ Posted!";

            postMessage.style.color =
                "var(--green)";

        }


        await loadPosts();


    } catch (error) {

        console.error(
            "CREATE POST ERROR:",
            error
        );


        if (postMessage) {

            postMessage.textContent =
                error.message;

            postMessage.style.color =
                "var(--danger)";

        }

    } finally {

        postButton.disabled =
            false;

        postButton.textContent =
            "📝 Post";

    }

}


if (postButton) {

    postButton.addEventListener(
        "click",
        createNewPost
    );

}


/* =========================================================
   START
========================================================= */

async function startHome() {

    console.log(
        "🧌 ShrekBook home starting..."
    );


    /*
     * Run these independently.
     * If one API fails, the others
     * can still load.
     */

    await loadSession();

    await Promise.allSettled([

        loadPeople(),

        loadPosts()

    ]);


    console.log(
        "🧌 ShrekBook home loaded."
    );

}


document.addEventListener(
    "DOMContentLoaded",
    startHome
);

"use strict";


/* =========================================================
   SAFE JSON FETCH
========================================================= */

async function shrekFetch(url, options = {}) {

    const response =
        await fetch(
            url,
            {

                credentials:
                    "include",

                ...options,

                headers: {

                    "Content-Type":
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
            `Invalid server response from ${url}`
        );

    }


    if (!response.ok) {

        throw new Error(
            data.error ||
            `Request failed: ${response.status}`
        );

    }


    return data;

}


/* =========================================================
   PEOPLE
========================================================= */

async function loadPeople() {

    console.log(
        "👥 Loading people..."
    );


    const container =
        document.getElementById(
            "people-list"
        );


    if (!container) {

        console.warn(
            "⚠️ #people-list not found"
        );

        return;

    }


    container.innerHTML =
        `<div class="loading">Loading people...</div>`;


    try {

        const data =
            await shrekFetch(
                "/api/users"
            );


        console.log(
            "👥 PEOPLE:",
            data
        );


        const users =
            Array.isArray(
                data.users
            )
                ? data.users
                : [];


        if (
            users.length === 0
        ) {

            container.innerHTML =
                `<div class="empty-state">
                    No people yet.
                </div>`;

            return;

        }


        container.innerHTML =
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
                    user.email ||
                    "ShrekBook User";


                const id =
                    user.id;


                card.innerHTML = `

                    <div class="person-info">

                        <div class="person-name">
                            ${escapeShrekHTML(name)}
                        </div>

                        ${
                            user.username
                                ? `<div class="person-username">
                                    @${escapeShrekHTML(user.username)}
                                   </div>`
                                : ""
                        }

                    </div>

                    <button
                        class="view-profile-button"
                        data-user-id="${escapeShrekHTML(id)}"
                    >
                        View Profile
                    </button>

                `;


                const button =
                    card.querySelector(
                        ".view-profile-button"
                    );


                button.addEventListener(
                    "click",
                    () => {

                        window.location.href =
                            `/profile.html?id=${encodeURIComponent(id)}`;

                    }
                );


                container.appendChild(
                    card
                );

            }
        );


    } catch (error) {

        console.error(
            "❌ PEOPLE ERROR:",
            error
        );


        container.innerHTML =
            `<div class="error-state">
                Couldn't load people.
                <br>
                <small>${escapeShrekHTML(error.message)}</small>
            </div>`;

    }

}


/* =========================================================
   POSTS
========================================================= */

async function loadPosts() {

    console.log(
        "📝 Loading posts..."
    );


    const container =
        document.getElementById(
            "posts-list"
        );


    if (!container) {

        console.warn(
            "⚠️ #posts-list not found"
        );

        return;

    }


    container.innerHTML =
        `<div class="loading">Loading posts...</div>`;


    try {

        const data =
            await shrekFetch(
                "/api/posts"
            );


        console.log(
            "📝 POSTS:",
            data
        );


        const posts =
            Array.isArray(
                data.posts
            )
                ? data.posts
                : [];


        if (
            posts.length === 0
        ) {

            container.innerHTML =
                `<div class="empty-state">
                    No posts yet.
                </div>`;

            return;

        }


        container.innerHTML =
            "";


        posts.forEach(
            post => {

                const element =
                    document.createElement(
                        "article"
                    );


                element.className =
                    "post-card";


                const content =
                    post.content ||
                    "";


                const image =
                    post.image_url ||
                    post.imageUrl ||
                    "";


                element.innerHTML = `

                    <div class="post-body">

                        ${
                            content
                                ? `<div class="post-content">
                                    ${escapeShrekHTML(content)}
                                   </div>`
                                : ""
                        }

                        ${
                            image
                                ? `<img
                                    class="post-image"
                                    src="${escapeShrekHTML(image)}"
                                    alt="Post image"
                                    loading="lazy"
                                   >`
                                : ""
                        }

                    </div>

                `;


                container.appendChild(
                    element
                );

            }
        );


    } catch (error) {

        console.error(
            "❌ POSTS ERROR:",
            error
        );


        container.innerHTML =
            `<div class="error-state">
                Couldn't load posts.
                <br>
                <small>${escapeShrekHTML(error.message)}</small>
            </div>`;

    }

}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeShrekHTML(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "🧌 SHREKBOOK HOMEPAGE READY"
        );


        loadPeople();

        loadPosts();

    }
);


