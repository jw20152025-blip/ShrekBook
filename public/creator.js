const canvas =
document.getElementById("canvas");

const ctx =
canvas.getContext("2d");

const colorInput =
document.getElementById("color");

const brushSizeInput =
document.getElementById("brushSize");

const brushSizeValue =
document.getElementById("brushSizeValue");

const brushButton =
document.getElementById("brushButton");

const eraserButton =
document.getElementById("eraserButton");

const undoButton =
document.getElementById("undoButton");

const redoButton =
document.getElementById("redoButton");

const clearButton =
document.getElementById("clearButton");

const newButton =
document.getElementById("newButton");

const exportSB =
document.getElementById("exportSB");

const importSB =
document.getElementById("importSB");

const exportPNG =
document.getElementById("exportPNG");

const status =
document.getElementById("status");

/* ==========================================
STATE
========================================== */

let drawing =
false;

let erasing =
false;

let lastX =
0;

let lastY =
0;

/*
Each canvas state is stored as an image.


This gives us simple undo / redo support.


*/

let undoStack =
[];

let redoStack =
[];

/* ==========================================
CANVAS INITIALIZATION
========================================== */

function clearCanvas(
saveState = true
) {

if (saveState) {
    saveUndoState();
}

ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
);

ctx.fillStyle =
    "#ffffff";

ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
);

updateStatus(
    "Canvas cleared."
);


}

function initializeCanvas() {


ctx.fillStyle =
    "#ffffff";

ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
);

undoStack =
    [];

redoStack =
    [];

saveUndoState();


}

initializeCanvas();

/* ==========================================
STATUS
========================================== */

function updateStatus(
text
) {


status.textContent =
    text;


}

/* ==========================================
DRAWING
========================================== */

function getCanvasPosition(
event
) {


const rect =
    canvas.getBoundingClientRect();

const scaleX =
    canvas.width /
    rect.width;

const scaleY =
    canvas.height /
    rect.height;

return {

    x:
        (event.clientX - rect.left) *
        scaleX,

    y:
        (event.clientY - rect.top) *
        scaleY

};


}

function startDrawing(
event
) {

drawing =
    true;

const position =
    getCanvasPosition(
        event
    );

lastX =
    position.x;

lastY =
    position.y;

/*
    Save the state BEFORE drawing.
    This makes undo work properly.
*/

saveUndoState();

redoStack =
    [];

event.preventDefault();


}

function draw(
event
) {


if (!drawing) {
    return;
}

const position =
    getCanvasPosition(
        event
    );

ctx.beginPath();

ctx.moveTo(
    lastX,
    lastY
);

ctx.lineTo(
    position.x,
    position.y
);

ctx.lineWidth =
    Number(
        brushSizeInput.value
    );

ctx.lineCap =
    "round";

ctx.lineJoin =
    "round";

if (erasing) {

    ctx.globalCompositeOperation =
        "destination-out";

} else {

    ctx.globalCompositeOperation =
        "source-over";

    ctx.strokeStyle =
        colorInput.value;

}

ctx.stroke();

ctx.globalCompositeOperation =
    "source-over";

lastX =
    position.x;

lastY =
    position.y;

event.preventDefault();


}

function stopDrawing(
event
) {


if (!drawing) {
    return;
}

drawing =
    false;

event?.preventDefault();


}

canvas.addEventListener(
"pointerdown",
startDrawing
);

canvas.addEventListener(
"pointermove",
draw
);

canvas.addEventListener(
"pointerup",
stopDrawing
);

canvas.addEventListener(
"pointercancel",
stopDrawing
);

canvas.addEventListener(
"pointerleave",
stopDrawing
);

/* ==========================================
BRUSH / ERASER
========================================== */

brushButton.addEventListener(
"click",
() => {


    erasing =
        false;

    brushButton.classList.add(
        "active"
    );

    eraserButton.classList.remove(
        "active"
    );

    updateStatus(
        "Brush selected 🖌️"
    );

}


);

eraserButton.addEventListener(
"click",
() => {


    erasing =
        true;

    eraserButton.classList.add(
        "active"
    );

    brushButton.classList.remove(
        "active"
    );

    updateStatus(
        "Eraser selected 🧽"
    );

}

);

/* ==========================================
BRUSH SIZE
========================================== */

brushSizeInput.addEventListener(
"input",
() => {

    brushSizeValue.textContent =
        brushSizeInput.value;

}


);

/* ==========================================
UNDO / REDO
========================================== */

function saveUndoState() {


undoStack.push(
    canvas.toDataURL(
        "image/png"
    )
);

/*
    Prevent unlimited memory usage.
*/

if (
    undoStack.length >
    30
) {

    undoStack.shift();

}


}

