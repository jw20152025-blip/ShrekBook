console.log(
    "🧌 ShrekBook loaded"
);


// ========================================
// HELPERS
// ========================================

function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

    return div.innerHTML;

}


async function api(
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

                    ...(options.body
                        ? {
                            "Content-Type":
                                "application/json"
                        }
                        : {}),

                    ...(options.headers || {})

                }

            }
        );


    let data = {};

    try {

        data =
            await response.json();

    } catch {}


    if (!response.ok) {

        throw new Error(
            data.error ||
            `Server error ${response.status}`
        );

    }


    return data;

}


// ========================================
// LOGIN STATUS
// ========================================

async function loadLoginStatus() {

    const status =
        document.getElementById(
            "loginStatus"
        );


    if (!status)
        return;


    try {

        const data =
            await api(
                "/api/me"
            );


        const logoutButton =
            document.getElementById(
                "logoutButton"
            );


        const loginLink =
            document.getElementById(
                "loginLink"
            );


        const signupLink =
            document.getElementById(
                "signupLink"
            );


        const createPost =
            document.getElementById(
                "createPostSection"
            );


        if (data.loggedIn) {

            status.innerHTML = `

                🧌 Logged in as

                <strong>
                    ${escapeHTML(
                        data.user.display_name
                    )}
                </strong>

                <br>

                <a
                    href="/profile.html?id=${
                        encodeURIComponent(
                            data.user.id
                        )
                    }"
                >
                    View Profile
                </a>

            `;


            if (logoutButton)
                logoutButton.style.display =
                    "inline-block";


            if (loginLink)
                loginLink.style.display =
                    "none";


            if (signupLink)
                signupLink.style.display =
                    "none";


            if (createPost)
                createPost.style.display =
                    "block";

        } else {

            status.innerHTML = `

                You're not logged in.

                <a href="/login.html">
                    Login
                </a>

            `;


            if (logoutButton)
                logoutButton.style.display =
                    "none";


            if (createPost)
                createPost.style.display =
                    "none";

        }

    } catch (error) {

        console.error(
            error
        );

    }

}


// ========================================
// LOGOUT
// ========================================

async function logout() {

    try {

        await api(
            "/api/logout",
            {
                method:
                    "POST"
            }
        );


        location.reload();


    } catch (error) {

        alert(
            error.message
        );

    }

}


// ========================================
// PEOPLE
// ========================================

async function loadPeople() {

    const container =
        document.getElementById(
            "people"
        );


    if (!container)
        return;


    try {

        const users =
            await api(
                "/api/users"
            );


        container.innerHTML =
            "";


        if (!users.length) {

            container.innerHTML =
                "<p>No people yet.</p>";

            return;

        }


        users.forEach(
            user => {

                const element =
                    document.createElement(
                        "div"
                    );


                element.className =
                    "person";


                element.innerHTML = `

                    <div class="person-avatar">

                        ${
                            user.avatar

                            ?

                            `<img
                                src="${escapeHTML(
                                    user.avatar
                                )}"
                            >`

                            :

                            "🧌"
                        }

                    </div>


                    <h3>

                        ${escapeHTML(
                            user.display_name
                        )}

                    </h3>


                    <p>

                        @${escapeHTML(
                            user.username
                        )}

                    </p>


                    <p class="person-bio">

                        ${
                            user.bio

                            ?

                            escapeHTML(
                                user.bio
                            )

                            :

                            "No bio yet."

                        }

                    </p>


                    <a
                        href="/profile.html?id=${
                            encodeURIComponent(
                                user.id
                            )
                        }"
                    >
                        View Profile
                    </a>

                `;


                container.appendChild(
                    element
                );

            }
        );


    } catch (error) {

        console.error(
            "PEOPLE:",
            error
        );


        container.innerHTML = `

            <p class="error">

                ❌ Could not load people.

            </p>

            <p>

                ${escapeHTML(
                    error.message
                )}

            </p>

        `;

    }

}


// ========================================
// POSTS
// ========================================

