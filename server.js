const express = require("express");
const path = require("path");
const session = require("express-session");

require("dotenv").config();

const supabase = require("./utils/supabase.js");


/* =========================================================
   APP
========================================================= */

const app = express();

const PORT =
    process.env.PORT || 3000;


/* =========================================================
   ENVIRONMENT
========================================================= */

const SESSION_SECRET =
    process.env.SESSION_SECRET;

if (!SESSION_SECRET) {

    console.error(
        "❌ Missing SESSION_SECRET environment variable."
    );

    process.exit(1);

}


/* =========================================================
   EXPRESS
========================================================= */

app.set(
    "trust proxy",
    1
);


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


/* =========================================================
   REQUEST LOGGER
========================================================= */

app.use(
    (req, res, next) => {

        if (
            req.path.startsWith("/api")
        ) {

            console.log(
                `${req.method} ${req.path}`
            );

        }

        next();

    }
);


/* =========================================================
   SESSION
========================================================= */

app.use(
    session({

        secret:
            SESSION_SECRET,

        resave:
            false,

        saveUninitialized:
            false,

        cookie: {

            httpOnly:
                true,

            secure:
                process.env.NODE_ENV ===
                "production",

            sameSite:
                "lax",

            maxAge:
                1000 *
                60 *
                60 *
                24 *
                30

        }

    })
);


/* =========================================================
   STATIC FRONTEND
========================================================= */

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


/* =========================================================
   BASIC HEALTH CHECK
========================================================= */

app.get(
    "/api/test",
    (req, res) => {

        res.json({

            success:
                true,

            message:
                "ShrekBook server is alive 🧌"

        });

    }
);


/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            ok:
                true,

            loggedIn:
                !!req.session.user

        });

    }
);


/* =========================================================
   CURRENT SESSION DEBUG
========================================================= */

app.get(
    "/api/session",
    (req, res) => {

        console.log(
            "ME SESSION:",
            req.session.user
        );

        res.json({

            loggedIn:
                !!req.session.user,

            user:
                req.session.user ||
                null

        });

    }
);


/* =========================================================
   ROUTES
========================================================= */

const authRouter =
    require("./routes/auth");

const profilesRouter =
    require("./routes/profiles");

const postsRouter =
    require("./routes/posts");

const reactionsRouter =
    require("./routes/reactions");

const chatRouter =
    require("./routes/chat");


/* =========================================================
   AUTH
========================================================= */

app.use(
    "/api",
    authRouter
);


/* =========================================================
   PROFILES / USERS
========================================================= */

app.use(
    "/api",
    profilesRouter
);


/* =========================================================
   POSTS
========================================================= */

app.use(
    "/api",
    postsRouter
);


/* =========================================================
   REACTIONS
========================================================= */

app.use(
    "/api",
    reactionsRouter
);


/* =========================================================
   SHREKCHAT
========================================================= */

app.use(
    "/api",
    chatRouter
);


/* =========================================================
   API 404
========================================================= */

app.use(
    "/api",
    (req, res) => {

        console.log(
            "❌ API ROUTE NOT FOUND:",
            req.method,
            req.originalUrl
        );

        res.status(404).json({

            error:
                "API route not found.",

            path:
                req.originalUrl

        });

    }
);


/* =========================================================
   FRONTEND FALLBACK
========================================================= */

/*
 * IMPORTANT:
 *
 * /api/* is handled above.
 *
 * Everything else gets the frontend.
 *
 * Express 5 uses:
 *
 * /{*splat}
 *
 * instead of the old:
 *
 * /*
 */

app.get(
    "/{*splat}",
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


/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "❌ SERVER ERROR:",
            error
        );


        if (
            res.headersSent
        ) {

            return next(
                error
            );

        }


        res.status(500).json({

            error:
                error.message ||
                "Internal server error."

        });

    }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🧌 ShrekBook running on port ${PORT}`
        );

        console.log(
            "📁 Frontend:",
            path.join(
                __dirname,
                "public"
            )
        );

        console.log(
            "🔐 Auth routes enabled"
        );

        console.log(
            "👤 Profile routes enabled"
        );

        console.log(
            "📝 Post routes enabled"
        );

        console.log(
            "❤️ Reaction routes enabled"
        );

        console.log(
            "💬 ShrekChat routes enabled"
        );

    }
);