// ==================================================
// ShrekBook Frontend
// ==================================================

console.log("🧌 ShrekBook frontend loaded!");


// ==================================================
// HELPERS
// ==================================================

function getToken() {
    return localStorage.getItem("access_token");
}


function escapeHtml(text) {

    const div = document.createElement("div");

    div.textContent = text ?? "";

    return div.innerHTML;
}


// ==================================================
// PEOPLE
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

        if (users.length === 0) {

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
                        user.username
                    )}
                </h3>

                <p>
                    @${escapeHtml(
                        user.username
                    )}
                </p>

                <a href="/profile.html?id=${encodeURIComponent(user.id)}">
                    View Profile
                </a>

            `;


            container.appendChild(person);

        });


    } catch (error) {

        console.error(
            "People error:",
            error
        );

        container.innerHTML =
            `<p>❌ ${escapeHtml(
                error.message
            )}</p>`;

    }

}


// ==================================================
// POSTS
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


        if (posts.length === 0) {

            container.innerHTML =
                "<p>No posts yet.</p>";

            return;

        }


        posts.forEach(post => {

            const article =
                document.createElement("article");

            article.className =
                "post";


            article.innerHTML = `

                <h3>
                    ${escapeHtml(
                        post.display_name ||
                        post.username ||
                        "User"
                    )}
                </h3>

                <p>
                    ${escapeHtml(
                        post.content
                    )}
                </p>

                <small>
                    ${new Date(
                        post.created_at
                    ).toLocaleString()}
                </small>

                <br><br>

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
                        id="comment-list-${post.id}">

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


            container.appendChild(article);

        });


        // Add comment button events

        document
            .querySelectorAll(".comments-button")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        toggleComments(
                            button.dataset.postId
                        );

                    }
                );

            });


        // Add submit events

        document
            .querySelectorAll(".comment-submit")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        submitComment(
                            button.dataset.postId
                        );

                    }
                );

            });


    } catch (error) {

        console.error(
            "Posts error:",
            error
        );

        container.innerHTML =
            `<p>❌ ${escapeHtml(
                error.message
            )}</p>`;

    }

}


// ==================================================
// TOGGLE COMMENTS
// ==================================================

async function toggleComments(postId) {

    const box =
        document.getElementById(
            `comments-${postId}`
        );


    if (!box) return;


    if (box.style.display === "none") {

        box.style.display = "block";

        await loadComments(postId);

    } else {

        box.style.display = "none";

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
                `/api/posts/${encodeURIComponent(postId)}/comments`
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


        if (comments.length === 0) {

            list.innerHTML =
                "<p>No comments yet.</p>";

            return;

        }


        comments.forEach(comment => {

            const element =
                document.createElement("div");

            element.className =
                "comment";


            // IMPORTANT:
            // No avatar is requested or displayed.

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
                    ${new Date(
                        comment.created_at
                    ).toLocaleString()}
                </small>

            `;


            list.appendChild(element);

        });


    } catch (error) {

        console.error(
            "Comments error:",
            error
        );

        list.innerHTML =
            `<p>❌ ${escapeHtml(
                error.message
            )}</p>`;

    }

}


// ==================================================
// SUBMIT COMMENT
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
            "You need to log in before commenting."
        );

        return;

    }


    try {

        const response =
            await fetch(
                `/api/posts/${encodeURIComponent(postId)}/comments`,
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        content:
                            content,

                        access_token:
                            token

                    })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not post comment."
            );

        }


        input.value = "";


        await loadComments(postId);


    } catch (error) {

        console.error(
            "Submit comment error:",
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
            "You need to log in before posting."
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
                            "application/json"
                    },

                    body: JSON.stringify({

                        content:
                            content,

                        access_token:
                            token

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
            "Create post error:",
            error
        );

        alert(
            "❌ " +
            error.message
        );

    }

}


// ==================================================
// ENTER KEY FOR COMMENTS
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
                event.target.id
                    .replace(
                        "comment-input-",
                        ""
                    );

            submitComment(postId);

        }

    }
);


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