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

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.locals.supabase = supabase;

// ==================================================
// MIDDLEWARE
// ==================================================

app.use(express.json({ limit: "10mb" }));

app.use(
    express.urlencoded({
        extended: true
    })
);

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

            sameSite: "lax"
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
// ROUTES
// ==================================================

app.use(
    "/api",
    authRoutes
);

app.use(
    "/api/admin",
    adminRoutes
);

app.use(
    "/api",
    postsRoutes
);

app.use(
    "/api",
    usersRoutes
);

app.use(
    "/api",
    commentsRoutes
);

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
// START SERVER
// ==================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🧌 ShrekBook running on port ${PORT}`
        );

    }
);