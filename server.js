const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.get("/test", (req, res) => {
    res.send("SHREKBOOK SERVER WORKS 🧌");
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(3000, "0.0.0.0", () => {
    console.log("🧌 ShrekBook running on port 3000");
});