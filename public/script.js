/* ==================================================
SHREKBOOK CLIENT SCRIPT
================================================== */

/* ==================================================
ESCAPE HTML
================================================== */

function escapeHtml(text) {

 
const div =
    document.createElement("div");

div.textContent =
    text ?? "";

return div.innerHTML;
 

}

/* ==================================================
LOGIN
================================================== */

async function login() {

 
const email =
    document.getElementById(
        "login-email"
    ).value.trim();

const password =
    document.getElementById(
        "login-password"
    ).value;

const status =
    document.getElementById(
        "login-status"
    );


if (!email || !password) {

    status.textContent =
        "❌ Enter your email and password.";

    return;
}


status.textContent =
    "Logging in...";


try {

    const response =
        await fetch(
            "/api/login",
            {

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify({

                        email:
                            email,

                        password:
                            password

                    })

            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            data.error ||
            "Login failed."
        );

    }


    status.textContent =
        "✅ Logged in!";


    showApp();


} catch (error) {

    console.error(
        "LOGIN ERROR:",
        error
    );


    status.textContent =
        "❌ " +
        error.message;

}
 

}

/* ==================================================
SIGNUP
================================================== */

async function signup() {

 
const username =
    document.getElementById(
        "signup-username"
    ).value.trim();


const displayName =
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


if (
    !username ||
    !email ||
    !password
) {

    status.textContent =
        "❌ Fill in all required fields.";

    return;

}


status.textContent =
    "Creating account...";


try {

    const response =
        await fetch(
            "/api/signup",
            {

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify({

                        username:
                            username,

                        display_name:
                            displayName ||
                            username,

                        email:
                            email,

                        password:
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

    console.error(
        "SIGNUP ERROR:",
        error
    );


    status.textContent =
        "❌ " +
        error.message;

}
 

}

/* ==================================================
AUTH UI
================================================== */

function showSignup() {

 
const loginBox =
    document.getElementById(
        "login-box"
    );


const signupBox =
    document.getElementById(
        "signup-box"
    );


if (loginBox) {

    loginBox.style.display =
        "none";

}


if (signupBox) {

    signupBox.style.display =
        "block";

}
 

}

function showLogin() {

 
const loginBox =
    document.getElementById(
        "login-box"
    );


const signupBox =
    document.getElementById(
        "signup-box"
    );


if (loginBox) {

    loginBox.style.display =
        "block";

}


if (signupBox) {

    signupBox.style.display =
        "none";

}
 

}

/* ==================================================
SESSION CHECK
================================================== */

async function checkLogin() {

 
try {

    const response =
        await fetch(
            "/api/me"
        );


    const data =
        await response.json();


    if (
        response.ok &&
        data.loggedIn &&
        data.user
    ) {

        showApp();

    } else {

        showAuth();

    }


} catch (error) {

    console.error(
        "SESSION ERROR:",
        error
    );


    showAuth();

}
 

}

/* ==================================================
SHOW AUTH
================================================== */

function showAuth() {

 
const auth =
    document.getElementById(
        "auth-section"
    );


const app =
    document.getElementById(
        "app-section"
    );


const logoutButton =
    document.getElementById(
        "logout-button"
    );


if (auth) {

    auth.style.display =
        "block";

}


if (app) {

    app.style.display =
        "none";

}


if (logoutButton) {

    logoutButton.style.display =
        "none";

}
 

}

/* ==================================================
SHOW APP
================================================== */

function showApp() {

 
const auth =
    document.getElementById(
        "auth-section"
    );


const app =
    document.getElementById(
        "app-section"
    );


const logoutButton =
    document.getElementById(
        "logout-button"
    );


if (auth) {

    auth.style.display =
        "none";

}


if (app) {

    app.style.display =
        "block";

}


if (logoutButton) {

    logoutButton.style.display =
        "inline-block";

}


loadPosts();
loadPeople();
 

}

/* ==================================================
LOGOUT
================================================== */

async function logout() {

 
try {

    await fetch(
        "/api/logout",
        {
            method:
                "POST"
        }
    );

} catch (error) {

    console.error(
        "LOGOUT ERROR:",
        error
    );

}


showAuth();
 

}

/* ==================================================
LOAD POSTS
================================================== */

async function loadPosts() {

 
const container =
    document.getElementById(
        "posts"
    );


if (!container) {
    return;
}


try {

    const response =
        await fetch(
            "/api/posts"
        );


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
        posts.map(
            post => `

            <article class="post">

                <div class="post-header">

                    <strong>
                        ${escapeHtml(
                            post.username ||
                            "User"
                        )}
                    </strong>

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

                        Loading...

                    </div>


                    <div class="comment-form">

                        <input
                            id="comment-input-${post.id}"
                            placeholder="Write a comment..."
                            maxlength="500">


                        <button
                            onclick="submitComment('${post.id}')">

                            Send

                        </button>

                    </div>

                </div>

            </article>

        `
        ).join("");


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

/* ==================================================
CREATE POST
================================================== */

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

    return;

}


try {

    const response =
        await fetch(
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


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            data.error ||
            "Could not create post."
        );

    }


    input.value =
        "";


    status.textContent =
        "✅ Posted!";


    loadPosts();


} catch (error) {

    status.textContent =
        "❌ " +
        error.message;

}
 

}

/* ==================================================
COMMENTS
================================================== */

async function toggleComments(
postId
) {

 
const box =
    document.getElementById(
        `comments-${postId}`
    );


if (!box) {
    return;
}


if (
    box.style.display ===
    "none"
) {

    box.style.display =
        "block";


    loadComments(
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

 
const list =
    document.getElementById(
        `comment-list-${postId}`
    );


if (!list) {
    return;
}


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
        comments.map(
            comment => `

            <div class="comment">

                <strong>
                    ${escapeHtml(
                        comment.username ||
                        "User"
                    )}
                </strong>

                <p>
                    ${escapeHtml(
                        comment.content
                    )}
                </p>

            </div>

        `
        ).join("");


} catch (error) {

    list.innerHTML =
        `<p>❌ ${escapeHtml(
            error.message
        )}</p>`;

}
 

}

async function submitComment(
postId
) {

 
const input =
    document.getElementById(
        `comment-input-${postId}`
    );


const content =
    input.value.trim();


if (!content) {
    return;
}


try {

    const response =
        await fetch(
            `/api/posts/${postId}/comments`,
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


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            data.error ||
            "Could not comment."
        );

    }


    input.value =
        "";


    loadComments(
        postId
    );


} catch (error) {

    alert(
        "❌ " +
        error.message
    );

}
 

}

/* ==================================================
PEOPLE
================================================== */

async function loadPeople() {

 
const container =
    document.getElementById(
        "people"
    );


if (!container) {
    return;
}


try {

    const response =
        await fetch(
            "/api/users"
        );


    const users =
        await response.json();


    if (!response.ok) {

        throw new Error(
            users.error ||
            "Could not load people."
        );

    }


    container.innerHTML =
        users.map(
            user => `

            <div class="person">

                <a
                    href="/profile.html?id=${encodeURIComponent(
                        user.id
                    )}">

                    <strong>
                        ${escapeHtml(
                            user.display_name ||
                            user.username
                        )}
                    </strong>

                </a>

                <p>
                    @${escapeHtml(
                        user.username
                    )}
                </p>

            </div>

        `
        ).join("");


} catch (error) {

    container.innerHTML =
        `<p>❌ ${escapeHtml(
            error.message
        )}</p>`;

}
 

}

/* ==================================================
START
================================================== */

document.addEventListener(
"DOMContentLoaded",
() => {


    checkLogin();

}


);
