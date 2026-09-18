
// ============================================================
// SHREKAI CHAT
// ============================================================

// Your actual ShrekAI API
const SHREKAI_API = "http://127.0.0.1:8765/chat";


// ============================================================
// ELEMENTS
// ============================================================

const messagesContainer =
    document.getElementById("shrekai-messages");

const input =
    document.getElementById("shrekai-input");

const sendButton =
    document.getElementById("shrekai-send");

const clearButton =
    document.getElementById("shrekai-clear");


// ============================================================
// CONVERSATION
// ============================================================

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

    messagesContainer.appendChild(wrapper);


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


    // Display user's message
    addMessage(
        "user",
        message
    );


    // Add to conversation
    conversation.push({
        role: "user",
        content: message
    });


    // Clear input
    input.value = "";


    // Disable controls
    sendButton.disabled = true;
    input.disabled = true;


    // Thinking indicator
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


    try {

        // ====================================================
        // CALL YOUR ACTUAL SHREKAI SERVER
        // ====================================================

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


        // ====================================================
        // HTTP ERROR
        // ====================================================

        if (!response.ok) {

            let errorMessage =
                `HTTP ${response.status}`;

            try {

                const errorData =
                    await response.json();

                if (errorData.error) {
                    errorMessage =
                        errorData.error;
                }

            } catch {
                // Ignore invalid error JSON
            }


            throw new Error(
                errorMessage
            );
        }


        // ====================================================
        // READ RESPONSE
        // ====================================================

        const data =
            await response.json();


        thinking.remove();


        // Your server returns:
        //
        // {
        //     "response": "..."
        // }

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


        // ====================================================
        // DISPLAY AI RESPONSE
        // ====================================================

        addMessage(
            "ai",
            reply
        );


        // Add AI response to conversation
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
            "💀 I couldn't connect to ShrekAI.\n\n" +
            "Make sure the ShrekAI server is running."
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
// SHIFT + ENTER = NEW LINE
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

