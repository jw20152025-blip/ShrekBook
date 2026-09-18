
// ============================================================
// SHREKAI CHAT
// ============================================================

const SHREKAI_API = "/api/shrekai";

const messagesContainer =
    document.getElementById("shrekai-messages");

const input =
    document.getElementById("shrekai-input");

const sendButton =
    document.getElementById("shrekai-send");

const clearButton =
    document.getElementById("shrekai-clear");

let conversation = [];


// ============================================================
// ADD MESSAGE
// ============================================================

function addMessage(role, content) {

    const wrapper =
        document.createElement("div");

    wrapper.className =
        `shrekai-message ${role}`;

    const bubble =
        document.createElement("div");

    bubble.className =
        "shrekai-bubble";

    bubble.textContent =
        content;

    wrapper.appendChild(bubble);

    messagesContainer.appendChild(
        wrapper
    );

    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;
}


// ============================================================
// WELCOME MESSAGE
// ============================================================

addMessage(
    "ai",
    "Yo! I'm ShrekAI. 🧅\n\nAsk me something."
);


// ============================================================
// SEND MESSAGE
// ============================================================

async function sendMessage() {

    const message =
        input.value.trim();

    if (!message) {
        return;
    }


    // --------------------------------------------------------
    // USER MESSAGE
    // --------------------------------------------------------

    addMessage(
        "user",
        message
    );

    conversation.push({
        role: "user",
        content: message
    });

    input.value = "";


    // --------------------------------------------------------
    // DISABLE INPUT
    // --------------------------------------------------------

    sendButton.disabled = true;
    input.disabled = true;


    // --------------------------------------------------------
    // THINKING MESSAGE
    // --------------------------------------------------------

    const thinking =
        document.createElement("div");

    thinking.className =
        "shrekai-message ai";

    thinking.id =
        "shrekai-thinking";

    thinking.innerHTML = `
        <div class="shrekai-bubble shrekai-thinking">
            ShrekAI is thinking...
        </div>
    `;

    messagesContainer.appendChild(
        thinking
    );

    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;


    // --------------------------------------------------------
    // REQUEST
    // --------------------------------------------------------

    try {

        const response =
            await fetch(
                SHREKAI_API,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        messages:
                            conversation
                    })
                }
            );


        // ----------------------------------------------------
        // HANDLE HTTP ERRORS
        // ----------------------------------------------------

        if (!response.ok) {

            let errorMessage =
                `HTTP ${response.status}`;

            try {

                const errorData =
                    await response.json();

                if (
                    errorData &&
                    errorData.error
                ) {
                    errorMessage =
                        errorData.error;
                }

            } catch {
                // Ignore invalid JSON
            }

            throw new Error(
                errorMessage
            );
        }


        // ----------------------------------------------------
        // RESPONSE
        // ----------------------------------------------------

        const data =
            await response.json();


        thinking.remove();


        const reply =
            data.response;


        if (
            typeof reply !== "string" ||
            !reply.trim()
        ) {

            throw new Error(
                "ShrekAI returned an empty response."
            );
        }


        // ----------------------------------------------------
        // DISPLAY AI RESPONSE
        // ----------------------------------------------------

        addMessage(
            "ai",
            reply
        );


        conversation.push({
            role: "assistant",
            content: reply
        });


    } catch (error) {

        console.error(
            "ShrekAI error:",
            error
        );


        thinking.remove();


        addMessage(
            "ai",
            "💀 ShrekAI couldn't respond.\n\n" +
            error.message
        );

    } finally {

        sendButton.disabled = false;

        input.disabled = false;

        input.focus();
    }
}


// ============================================================
// SEND BUTTON
// ============================================================

sendButton.addEventListener(
    "click",
    sendMessage
);


// ============================================================
// ENTER TO SEND
// ============================================================

input.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();
        }
    }
);


// ============================================================
// CLEAR CHAT
// ============================================================

clearButton.addEventListener(
    "click",
    function () {

        conversation = [];

        messagesContainer.innerHTML = "";

        addMessage(
            "ai",
            "Chat cleared. 🧅\n\nWhat's up?"
        );

        input.focus();
    }
);

