// ==================================================
// SHREKBOOK SERVER
// ==================================================

require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");

const { createClient } =
    require("@supabase/supabase-js");


// ==================================================
// APP
// ==================================================

const app = express();

const PORT =
    process.env.PORT || 3000;


// ==================================================
// SUPABASE
// ==================================================

const supabase =
    createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
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


app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "shrekbook-secret",

        resave: false,

        saveUninitialized: false,

        cookie: {
            secure:
                process.env.NODE_ENV ===
                "production",

            httpOnly: true,

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
// BASIC API
// ==================================================

app.get(
    "/api/test",
    (req, res) => {

        res.json({
            success: true,
            message:
                "ShrekBook API is working 🧌"
        });

    }
);


app.get(
    "/api/health",
    (req, res) => {

        res.json({
            status: "ok"
        });

    }
);


// ==================================================
// AUTH HELPERS
// ==================================================

function requireLogin(
    req,
    res,
    next
) {

    if (
        !req.session ||
        !req.session.user
    ) {

        return res.status(401).json({
            error:
                "You must be logged in."
        });

    }

    next();

}


// ==================================================
// ADMIN HELPER
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


        const userId =
            req.session.user.id;


        const {
            data: admin,
            error
        } = await supabase
            .from("admins")
            .select("id, user_id")
            .eq(
                "user_id",
                userId
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


        req.admin = admin;

        next();

    } catch (error) {

        console.error(
            "REQUIRE ADMIN ERROR:",
            error
        );

        res.status(500).json({
            error:
                "Server error."
        });

    }

}


// ==================================================
// MAKE HELPERS AVAILABLE TO ROUTES
// ==================================================

app.locals.supabase =
    supabase;

app.locals.requireLogin =
    requireLogin;

app.locals.requireAdmin =
    requireAdmin;






// ==================================================
// ROOT
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
// 404 API
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
const authRoutes =
    require("./routes/auth");

const userRoutes =
    require("./routes/users");

const postRoutes =
    require("./routes/posts");

const reactionRoutes =
    require("./routes/reactions");

const chatRoutes =
    require("./routes/chat");

const uploadRoutes =
    require("./routes/uploads");

const systemRoutes =
    require("./routes/system");

const adminRoutes =
    require("./routes/admin");
app.use(
    "/api",
    authRoutes
);

app.use(
    "/api/users",
    userRoutes
);

app.use(
    "/api/posts",
    postRoutes
);

app.use(
    "/api/reactions",
    reactionRoutes
);

app.use(
    "/api/shrekchat",
    chatRoutes
);

app.use(
    "/api/uploads",
    uploadRoutes
);

app.use(
    "/api",
    systemRoutes
);

app.use(
    "/api/admin",
    adminRoutes
);

// ==================================================
// START
// ==================================================

app.listen(
    PORT,
    () => {

        console.log(
            `🧌 ShrekBook running on port ${PORT}`
        );

    }
);