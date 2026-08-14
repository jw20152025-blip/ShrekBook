/* ==================================================
   SHREKBOOK SERVER
   BACKEND ONLY
================================================== */

require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");

const { createClient } =
    require(".utils/supabase.js");


/* ==================================================
   APP
================================================== */

const app = express();

const PORT =
    process.env.PORT || 3000;


/* ==================================================
   ENVIRONMENT
================================================== */

const SUPABASE_URL =
    process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

const SESSION_SECRET =
    process.env.SESSION_SECRET;


if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !SESSION_SECRET
) {

    console.error(
        "❌ Missing required environment variables."
    );

    process.exit(1);

}


/* ==================================================
   SUPABASE
================================================== */

const supabase =
    createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY
    );


/* ==================================================
   EXPRESS CONFIG
================================================== */

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
        extended: true
    })
);


/* ==================================================
   SESSION
================================================== */

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


/* ==================================================
   STATIC FILES
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
   HEALTH / TEST
================================================== */

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


/* ==================================================
   ROUTERS
================================================== */

/*
   IMPORTANT:

   These files contain the actual routes.

   server.js ONLY connects them.

   Example structure:

   routes/
       auth.js
       profiles.js
       posts.js
       reactions.js
       chat.js
*/


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


/* ==================================================
   API ROUTES
================================================== */

app.use(
    "/api",
    authRouter
);


app.use(
    "/api",
    profilesRouter
);


app.use(
    "/api",
    postsRouter
);


app.use(
    "/api",
    reactionsRouter
);


app.use(
    "/api",
    chatRouter
);


/* ==================================================
   404 API HANDLER
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

app.get("/{*splat}", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});


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

            return next(
                error
            );

        }

        res.status(
            500
        ).json({

            error:
                error.message ||
                "Internal server error."

        });

    }
);


/* ==================================================
   START SERVER
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