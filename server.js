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
const shrekchatRoutes = require("./routes/shrekchat");

// ==================================================
// APP
// ==================================================

const app = express();

const PORT = process.env.PORT || 3000;

// ==================================================
// SUPABASE
// ==================================================

if (
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
    console.error("Missing Supabase environment variables.");
    process.exit(1);
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.locals.supabase = supabase;

// ==================================================
// ADMIN HELPER
// ==================================================

app.locals.requireAdmin = async function (
    req,
    res,
    callback
) {

    try {

        if (
            !req.session ||
            !req.session.user
        ) {

            return res.status(401).json({
                error: "You must be logged in."
            });

        }

        const {
            data: admin,
            error
        } = await supabase
            .from("admins")
            .select("id")
            .eq(
                "user_id",
                req.session.user.id
            )
            .maybeSingle();

        if (error) {

            console.error(
                "ADMIN CHECK ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    "Could not verify administrator status."
            });

        }

        if (!admin) {

            return res.status(403).json({
                error:
                    "Administrator access required."
            });

        }

        return await callback();

    } catch (error) {

        console.error(
            "ADMIN CHECK ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Server error."
        });

    }

};

// ==================================================
// MIDDLEWARE
// ==================================================

app.use(
    express.json({
        limit: "10mb"
    })
);

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

            sameSite: "lax",

            maxAge:
                1000 *
                60 *
                60 *
                24 *
                7
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

app.use(
    "/api/chat",
    shrekchatRoutes
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