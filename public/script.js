console.log("🧌 ShrekBook frontend loaded!");


// ========================================
// HELPERS
// ========================================

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}


async function api(url, options = {}) {

    const response = await fetch(url, {
        credentials: "include",
        ...options,
        headers: {
            ...(options.body
                ? { "Content-Type": "application/json" }
                : {}),
            ...(options.headers || {})
        }
    });

    let data;

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    console.log("API:", url, response.status, data);

    if (!response.ok) {
        throw new Error(
            data.error ||
            data.message ||
            `Server error ${response.status}`
        );
    }

    return data;
}


// ========================================
// PEOPLE
// ========================================

async function loadPeople() {

    const people =
        document.getElementById("people");

    if (!people) return;

    people.innerHTML =
        "<p>Loading people...</p>";

    try {

        const users =
            await api("/api/users");

        console.log("👥 Users:", users);

        people.innerHTML = "";

        if (!Array.isArray(users)) {
            throw new Error(
                "Server did not return a user list."
            );
        }

        if (users.length === 0) {

            people.innerHTML =
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
                    href="/profile.html?id=${encodeURIComponent(
                        user.id
                    )}"
                >
                    View Profile
                </a>

            `;

            people.appendChild(person);
        });

    } catch (error) {

        console.error(
            "❌ PEOPLE ERROR:",
            error
        );

        people.innerHTML = `

            <p class="error">
                ❌ Could not load people.
            </p>

            <p>
                ${escapeHTML(error.message)}
            </p>

        `;
    }
}


// ========================================
// POSTS
// ========================================

async function loadPosts() {

    const posts =
        document.getElementById("posts");

    if (!posts) return;

    posts.innerHTML =
        "<p>Loading posts...</p>";

    try {

        const data =
            await api("/api/posts");

        console.log("📝 Posts:", data);

        posts.innerHTML = "";

        if (!Array.isArray(data)) {

            throw new Error(
                "Server did not return a post list."
            );
        }

        if (data.length === 0) {

            posts.innerHTML =
                "<p>No posts yet.</p>";

            return;
        }

        data.forEach(post => {

            const element =
                document.createElement("div");

            element.className = "post";

            element.innerHTML = `

                <h3>
                    ${escapeHTML(
                        post.display_name ||
                        post.username ||
                        "Anonymous"
                    )}
                </h3>

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

            posts.appendChild(element);
        });

    } catch (error) {

        console.error(
            "❌ POSTS ERROR:",
            error
        );

        posts.innerHTML = `

            <p class="error">
                ❌ Could not load posts.
            </p>

            <p>
                ${escapeHTML(error.message)}
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

    if (!input) return;

    const content =
        input.value.trim();

    if (!content) {

        alert(
            "You can't post nothing 💀"
        );

        return;
    }

    try {

        await api(
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
            "❌ CREATE POST ERROR:",
            error
        );

        alert(
            "Could not create post:\n\n" +
            error.message
        );
    }
}


// ========================================
// COMMENTS
// ========================================

async function toggleComments(postId) {

    const box =
        document.getElementById(
            `comments-${postId}`
        );

    if (!box) return;

    if (
        box.style.display === "none" ||
        box.style.display === ""
    ) {

        box.style.display = "block";

        await loadComments(postId);

    } else {

        box.style.display = "none";
    }
}


async function loadComments(postId) {

    const box =
        document.getElementById(
            `comments-${postId}`
        );

    if (!box) return;

    box.innerHTML =
        "<p>Loading comments...</p>";

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

        if (
            !Array.isArray(comments) ||
            comments.length === 0
        ) {

            box.innerHTML +=
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

            box.appendChild(element);
        });

    } catch (error) {

        console.error(
            "❌ COMMENTS ERROR:",
            error
        );

        box.innerHTML = `

            <p class="error">
                ❌ Could not load comments.
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
// CREATE COMMENT
// ========================================

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

        await api(
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
            "❌ CREATE COMMENT ERROR:",
            error
        );

        alert(
            "Could not create comment:\n\n" +
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

        console.log(
            "🧌 Loading ShrekBook data..."
        );

        loadPeople();
        loadPosts();

    }
);