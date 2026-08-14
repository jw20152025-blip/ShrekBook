
"use strict";


let currentRoomId =
    null;


/* =========================================================
   LOAD ROOMS
========================================================= */

async function loadChatRooms() {

    console.log(
        "💬 Loading ShrekChat rooms..."
    );


    const container =
        document.getElementById(
            "chat-rooms"
        );


    if (!container) {

        console.warn(
            "⚠️ #chat-rooms not found"
        );

        return;

    }


    try {

        const response =
            await fetch(
                "/api/chat/rooms",
                {
                    credentials:
                        "include"
                }
            );


        const data =
            await response.json();


        console.log(
            "💬 ROOMS:",
            data
        );


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not load rooms."
            );

        }


        container.innerHTML =
            "";


        if (
            !data.rooms ||
            data.rooms.length === 0
        ) {

            container.innerHTML =
                `<div class="empty-state">
                    No chats yet.
                </div>`;

            return;

        }


        data.rooms.forEach(
            room => {

                const button =
                    document.createElement(
                        "button"
                    );


                button.className =
                    "chat-room-button";


                button.textContent =
                    room.name ||
                    room.title ||
                    "ShrekChat";


                button.addEventListener(
                    "click",
                    () => {

                        openChatRoom(
                            room.id
                        );

                    }
                );


                container.appendChild(
                    button
                );

            }
        );


    } catch (error) {

        console.error(
            "❌ CHAT ROOMS ERROR:",
            error
        );


        container.innerHTML =
            `<div class="error-state">
                ${escapeChatHTML(error.message)}
            </div>`;

    }

}


/* =========================================================
   OPEN ROOM
========================================================= */

async function openChatRoom(
    roomId
) {

    currentRoomId =
        roomId;


    console.log(
        "💬 Opening room:",
        roomId
    );


    const messages =
        document.getElementById(
            "chat-messages"
        );


    if (messages) {

        messages.innerHTML =
            "Loading messages...";

    }


    await loadMessages(
        roomId
    );

}


/* =========================================================
   LOAD MESSAGES
========================================================= */

async function loadMessages(
    roomId
) {

    try {

        const response =
            await fetch(
                `/api/chat/rooms/${encodeURIComponent(roomId)}/messages`,
                {
                    credentials:
                        "include"
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not load messages."
            );

        }


        const container =
            document.getElementById(
                "chat-messages"
            );


        if (!container) {

            return;

        }


        container.innerHTML =
            "";


        const messages =
            data.messages ||
            [];


        messages.forEach(
            message => {

                const element =
                    document.createElement(
                        "div"
                    );


                element.className =
                    "chat-message";


                element.innerHTML = `

                    <div class="chat-message-content">
                        ${escapeChatHTML(
                            message.content || ""
                        )}
                    </div>

                `;


                container.appendChild(
                    element
                );

            }
        );


        container.scrollTop =
            container.scrollHeight;


    } catch (error) {

        console.error(
            "❌ LOAD MESSAGES ERROR:",
            error
        );

    }

}


/* =========================================================
   SEND MESSAGE
========================================================= */

async function sendChatMessage() {

    if (!currentRoomId) {

        alert(
            "Open a chat room first."
        );

        return;

    }


    const input =
        document.getElementById(
            "chat-input"
        );


    if (!input) {

        return;

    }


    const content =
        input.value.trim();


    if (!content) {

        return;

    }


    try {

        const response =
            await fetch(
                `/api/chat/rooms/${encodeURIComponent(currentRoomId)}/messages`,
                {

                    method:
                        "POST",

                    credentials:
                        "include",

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
                "Message failed."
            );

        }


        input.value =
            "";


        await loadMessages(
            currentRoomId
        );


    } catch (error) {

        console.error(
            "❌ SEND MESSAGE ERROR:",
            error
        );


        alert(
            error.message
        );

    }

}


/* =========================================================
   ESCAPE
========================================================= */

function escapeChatHTML(
    value
) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   INITIALIZE
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "💬 SHREKCHAT READY"
        );


        loadChatRooms();


        const sendButton =
            document.getElementById(
                "send-chat-button"
            );


        if (sendButton) {

            sendButton.addEventListener(
                "click",
                sendChatMessage
            );

        }


        const input =
            document.getElementById(
                "chat-input"
            );


        if (input) {

            input.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        event.preventDefault();

                        sendChatMessage();

                    }

                }
            );

        }

    }
);

