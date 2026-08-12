console.log("🧌 ShrekBook frontend loaded!");


// ================================
// HELPER
// ================================

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}


// ================================
// LOAD POSTS
// ================================

async function loadPosts() {

    const container = document.getElementById("posts");

    if (!container) return;

    container.innerHTML = "Loading posts...";

    try {

        const response = await fetch("/api/posts");

        const data = await response.json();

        console.log("Posts:", data);

        if (!response.ok) {
            throw new Error(
                data.error || "Could not load posts"
            );
        }

        container.innerHTML = "";

        if (!Array.isArray(data) || data.length === 0) {

            container.innerHTML =
                "<p>No posts yet.</p>";

            return;
        }

        data.forEach(post => {

            const postElement =
                document.createElement("div");

            postElement.className = "post";

            postElement.innerHTML = `

                <div class="post-header">

                    <h3>
                        ${escapeHTML(
                            post.display_name ||
                            post.username ||
                            "Unknown User"
                        )}
                    </h3>

                </div>

                <p class="post-content">
                    ${escapeHTML(post.content)}
                </p>

                <small>
                    ${post.created_at
                        ? new Date(
                            post.created_at
                        ).toLocaleString()
                        : ""}
                </small>

                <div class="post-actions">

                    <button
                        onclick="toggleComments('${post.id}')"
                    >
                        💬 Comments
                    </button>

                </div>

                <div
                    id="comments-${post.id}"
                    class="comments"
                    style="display:none;"
                ></div>

            `;

            container.appendChild(postElement);
        });

    } catch (error) {

        console.error(
            "❌ Posts error:",
            error
        );

        container.innerHTML = `
            <p class="error">
                ❌ Could not load posts.
            </p>

            <p>
                ${escapeHTML(error.message)}
            </p>
        `;
    }
}


// ================================
// CREATE POST
// ================================

async function createPost() {

    const input =
        document.getElementById("postContent");

    if (!input) return;

    const content =
        input.value.trim();

    if (!content) {

        alert("Write something first! 🧌");

        return;
    }

    try {

        const response = await fetch(
            "/api/posts",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    content: content
                })
            }
        );

        const data =
            await response.json();

        console.log(
            "Create post:",
            data
        );

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not create post"
            );
        }

        input.value = "";

        await loadPosts();

    } catch (error) {

        console.error(
            "❌ Create post error:",
            error
        );

        alert(
            "Could not create post:\n" +
            error.message
        );
    }
}


// ================================
// COMMENTS
// ================================

async function toggleComments(postId) {

    console.log(
        "Comments clicked:",
        postId
    );

    const container =
        document.getElementById(
            `comments-${postId}`
        );

    if (!container) {

        console.error(
            "❌ Comments container not found:",
            postId
        );

        return;
    }

    if (
        container.style.display === "none" ||
        container.style.display === ""
    ) {

        container.style.display = "block";

        await loadComments(postId);

    } else {

        container.style.display = "none";
    }
}


async function loadComments(postId) {

    const container =
        document.getElementById(
            `comments-${postId}`
        );

    if (!container) return;

    container.innerHTML =
        "<p>Loading comments...</p>";

    try {

        const response =
            await fetch(
                `/api/posts/${postId}/comments`
            );

        const data =
            await response.json();

        console.log(
            "Comments:",
            data
        );

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not load comments"
            );
        }

        container.innerHTML = `

            <div class="comment-input">

                <input
                    id="comment-input-${postId}"
                    type="text"
                    placeholder="Write a comment..."
                >

                <button
                    onclick="createComment('${postId}')"
                >
                    Comment
                </button>

            </div>

        `;

        if (
            !Array.isArray(data) ||
            data.length === 0
        ) {

            container.innerHTML +=
                "<p>No comments yet.</p>";

            return;
        }

        data.forEach(comment => {

            const element =
                document.createElement("div");

            element.className = "comment";

            element.innerHTML = `

                <p>
                    ${escapeHTML(
                        comment.content
                    )}
                </p>

                <small>
                    ${comment.created_at
                        ? new Date(
                            comment.created_at
                        ).toLocaleString()
                        : ""}
                </small>

            `;

            container.appendChild(element);
        });

    } catch (error) {

        console.error(
            "❌ Comments error:",
            error
        );

        container.innerHTML = `
            <p class="error">
                ❌ Could not load comments.
            </p>

            <p>
                ${escapeHTML(error.message)}
            </p>
        `;
    }
}


// ================================
// CREATE COMMENT
// ================================

async function createComment(postId) {

    const input =
        document.getElementById(
            `comment-input-${postId}`
        );

    if (!input) return;

    const content =
        input.value.trim();

    if (!content) return;

    try {

        const response =
            await fetch(
                `/api/posts/${postId}/comments`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        content: content
                    })
                }
            );

        const data =
            await response.json();

        console.log(
            "Create comment:",
            data
        );

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not create comment"
            );
        }

        await loadComments(postId);

    } catch (error) {

        console.error(
            "❌ Create comment error:",
            error
        );

        alert(
            "Could not create comment:\n" +
            error.message
        );
    }
}


// ================================
// LOAD PEOPLE
// ================================

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

        console.log(
            "Users:",
            users
        );

        if (!response.ok) {

            throw new Error(
                users.error ||
                "Could not load users"
            );
        }

        container.innerHTML = "";

        if (
            !Array.isArray(users) ||
            users.length === 0
        ) {

            container.innerHTML =
                "<p>No people have joined yet.</p>";

            return;
        }

        users.forEach(user => {

            const person =
                document.createElement("div");

            person.className = "person";

            person.innerHTML = `

                <img
                    class="profile-avatar"
                    src="${
                        user.avatar ||
                        "/shrek.webp"
                    }"
                    alt="Avatar"
                >

                <h3>
                    ${escapeHTML(
                        user.display_name ||
                        user.displayName ||
                        user.username ||
                        "Unknown"
                    )}
                </h3>

                <p>
                    @${escapeHTML(
                        user.username || ""
                    )}
                </p>

                <a
                    href="/profile.html?id=${user.id}"
                >
                    View Profile
                </a>

            `;

            container.appendChild(person);
        });

    } catch (error) {

        console.error(
            "❌ Users error:",
            error
        );

        container.innerHTML = `
            <p class="error">
                ❌ Could not load people.
            </p>
        `;
    }
}


// ================================
// START
// ================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "🧌 DOM loaded!"
        );

        loadPosts();

        loadPeople();
    }
);