// ==================================================
// SHREKBOOK SERVER
// ==================================================

require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const { createClient } = require("@supabase/supabase-js");

// ==================================================
// ROUTES
// ==================================================

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const postsRoutes = require("./routes/posts");
const usersRoutes = require("./routes/users");
const commentsRoutes = require("./routes/comments");
const reactionsRoutes = require("./routes/reactions");

// ==================================================
// APP
// ==================================================

const app = express();

const PORT = process.env.PORT || 3000;

// ==================================================
// SUPABASE
// ==================================================

if (!process.env.SUPABASE_URL) {
    console.error("❌ SUPABASE_URL is missing.");
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
        "❌ SUPABASE_SERVICE_ROLE_KEY is missing."
    );
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.locals.supabase = supabase;

// ==================================================
// BODY PARSING
// ==================================================

app.use(
    express.json({
        limit: "10mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb"
    })
);

// ==================================================
// SESSION
// ==================================================

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "shrekbook-secret",

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,

            secure:
                process.env.NODE_ENV === "production",

            sameSite: "lax",

            maxAge:
                1000 *
                60 *
                60 *
                24 *
                30
        }
    })
);

// ==================================================
// STATIC FILES
// ==================================================

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);

// ==================================================
// BASIC HEALTH CHECK
// ==================================================

app.get(
    "/api/health",
    (req, res) => {

        res.json({
            success: true,
            message: "ShrekBook backend is alive 🧌"
        });

    }
);

// ==================================================
// API ROUTES
// ==================================================

// AUTH
app.use(
    "/api",
    authRoutes
);

// ADMIN
app.use(
    "/api/admin",
    adminRoutes
);

// POSTS
app.use(
    "/api",
    postsRoutes
);

// USERS
app.use(
    "/api",
    usersRoutes
);

// COMMENTS
app.use(
    "/api",
    commentsRoutes
);

// REACTIONS
app.use(
    "/api",
    reactionsRoutes
);

// ==================================================
// API 404
// ==================================================

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({

            error:
                "API endpoint not found."

        });

    }
);

// ==================================================
// GENERAL ERROR HANDLER
// ==================================================

app.use(
    (error, req, res, next) => {

        console.error(
            "SERVER ERROR:",
            error
        );

        if (res.headersSent) {

            return next(error);

        }

        res.status(500).json({

            error:
                "Internal server error."

        });

    }
);

// ==================================================
// START
// ==================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "===================================="
        );

        console.log(
            "🧌 SHREKBOOK BACKEND ONLINE"
        );

        console.log(
            `🌐 Port: ${PORT}`
        );

        console.log(
            "===================================="
        );

    }
);