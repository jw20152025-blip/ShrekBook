
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
const shrekchatRoutes = require("./routes/shrekchat");

const app = express();

const PORT = process.env.PORT || 3000;


// ==================================================
// SUPABASE
// ==================================================

if (
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
    console.error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );

    process.exit(1);
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.locals.supabase = supabase;


// ==================================================
// SUPABASE ON REQUEST
// ==================================================

app.use(
    (req, res, next) => {

        req.supabase = supabase;

        next();

    }
);


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
// REQUIRE ADMIN
// ==================================================

async function requireAdmin(
    req,
    res,
    next
) {

    try {

        if (
            !req.session ||
            !req.session.user
        ) {

            return res.status(401).json({
                error:
                    "You must be logged in."
            });

        }


        const {
            data: admin,
            error
        } = await supabase
            .from("admins")
            .select(
                "id,user_id"
            )
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
                    "Could not check administrator status."
            });

        }


        if (!admin) {

            return res.status(403).json({
                error:
                    "Administrator access required."
            });

        }


        next();

    } catch (error) {

        console.error(
            "REQUIRE ADMIN ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Server error."
        });

    }

}

app.locals.requireAdmin =
    requireAdmin;


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

// Authentication
app.use(
    "/api",
    authRoutes
);


// Administration
app.use(
    "/api/admin",
    adminRoutes
);


// Posts
app.use(
    "/api",
    postsRoutes
);


// Users
app.use(
    "/api",
    usersRoutes
);


// Comments
app.use(
    "/api",
    commentsRoutes
);


// Reactions
app.use(
    "/api",
    reactionsRoutes
);


// ShrekChat
app.use(
    "/api/shrekchat",
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
// FRONTEND
// ==================================================

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );

    }
);


// ==================================================
// ERROR HANDLER
// ==================================================

app.use(
    (err, req, res, next) => {

        console.error(
            "UNHANDLED SERVER ERROR:",
            err
        );

        if (res.headersSent) {
            return next(err);
        }

        res.status(500).json({
            error:
                "Internal server error."
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
            "ShrekBook running on port " +
            PORT
        );

    }
);

