const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

// Make sure data folder exists
if (!fs.existsSync(DATA_DIR)) {
fs.mkdirSync(DATA_DIR);
}

// Make sure users.json exists
if (!fs.existsSync(USERS_FILE)) {
fs.writeFileSync(USERS_FILE, "[]");
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
session({
secret: process.env.SESSION_SECRET || "shrekbook-test-secret",
resave: false,
saveUninitialized: false,
cookie: {
httpOnly: true,
secure: false
}
})
);

app.use(express.static(path.join(__dirname, "public")));

// -------------------------
// Read users
// -------------------------

function getUsers() {
try {
return JSON.parse(
fs.readFileSync(USERS_FILE, "utf8")
);
} catch (error) {
console.error("Could not read users.json:", error);
return [];
}
}

// -------------------------
// Save users
// -------------------------

function saveUsers(users) {
fs.writeFileSync(
USERS_FILE,
JSON.stringify(users, null, 4)
);
}

// -------------------------
// Create account
// -------------------------

app.post("/api/register", (req, res) => {


const {
    username,
    password,
    displayName,
    avatar,
    bio
} = req.body;

if (!username || !password) {
    return res.status(400).json({
        error: "Username and password are required."
    });
}

const users = getUsers();

const existingUser = users.find(
    user =>
        user.username.toLowerCase() ===
        username.toLowerCase()
);

if (existingUser) {
    return res.status(400).json({
        error: "Username already exists."
    });
}

const newUser = {
    id: Date.now(),
    username: username,
    password: password,
    displayName: displayName || username,
    avatar: avatar || "https://placehold.co/200x200",
    bio: bio || "No bio yet."
};

users.push(newUser);

saveUsers(users);

req.session.userId = newUser.id;

res.json({
    success: true,
    user: {
        id: newUser.id,
        username: newUser.username,
        displayName: newUser.displayName,
        avatar: newUser.avatar,
        bio: newUser.bio
    }
});


});

// -------------------------
// Login
// -------------------------

app.post("/api/login", (req, res) => {


const {
    username,
    password
} = req.body;

if (!username || !password) {
    return res.status(400).json({
        error: "Username and password are required."
    });
}

const users = getUsers();

const user = users.find(
    user =>
        user.username.toLowerCase() ===
        username.toLowerCase()
);

if (!user || user.password !== password) {
    return res.status(401).json({
        error: "Invalid username or password."
    });
}

req.session.userId = user.id;

res.json({
    success: true,
    user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio
    }
});


});

// -------------------------
// Logout
// -------------------------

app.post("/api/logout", (req, res) => {


req.session.destroy(() => {
    res.json({
        success: true
    });
});


});

// -------------------------
// Current user
// -------------------------

app.get("/api/me", (req, res) => {


if (!req.session.userId) {
    return res.status(401).json({
        error: "Not logged in."
    });
}

const users = getUsers();

const user = users.find(
    user => user.id === req.session.userId
);

if (!user) {
    return res.status(404).json({
        error: "User not found."
    });
}

res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    bio: user.bio
});


});

// -------------------------
// All users
// -------------------------

app.get("/api/users", (req, res) => {


const users = getUsers();

const safeUsers = users.map(user => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    bio: user.bio
}));

res.json(safeUsers);


});

// -------------------------
// One user
// -------------------------

app.get("/api/users/:id", (req, res) => {


const users = getUsers();

const user = users.find(
    user =>
        String(user.id) ===
        String(req.params.id)
);

if (!user) {
    return res.status(404).json({
        error: "User not found."
    });
}

res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    bio: user.bio
});


});

// -------------------------
// Start server
// -------------------------

app.listen(PORT, "0.0.0.0", () => {
console.log(`ShrekBook running on port ${PORT}`);
});