function restoreCanvas(
dataURL
) {


const image =
    new Image();

image.onload =
    () => {

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        ctx.drawImage(
            image,
            0,
            0
        );

    };

image.src =
    dataURL;


}

undoButton.addEventListener(
"click",
() => {


    if (
        undoStack.length <= 1
    ) {

        updateStatus(
            "Nothing to undo."
        );

        return;

    }

    const current =
        undoStack.pop();

    redoStack.push(
        current
    );

    const previous =
        undoStack[
            undoStack.length - 1
        ];

    restoreCanvas(
        previous
    );

    updateStatus(
        "Undo ↩️"
    );

}


);

redoButton.addEventListener(
"click",
() => {


    if (!redoStack.length) {

        updateStatus(
            "Nothing to redo."
        );

        return;

    }

    const state =
        redoStack.pop();

    undoStack.push(
        state
    );

    restoreCanvas(
        state
    );

    updateStatus(
        "Redo ↪️"
    );

}


);

/* ==========================================
CLEAR
========================================== */

clearButton.addEventListener(
"click",
() => {


    if (
        !confirm(
            "Clear the entire canvas?"
        )
    ) {

        return;

    }

    clearCanvas();

}


);

/* ==========================================
NEW
========================================== */

newButton.addEventListener(
"click",
() => {


    if (
        !confirm(
            "Start a new creation?"
        )
    ) {

        return;

    }

    clearCanvas(
        false
    );

    undoStack =
        [];

    redoStack =
        [];

    saveUndoState();

    updateStatus(
        "New creation started 🧌"
    );

}


);

/* ==========================================
.SB FILE FORMAT
========================================== */

function createSBFile() {

return {

    format:
        "ShrekBook",

    file_type:
        "sb",

    version:
        1,

    creator:
        "local",

    width:
        canvas.width,

    height:
        canvas.height,

    created_at:
        new Date().toISOString(),

    image:
        canvas.toDataURL(
            "image/png"
        )

};


}

/* ==========================================
EXPORT .SB
========================================== */

exportSB.addEventListener(
"click",
() => {


    const data =
        createSBFile();

    const json =
        JSON.stringify(
            data,
            null,
            2
        );

    const blob =
        new Blob(
            [json],
            {
                type:
                    "application/json"
            }
        );

    const url =
        URL.createObjectURL(
            blob
        );

    const link =
        document.createElement(
            "a"
        );

    link.href =
        url;

    link.download =
        "shrekbook-creation.sb";

    document.body.appendChild(
        link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
        url
    );

    updateStatus(
        "Exported .sb file 📦"
    );

}


);

/* ==========================================
IMPORT .SB
========================================== */

importSB.addEventListener(
"change",
async () => {


    const file =
        importSB.files[0];

    if (!file) {
        return;
    }

    try {

        if (
            !file.name
                .toLowerCase()
                .endsWith(".sb")
        ) {

            throw new Error(
                "Please select a .sb file."
            );

        }

        if (
            file.size >
            10 * 1024 * 1024
        ) {

            throw new Error(
                ".sb file is too large."
            );

        }

        const text =
            await file.text();

        const data =
            JSON.parse(
                text
            );

        if (
            data.format !==
            "ShrekBook"
        ) {

            throw new Error(
                "This is not a valid ShrekBook file."
            );

        }

        if (
            data.file_type !==
            "sb"
        ) {

            throw new Error(
                "Invalid ShrekBook file type."
            );

        }

        if (
            data.version !== 1
        ) {

            throw new Error(
                "Unsupported .sb version."
            );

        }

        if (
            typeof data.image !==
            "string"
        ) {

            throw new Error(
                "The .sb file contains no artwork."
            );

        }

        const image =
            new Image();

        image.onload =
            () => {

                ctx.clearRect(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );

                ctx.drawImage(
                    image,
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );

                undoStack =
                    [];

                redoStack =
                    [];

                saveUndoState();

                updateStatus(
                    "Imported .sb successfully 🧌"
                );

            };

        image.onerror =
            () => {

                throw new Error(
                    "Could not read artwork."
                );

            };

        image.src =
            data.image;

    } catch (error) {

        console.error(
            "SB IMPORT ERROR:",
            error
        );

        updateStatus(
            "❌ " +
            error.message
        );

    }

    importSB.value =
        "";

}


);

/* ==========================================
EXPORT PNG
========================================== */

exportPNG.addEventListener(
"click",
() => {


    const link =
        document.createElement(
            "a"
        );

    link.download =
        "shrekbook-creation.png";

    link.href =
        canvas.toDataURL(
            "image/png"
        );

    document.body.appendChild(
        link
    );

    link.click();

    link.remove();

    updateStatus(
        "Exported PNG 🖼️"
    );

}


);
