require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");

const supabase = require("./utils/supabase.js");

const app = express();

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
    console.error("❌ Missing SESSION_SECRET.");
    process.exit(1);
}

app.set("trust proxy", 1);

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
        secret: SESSION_SECRET,

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


/* ==================================================
   STATIC FRONTEND
================================================== */

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


/* ==================================================
   HEALTH
================================================== */

app.get(
    "/api/test",
    (req, res) => {

        res.json({
            success: true,
            message:
                "ShrekBook server is alive 🧌"
        });

    }
);


app.get(
    "/api/health",
    (req, res) => {

        res.json({
            ok: true,
            loggedIn:
                !!req.session.user
        });

    }
);


/* ==================================================
   ROUTES
================================================== */

const authRouter =
    require("./routes/auth");

const profilesRouter =
    require("./routes/profiles");


app.use(
    "/api",
    authRouter
);

app.use(
    "/api",
    profilesRouter
);


/*
 * Optional routes.
 *
 * These will only load if the files exist.
 */

try {
    app.use(
        "/api",
        require("./routes/posts")
    );
} catch (error) {
    console.log(
        "⚠️ posts.js not loaded:",
        error.message
    );
}


try {
    app.use(
        "/api",
        require("./routes/reactions")
    );
} catch (error) {
    console.log(
        "⚠️ reactions.js not loaded:",
        error.message
    );
}


try {
    app.use(
        "/api",
        require("./routes/chat")
    );
} catch (error) {
    console.log(
        "⚠️ chat.js not loaded:",
        error.message
    );
}


/* ==================================================
   API 404
================================================== */

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({
            error:
                "API route not found."
        });

    }
);


/* ==================================================
   FRONTEND FALLBACK
================================================== */

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


/* ==================================================
   ERROR HANDLER
================================================== */

app.use(
    (error, req, res, next) => {

        console.error(
            "❌ SERVER ERROR:",
            error
        );

        if (
            res.headersSent
        ) {
            return next(error);
        }

        res.status(500).json({
            error:
                error.message ||
                "Internal server error."
        });

    }
);


/* ==================================================
   START
================================================== */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🧌 ShrekBook running on port ${PORT}`
        );

    }
);