/* =========================================================
   SHREKCHAT CLIENT
========================================================= */

let currentUser = null;
let currentRoom = null;


/* =========================================================
   HELPERS
========================================================= */

async function fetchJSON(url, options = {}) {

    const response = await fetch(url, {

        credentials: "include",

        ...options,

        headers: {

            "Accept": "application/json",

            ...(options.headers || {})

        }

    });

    const text = await response.text();

    let data = {};

    try {
        data = text
            ? JSON.parse(text)
            : {};
    } catch {

        throw new Error(
            "Server returned invalid JSON."
        );

    }

    if (!response.ok) {

        throw new Error(
            data.error ||
            "Server request failed."
        );

    }

    return data;
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text ?? "";

    return div.innerHTML;
}


/* =========================================================
   LOAD CURRENT USER
========================================================= */

async function loadCurrentUser() {

    const data =
        await fetchJSON("/api/me");

    if (!data.loggedIn) {

        window.location.href =
            "/login.html";

        return false;

    }

    currentUser =
        data.user;

    return true;
}


/* =========================================================
   LOAD ROOMS
========================================================= */

async function loadRooms() {

    const container =
        document.getElementById(
            "chat-rooms-list"
        );

    try {

        const data =
            await fetchJSON(
                "/api/chat/rooms"
            );

        const rooms =
            data.rooms || [];

        if (!rooms.length) {

            container.innerHTML =
                `
                <div class="empty">
                    No chats yet.
                </div>
                `;

            return;

        }

        container.innerHTML =
            rooms.map(room => {

                const name =
                    room.name ||
                    "ShrekChat room";

                return `
                    <div
                        class="chat-room"
                        data-room-id="${escapeHtml(room.id)}"
                        onclick="selectRoom('${escapeHtml(room.id)}')"
                    >

                        <div class="chat-room-name">
                            ${escapeHtml(name)}
                        </div>

                        <div class="chat-room-preview">
                            Open conversation
                        </div>

                    </div>
                `;

            }).join("");

    } catch (error) {

        console.error(
            "CHAT ROOMS ERROR:",
            error
        );

        container.innerHTML =
            `
            <div class="empty">
                ❌ ${escapeHtml(error.message)}
            </div>
            `;

    }

}


/* =========================================================
   SELECT ROOM
========================================================= */

async function selectRoom(roomId) {

    currentRoom =
        roomId;


    document
        .querySelectorAll(".chat-room")
        .forEach(element => {

            element.classList.toggle(
                "active",
                element.dataset.roomId === roomId
            );

        });


    const header =
        document.getElementById(
            "chat-header"
        );


    const selected =
        document.querySelector(
            `.chat-room[data-room-id="${CSS.escape(roomId)}"]`
        );


    header.textContent =
        selected
            ?.querySelector(".chat-room-name")
            ?.textContent ||
        "ShrekChat";


    await loadMessages();

}


/* =========================================================
   LOAD MESSAGES
========================================================= */

async function loadMessages() {

    if (!currentRoom) {
        return;
    }


    const container =
        document.getElementById(
            "chat-messages"
        );


    try {

        const data =
            await fetchJSON(
                `/api/chat/rooms/${encodeURIComponent(
                    currentRoom
                )}/messages`
            );


        const messages =
            data.messages || [];


        if (!messages.length) {

            container.innerHTML =
                `
                <div class="empty">
                    No messages yet. Be the first 👀
                </div>
                `;

            return;

        }


        container.innerHTML =
            messages.map(message => {

                const mine =
                    String(
                        message.sender_id
                    ) ===
                    String(
                        currentUser.id
                    );


                const author =
                    message.sender_name ||
                    message.username ||
                    "User";


                const time =
                    message.created_at
                        ? new Date(
                            message.created_at
                        ).toLocaleString()
                        : "";


                return `
                    <div
                        class="chat-message ${
                            mine ? "mine" : ""
                        }"
                    >

                        <div class="chat-message-author">
                            ${escapeHtml(author)}
                        </div>

                        <div>
                            ${escapeHtml(
                                message.content
                            )}
                        </div>

                        ${
                            time
                                ? `
                                <span class="chat-message-time">
                                    ${escapeHtml(time)}
                                </span>
                                `
                                : ""
                        }

                    </div>
                `;

            }).join("");


        container.scrollTop =
            container.scrollHeight;


    } catch (error) {

        console.error(
            "MESSAGES ERROR:",
            error
        );

        container.innerHTML =
            `
            <div class="empty">
                ❌ ${escapeHtml(error.message)}
            </div>
            `;

    }

}


/* =========================================================
   SEND MESSAGE
========================================================= */

async function sendMessage(event) {

    event.preventDefault();


    if (!currentRoom) {

        alert(
            "Pick a chat first."
        );

        return;

    }


    const input =
        document.getElementById(
            "chat-input"
        );


    const content =
        input.value.trim();


    if (!content) {
        return;
    }


    input.disabled =
        true;


    try {

        await fetchJSON(
            `/api/chat/rooms/${encodeURIComponent(
                currentRoom
            )}/messages`,
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


        input.value = "";

        await loadMessages();


    } catch (error) {

        console.error(
            "SEND MESSAGE ERROR:",
            error
        );

        alert(
            "❌ " +
            error.message
        );

    } finally {

        input.disabled =
            false;

        input.focus();

    }

}


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

    try {

        await fetchJSON(
            "/api/logout",
            {
                method: "POST"
            }
        );

    } catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );

    }

    window.location.href =
        "/login.html";

}


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "🧌 ShrekChat loaded"
        );


        const loggedIn =
            await loadCurrentUser();


        if (!loggedIn) {
            return;
        }


        await loadRooms();


        document
            .getElementById("chat-form")
            .addEventListener(
                "submit",
                sendMessage
            );

    }
);