// ==================================================
// SHREKBOOK FRONTEND
// ==================================================

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

// ==================================================
// AUTH
// ==================================================

async function login() {
    const email =
        document.getElementById("login-email").value.trim();

    const password =
        document.getElementById("login-password").value;

    const status =
        document.getElementById("login-status");

    if (!email || !password) {
        status.textContent =
            "❌ Enter your email and password.";
        return;
    }

    status.textContent = "Logging in...";

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Login failed."
            );
        }

        status.textContent = "✅ Logged in!";

        showApp();

    } catch (error) {
        console.error(error);

        status.textContent =
            "❌ " + error.message;
    }
}

async function signup() {
    const username =
        document.getElementById(
            "signup-username"
        ).value.trim();

    const display_name =
        document.getElementById(
            "signup-display-name"
        ).value.trim();

    const email =
        document.getElementById(
            "signup-email"
        ).value.trim();

    const password =
        document.getElementById(
            "signup-password"
        ).value;

    const status =
        document.getElementById(
            "signup-status"
        );

    if (!username || !email || !password) {
        status.textContent =
            "❌ Fill in all required fields.";
        return;
    }

    status.textContent =
        "Creating account...";

    try {
        const response = await fetch(
            "/api/signup",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    username,
                    display_name:
                        display_name || username,
                    email,
                    password
                })
            }
        );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.error ||
                "Signup failed."
            );
        }

        status.textContent =
            "✅ Account created!";

        showLogin();

    } catch (error) {
        console.error(error);

        status.textContent =
            "❌ " + error.message;
    }
}

function showSignup() {
    document.getElementById(
        "login-box"
    ).style.display = "none";

    document.getElementById(
        "signup-box"
    ).style.display = "block";
}

function showLogin() {
    document.getElementById(
        "signup-box"
    ).style.display = "none";

    document.getElementById(
        "login-box"
    ).style.display = "block";
}

async function logout() {
    await fetch(
        "/api/logout",
        {
            method: "POST"
        }
    );

    showAuth();
}

async function checkLogin() {
    try {
        const response =
            await fetch("/api/me");

        const data =
            await response.json();

        if (data.loggedIn) {
            showApp();
        } else {
            showAuth();
        }

    } catch (error) {
        console.error(error);
        showAuth();
    }
}

function showAuth() {
    document.getElementById(
        "auth-section"
    ).style.display = "block";

    document.getElementById(
        "app-section"
    ).style.display = "none";

    document.getElementById(
        "logout-button"
    ).style.display = "none";
}

function showApp() {
    document.getElementById(
        "auth-section"
    ).style.display = "none";

    document.getElementById(
        "app-section"
    ).style.display = "block";

    document.getElementById(
        "logout-button"
    ).style.display = "inline-block";

    loadPosts();
    loadPeople();
}

// ==================================================
// POSTS
// ==================================================

async function loadPosts() {
    const container =
        document.getElementById("posts");

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

        if (!posts.length) {
            container.innerHTML =
                "<p>No posts yet. Be the first! 🧌</p>";
            return;
        }

        container.innerHTML =
            posts.map(post => `
                <article class="post">

                    <div class="post-header">
                        <strong>
                            ${escapeHtml(
                                post.display_name
                            )}
                        </strong>

                        <span>
                            @${escapeHtml(
                                post.username
                            )}
                        </span>
                    </div>

                    <div class="post-content">
                        ${escapeHtml(
                            post.content
                        )}
                    </div>

                    <button
                        onclick="toggleComments('${post.id}')">

                        💬 Comments

                    </button>

                    <div
                        id="comments-${post.id}"
                        class="comments"
                        style="display:none;">

                        <div
                            id="comment-list-${post.id}">
                        </div>

                        <div class="comment-form">

                            <input
                                id="comment-input-${post.id}"
                                maxlength="500"
                                placeholder="Write a comment...">

                            <button
                                onclick="submitComment('${post.id}')">

                                Send

                            </button>

                        </div>

                    </div>

                </article>
            `).join("");

    } catch (error) {
        console.error(error);

        container.innerHTML =
            `<p>❌ ${escapeHtml(
                error.message
            )}</p>`;
    }
}

async function createPost() {
    const input =
        document.getElementById(
            "post-content"
        );

    const status =
        document.getElementById(
            "post-status"
        );

    const content =
        input.value.trim();

    if (!content) {
        status.textContent =
            "❌ Write something first.";
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

        status.textContent =
            "✅ Posted!";

        loadPosts();

    } catch (error) {
        status.textContent =
            "❌ " + error.message;
    }
}

// ==================================================
// COMMENTS
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

async function loadComments(postId) {
    const list =
        document.getElementById(
            `comment-list-${postId}`
        );

    try {
        const response =
            await fetch(
                `/api/posts/${postId}/comments`
            );

        const comments =
            await response.json();

        if (!response.ok) {
            throw new Error(
                comments.error ||
                "Could not load comments."
            );
        }

        if (!comments.length) {
            list.innerHTML =
                "<p>No comments yet 😼</p>";
            return;
        }

        list.innerHTML =
            comments.map(comment => `
                <div class="comment">

                    <strong>
                        ${escapeHtml(
                            comment.display_name
                        )}
                    </strong>

                    <span>
                        @${escapeHtml(
                            comment.username
                        )}
                    </span>

                    <p>
                        ${escapeHtml(
                            comment.content
                        )}
                    </p>

                </div>
            `).join("");

    } catch (error) {
        list.innerHTML =
            `<p>❌ ${escapeHtml(
                error.message
            )}</p>`;
    }
}

async function submitComment(postId) {
    const input =
        document.getElementById(
            `comment-input-${postId}`
        );

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
                        content
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.error ||
                "Could not comment."
            );
        }

        input.value = "";

        loadComments(postId);

    } catch (error) {
        alert(
            "❌ " + error.message
        );
    }
}

// ==================================================
// PEOPLE
// ==================================================

async function loadPeople() {
    const container =
        document.getElementById(
            "people"
        );

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

        container.innerHTML =
            users.map(user => `
                <a
                    class="person"
                    href="/profile.html?id=${encodeURIComponent(
                        user.id
                    )}">

                    ${
                        user.avatar
                        ? `
                            <img
                                class="avatar"
                                src="${escapeHtml(
                                    user.avatar
                                )}">
                          `
                        : `
                            <div class="avatar-placeholder">
                                🧌
                            </div>
                          `
                    }

                    <div>

                        <strong>
                            ${escapeHtml(
                                user.display_name ||
                                user.username
                            )}
                        </strong>

                        <p>
                            @${escapeHtml(
                                user.username
                            )}
                        </p>

                    </div>

                </a>
            `).join("");

    } catch (error) {
        container.innerHTML =
            `<p>❌ ${escapeHtml(
                error.message
            )}</p>`;
    }
}

// ==================================================
// START
// ==================================================

document.addEventListener(
    "DOMContentLoaded",
    checkLogin
);