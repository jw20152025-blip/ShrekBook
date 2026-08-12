// ==================================================
// SHREKBOOK SCRIPT.JS
// ==================================================

console.log("🧌 ShrekBook script loaded!");


// ==================================================
// HELPERS
// ==================================================

function getToken() {
    return localStorage.getItem("access_token");
}


function escapeHtml(value) {

    const div = document.createElement("div");

    div.textContent = value ?? "";

    return div.innerHTML;
}


// ==================================================
// LOAD PEOPLE
// ==================================================

async function loadPeople() {

    const container =
        document.getElementById("people");

    if (!container) return;

    container.innerHTML =
        "Loading people...";

    try {

        const response =
            await fetch("/api/users");

        const users =
            await response.json();

        if (!response.ok) {

            throw new Error(
                users.error ||
                "Could not load people."
            );

        }

        container.innerHTML = "";

        if (!users.length) {

            container.innerHTML =
                "<p>No people have joined yet.</p>";

            return;
        }


        users.forEach(user => {

            const person =
                document.createElement("div");

            person.className =
                "person";


            person.innerHTML = `

                <h3>
                    ${escapeHtml(
                        user.display_name ||
                        user.username ||
                        "User"
                    )}
                </h3>

                <p>
                    @${escapeHtml(
                        user.username ||
                        ""
                    )}
                </p>

                <a
                    href="/profile.html?id=${encodeURIComponent(
                        user.id
                    )}">

                    View Profile

                </a>

            `;


            container.appendChild(person);

        });


    } catch (error) {

        console.error(
            "PEOPLE ERROR:",
            error
        );

        container.innerHTML =
            `<p>❌ ${escapeHtml(
                error.message
            )}</p>`;

    }

}


// ==================================================
// LOAD POSTS
// ==================================================

async function loadPosts() {

    const container =
        document.getElementById("posts");

    if (!container) return;

    container.innerHTML =
        "Loading posts...";


    try {

        const response =
            await fetch("/api/posts");


        const posts =
            await response.json();


        if (!response.ok) {

            throw new Error(
                posts.error ||
                "Could not load posts."
            );

        }


        container.innerHTML = "";


        if (!posts.length) {

            container.innerHTML =
                "<p>No posts yet.</p>";

            return;

        }


        posts.forEach(post => {

            const postElement =
                document.createElement("article");

            postElement.className =
                "post";


            postElement.innerHTML = `

                <h3>

                    ${escapeHtml(
                        post.display_name ||
                        post.username ||
                        "User"
                    )}

                </h3>


                <p class="post-content">

                    ${escapeHtml(
                        post.content
                    )}

                </p>


                <small>

                    ${post.created_at
                        ? new Date(
                            post.created_at
                          ).toLocaleString()
                        : ""
                    }

                </small>


                <br>


                <button
                    class="comments-button"
                    data-post-id="${post.id}">

                    💬 Comments

                </button>


                <div
                    class="comments"
                    id="comments-${post.id}"
                    style="display:none;">

                    <div
                        class="comment-list"
                        id="comment-list-${post.id}">

                        Loading comments...

                    </div>


                    <div class="comment-box">

                        <input
                            type="text"
                            id="comment-input-${post.id}"
                            placeholder="Write a comment...">


                        <button
                            class="comment-submit"
                            data-post-id="${post.id}">

                            Comment

                        </button>

                    </div>

                </div>

            `;


            container.appendChild(
                postElement
            );

        });


        // Comment buttons

        document
            .querySelectorAll(
                ".comments-button"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const postId =
                            button.dataset.postId;

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
                );

            });


        // Comment submit buttons

        document
            .querySelectorAll(
                ".comment-submit"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async () => {

                        await submitComment(
                            button.dataset.postId
                        );

                    }
                );

            });


    } catch (error) {

        console.error(
            "POST ERROR:",
            error
        );

        container.innerHTML =
            `<p>❌ ${escapeHtml(
                error.message
            )}</p>`;

    }

}


// ==================================================
// LOAD COMMENTS
// ==================================================

async function loadComments(postId) {

    const list =
        document.getElementById(
            `comment-list-${postId}`
        );


    if (!list) return;


    list.innerHTML =
        "Loading comments...";


    try {

        const response =
            await fetch(
                `/api/posts/${encodeURIComponent(
                    postId
                )}/comments`
            );


        const comments =
            await response.json();


        if (!response.ok) {

            throw new Error(
                comments.error ||
                "Could not load comments."
            );

        }


        list.innerHTML = "";


        if (!comments.length) {

            list.innerHTML =
                "<p>No comments yet.</p>";

            return;

        }


        comments.forEach(comment => {

            const element =
                document.createElement("div");


            element.className =
                "comment";


            // NO AVATAR HERE.
            // Only name + comment.

            element.innerHTML = `

                <strong>

                    ${escapeHtml(
                        comment.display_name ||
                        comment.username ||
                        "User"
                    )}

                </strong>


                <p>

                    ${escapeHtml(
                        comment.content
                    )}

                </p>


                <small>

                    ${comment.created_at
                        ? new Date(
                            comment.created_at
                          ).toLocaleString()
                        : ""
                    }

                </small>

            `;


            list.appendChild(
                element
            );

        });


    } catch (error) {

        console.error(
            "COMMENT LOAD ERROR:",
            error
        );

        list.innerHTML =
            `<p>❌ ${escapeHtml(
                error.message
            )}</p>`;

    }

}


// ==================================================
// CREATE COMMENT
// ==================================================

async function submitComment(postId) {

    const input =
        document.getElementById(
            `comment-input-${postId}`
        );


    if (!input) return;


    const content =
        input.value.trim();


    if (!content) {

        return;

    }


    const token =
        getToken();


    if (!token) {

        alert(
            "❌ You need to log in first."
        );

        return;

    }


    try {

        const response =
            await fetch(
                `/api/posts/${encodeURIComponent(
                    postId
                )}/comments`,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`

                    },

                    body: JSON.stringify({

                        content:
                            content

                    })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not create comment."
            );

        }


        input.value = "";


        await loadComments(
            postId
        );


    } catch (error) {

        console.error(
            "COMMENT POST ERROR:",
            error
        );

        alert(
            "❌ " +
            error.message
        );

    }

}


// ==================================================
// CREATE POST
// ==================================================

async function createPost() {

    const input =
        document.getElementById(
            "post-content"
        );


    if (!input) return;


    const content =
        input.value.trim();


    if (!content) {

        return;

    }


    const token =
        getToken();


    if (!token) {

        alert(
            "❌ You need to log in first."
        );

        return;

    }


    try {

        const response =
            await fetch(
                "/api/posts",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`

                    },

                    body: JSON.stringify({

                        content:
                            content

                    })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not create post."
            );

        }


        input.value = "";


        await loadPosts();


    } catch (error) {

        console.error(
            "POST CREATE ERROR:",
            error
        );

        alert(
            "❌ " +
            error.message
        );

    }

}


// ==================================================
// ENTER TO COMMENT
// ==================================================

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            event.target.matches(
                ".comment-box input"
            )
        ) {

            event.preventDefault();


            const postId =
                event.target.id.replace(
                    "comment-input-",
                    ""
                );


            submitComment(
                postId
            );

        }

    }
);


// ==================================================
// LOGOUT
// ==================================================

function logout() {

    localStorage.removeItem(
        "access_token"
    );


    window.location.href =
        "/login.html";

}


// ==================================================
// START
// ==================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadPeople();

        loadPosts();

    }
);