console.log("🧌 ShrekBook frontend loaded!");


// ==========================================
// HELPERS
// ==========================================

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}


async function getJSON(url, options = {}) {

    const response = await fetch(url, {
        credentials: "include",
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    let data;

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    console.log(
        `${options.method || "GET"} ${url}`,
        response.status,
        data
    );

    if (!response.ok) {

        throw new Error(
            data.error ||
            data.message ||
            `Request failed (${response.status})`
        );
    }

    return data;
}


// ==========================================
// LOAD POSTS
// ==========================================

async function loadPosts() {

    const container =
        document.getElementById("posts");

    if (!container) return;

    container.innerHTML =
        "<p>Loading posts...</p>";

    try {

        const posts =
            await getJSON("/api/posts");

        container.innerHTML = "";

        if (!Array.isArray(posts)) {

            throw new Error(
                "Server returned invalid posts data."
            );
        }

        if (posts.length === 0) {

            container.innerHTML =
                "<p>No posts yet.</p>";

            return;
        }

        posts.forEach(post => {

            const element =
                document.createElement("div");

            element.className = "post";

            element.innerHTML = `

                <div class="post-header">

                    <h3>
                        ${escapeHTML(
                            post.display_name ||
                            post.username ||
                            "Unknown User"
                        )}
                    </h3>

                </div>

                <p>
                    ${escapeHTML(
                        post.content
                    )}
                </p>

                <small>
                    ${
                        post.created_at
                        ? new Date(
                            post.created_at
                        ).toLocaleString()
                        : ""
                    }
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

            container.appendChild(element);
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
                ${escapeHTML(
                    error.message
                )}
            </p>

        `;
    }
}


// ==========================================
// LOAD PEOPLE
// ==========================================

async function loadPeople() {

    const container =
        document.getElementById("people");

    if (!container) return;

    container.innerHTML =
        "<p>Loading people...</p>";

    try {

        const users =
            await getJSON("/api/users");

        container.innerHTML = "";

        if (!Array.isArray(users)) {

            throw new Error(
                "Server returned invalid users data."
            );
        }

        if (users.length === 0) {

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
            "❌ People error:",
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


// ==========================================
// CREATE POST
// ==========================================

async function createPost() {

    const input =
        document.getElementById("postContent");

    if (!input) return;

    const content =
        input.value.trim();

    if (!content) {

        alert(
            "Write something first! 🧌"
        );

        return;
    }

    try {

        await getJSON(
            "/api/posts",
            {
                method: "POST",

                body: JSON.stringify({
                    content
                })
            }
        );

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


// ==========================================
// COMMENTS
// ==========================================

async function toggleComments(postId) {

    const container =
        document.getElementById(
            `comments-${postId}`
        );

    if (!container) return;

    if (
        container.style.display === "none" ||
        container.style.display === ""
    ) {

        container.style.display =
            "block";

        await loadComments(postId);

    } else {

        container.style.display =
            "none";
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

        const comments =
            await getJSON(
                `/api/posts/${postId}/comments`
            );

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

        if (
            !Array.isArray(comments) ||
            comments.length === 0
        ) {

            container.innerHTML +=
                "<p>No comments yet.</p>";

            return;
        }

        comments.forEach(comment => {

            const element =
                document.createElement("div");

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
                        ? new Date(
                            comment.created_at
                        ).toLocaleString()
                        : ""
                    }
                </small>

            `;

            container.appendChild(
                element
            );
        });

    } catch (error) {

        console.error(
            "❌ Comments error:",
            error
        );

        container.innerHTML = `
            <p class="error">
                ❌ ${escapeHTML(
                    error.message
                )}
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

        await getJSON(
            `/api/posts/${postId}/comments`,
            {
                method: "POST",

                body: JSON.stringify({
                    content
                })
            }
        );

        await loadComments(postId);

    } catch (error) {

        console.error(
            "❌ Comment error:",
            error
        );

        alert(
            "Could not comment:\n" +
            error.message
        );
    }
}


// ==========================================
// START
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "🧌 DOM loaded"
        );

        await loadPosts();

        await loadPeople();

    }
);