async function loadPosts() {
    const container = document.getElementById("posts");

    if (!container) return;

    container.innerHTML = "Loading posts...";

    try {
        const response = await fetch("/api/posts");
        const data = await response.json();

        console.log("Posts response:", data);

        if (!response.ok) {
            throw new Error(data.error || "Failed to load posts");
        }

        container.innerHTML = "";

        if (data.length === 0) {
            container.innerHTML = "<p>No posts yet.</p>";
            return;
        }

        data.forEach(post => {
            const element = document.createElement("div");

            element.className = "post";

            element.innerHTML = `
                <h3>
                    ${escapeHTML(
                        post.display_name ||
                        post.username ||
                        "Unknown User"
                    )}
                </h3>

                <p>
                    ${escapeHTML(post.content)}
                </p>

                <small>
                    ${new Date(post.created_at).toLocaleString()}
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
                    style="display: none;"
                ></div>
            `;

            container.appendChild(element);
        });

    } catch (error) {

        console.error("Posts error:", error);

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


async function createPost() {

    const input =
        document.getElementById("postContent");

    if (!input) return;

    const content =
        input.value.trim();

    if (!content) {
        alert("Write something first!");
        return;
    }

    try {

        const response = await fetch("/api/posts", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                content: content
            })

        });

        const data =
            await response.json();

        console.log("Create post:", data);

        if (!response.ok) {
            throw new Error(
                data.error || "Failed to create post"
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
            "Could not create post:\n" +
            error.message
        );
    }
}


async function toggleComments(postId) {

    const container =
        document.getElementById(
            `comments-${postId}`
        );

    if (!container) {
        console.error(
            "Comments container not found:",
            postId
        );
        return;
    }

    if (container.style.display === "none") {

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
        "Loading comments...";

    try {

        const response =
            await fetch(
                `/api/posts/${postId}/comments`
            );

        const data =
            await response.json();

        console.log(
            "Comments response:",
            data
        );

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Failed to load comments"
            );
        }

        container.innerHTML = `
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

        if (data.length === 0) {

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
                    ${escapeHTML(comment.content)}
                </p>

                <small>
                    ${new Date(
                        comment.created_at
                    ).toLocaleString()}
                </small>
            `;

            container.appendChild(element);
        });

    } catch (error) {

        console.error(
            "Comments error:",
            error
        );

        container.innerHTML = `
            <p class="error">
                ❌ ${escapeHTML(error.message)}
            </p>
        `;
    }
}


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
                "Failed to create comment"
            );
        }

        await loadComments(postId);

    } catch (error) {

        console.error(
            "Create comment error:",
            error
        );

        alert(
            "Could not create comment:\n" +
            error.message
        );
    }
}


function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

    return div.innerHTML;
}


/*
    START SHREKBOOK
*/

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "🧌 ShrekBook frontend loaded!"
        );

        loadPosts();

    }
);