async function loadPosts() {

    const container =
        document.getElementById(
            "posts"
        );


    if (!container)
        return;


    try {

        const posts =
            await api(
                "/api/posts"
            );


        container.innerHTML =
            "";


        if (!posts.length) {

            container.innerHTML =
                "<p>No posts yet.</p>";

            return;

        }


        posts.forEach(
            post => {

                const element =
                    document.createElement(
                        "div"
                    );


                element.className =
                    "post";


                element.innerHTML = `

                    <div class="post-header">


                        <div>

                            <strong>

                                ${escapeHTML(
                                    post.display_name
                                )}

                            </strong>


                            <small>

                                @${escapeHTML(
                                    post.username
                                )}

                            </small>

                        </div>


                        <small>

                            ${
                                post.created_at

                                ?

                                new Date(
                                    post.created_at
                                ).toLocaleString()

                                :

                                ""

                            }

                        </small>

                    </div>


                    <p>

                        ${escapeHTML(
                            post.content
                        )}

                    </p>


                    <button
                        onclick="toggleComments('${post.id}')"
                    >
                        💬 Comments
                    </button>


                    <div
                        id="comments-${post.id}"
                        class="comments"
                        style="display:none;"
                    ></div>

                `;


                container.appendChild(
                    element
                );

            }
        );


    } catch (error) {

        console.error(
            "POSTS:",
            error
        );


        container.innerHTML = `

            <p class="error">

                ❌ Could not load posts.

            </p>

            <p>

                ${escapeHTML(
                    error.message
                )}

            </p>

        `;

    }

}


// ========================================
// CREATE POST
// ========================================

async function createPost() {

    const input =
        document.getElementById(
            "postContent"
        );


    const content =
        input.value.trim();


    if (!content)
        return;


    try {

        await api(
            "/api/posts",
            {

                method:
                    "POST",

                body:
                    JSON.stringify({
                        content
                    })

            }
        );


        input.value =
            "";


        await loadPosts();


    } catch (error) {

        alert(
            error.message
        );

    }

}


// ========================================
// COMMENTS
// ========================================

async function toggleComments(
    postId
) {

    const box =
        document.getElementById(
            `comments-${postId}`
        );


    if (
        box.style.display ===
        "none"
    ) {

        box.style.display =
            "block";


        await loadComments(
            postId
        );

    } else {

        box.style.display =
            "none";

    }

}


async function loadComments(
    postId
) {

    const box =
        document.getElementById(
            `comments-${postId}`
        );


    box.innerHTML =
        "<p>Loading...</p>";


    try {

        const comments =
            await api(
                `/api/posts/${postId}/comments`
            );


        box.innerHTML = `

            <div class="comment-input">

                <input
                    id="comment-input-${postId}"
                    placeholder="Write a comment..."
                >

                <button
                    onclick="createComment('${postId}')"
                >
                    Comment
                </button>

            </div>

        `;


        comments.forEach(
            comment => {

                const element =
                    document.createElement(
                        "div"
                    );


                element.className =
                    "comment";


                element.innerHTML = `

                    <p>

                        ${escapeHTML(
                            comment.content
                        )}

                    </p>

                    <small>

                        ${
                            comment.created_at

                            ?

                            new Date(
                                comment.created_at
                            ).toLocaleString()

                            :

                            ""

                        }

                    </small>

                `;


                box.appendChild(
                    element
                );

            }
        );


        if (!comments.length) {

            box.innerHTML +=
                "<p>No comments yet.</p>";

        }


    } catch (error) {

        box.innerHTML =
            "❌ " +
            escapeHTML(
                error.message
            );

    }

}


async function createComment(
    postId
) {

    const input =
        document.getElementById(
            `comment-input-${postId}`
        );


    const content =
        input.value.trim();


    if (!content)
        return;


    try {

        await api(
            `/api/posts/${postId}/comments`,
            {

                method:
                    "POST",

                body:
                    JSON.stringify({
                        content
                    })

            }
        );


        await loadComments(
            postId
        );


    } catch (error) {

        alert(
            error.message
        );

    }

}


// ========================================
// START
// ========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadLoginStatus();

        loadPeople();

        loadPosts();

    }
);