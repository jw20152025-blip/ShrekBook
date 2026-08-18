require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const { createClient } = require("@supabase/supabase-js");

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const postsRoutes = require("./routes/posts");
const usersRoutes = require("./routes/users");
const commentsRoutes = require("./routes/comments");
const reactionsRoutes = require("./routes/reactions");

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
// ADMIN MIDDLEWARE
// ==================================================

app.locals.requireAdmin = async function (req, res, next) {

    if (!req.session || !req.session.user) {
        return res.status(401).json({
            error: "You must be logged in."
        });
    }

    try {

        const { data, error } = await supabase
            .from("admins")
            .select("id")
            .eq("user_id", req.session.user.id)
            .maybeSingle();

        if (error) {
            console.error("ADMIN CHECK ERROR:", error);

            return res.status(500).json({
                error: "Could not check administrator status."
            });
        }

        if (!data) {
            return res.status(403).json({
                error: "Administrator access required."
            });
        }

        return next();

    } catch (error) {

        console.error("ADMIN CHECK ERROR:", error);

        return res.status(500).json({
            error: "Server error."
        });

    }
};

// ==================================================
// MIDDLEWARE
// ==================================================

app.use(express.json({
    limit: "10mb"
}));

app.use(express.urlencoded({
    extended: true
}));

// ==================================================
// SESSION
// ==================================================

app.set("trust proxy", 1);

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "shrekbook-secret",

        resave: false,

        saveUninitialized: false,

        proxy: true,

        cookie: {
            httpOnly: true,

            secure: true,

            sameSite: "lax",

            maxAge: 1000 * 60 * 60 * 24 * 30
        }
    })
);

// ==================================================
// SUPABASE ACCESS FOR ROUTES
// ==================================================
//
// Your route files currently use req.supabase,
// so we provide it here.
//

app.use((req, res, next) => {

    req.supabase = req.app.locals.supabase;

    next();

});

// ==================================================
// STATIC FILES
// ==================================================

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

// ==================================================
// API ROUTES
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
            error: "API endpoint not found."
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
            `🧌 ShrekBook running on port ${PORT}`
        );

    }
);