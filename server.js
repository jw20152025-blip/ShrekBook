
"use strict";


/* =========================================================
   SHREKBOOK SERVER
========================================================= */

const express =
    require("express");

const session =
    require("express-session");

const path =
    require("path");


/* =========================================================
   APP
========================================================= */

const app =
    express();


/* =========================================================
   ENVIRONMENT
========================================================= */

const PORT =
    process.env.PORT ||
    3000;


const SESSION_SECRET =
    process.env.SESSION_SECRET ||
    "shrekbook-development-secret";


/* =========================================================
   SUPABASE
========================================================= */

const supabase =
    require("./utils/supabase.js");


console.log(
    "SUPABASE URL:",
    !!process.env.SUPABASE_URL
);


console.log(
    "SUPABASE KEY:",
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
);


/* =========================================================
   TRUST PROXY
========================================================= */

/*
 * Render sits behind a proxy.
 *
 * This allows secure cookies to work correctly
 * when deployed on Render.
 */

if (
    process.env.NODE_ENV ===
    "production"
) {

    app.set(
        "trust proxy",
        1
    );

}


/* =========================================================
   BODY PARSING
========================================================= */

/*
 * IMPORTANT:
 *
 * These MUST come before the API routes.
 *
 * Without express.json(), req.body can be undefined.
 */

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

        console.log(
            `${new Date().toISOString()} ${req.method} ${req.originalUrl}`
        );

        next();

    }
);


/* =========================================================
   SESSION
========================================================= */

app.use(
    session({

        name:
            "shrekbook.sid",

        secret:
            SESSION_SECRET,

        resave:
            false,

        saveUninitialized:
            false,

        rolling:
            true,

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
   SESSION DEBUGGER
========================================================= */

app.use(
    (req, res, next) => {

        if (
            req.path.startsWith(
                "/api"
            )
        ) {

            console.log(
                "SESSION:",
                req.session?.user ||
                "NOT LOGGED IN"
            );

        }

        next();

    }
);


/* =========================================================
   API ROUTES
========================================================= */


/*
 * AUTH
 *
 * Provides:
 *
 * POST /api/login
 * GET  /api/session
 * POST /api/logout
 */

const authRoutes =
    require("./routes/auth.js");


app.use(
    "/api",
    authRoutes
);


/*
 * PROFILES / USERS
 *
 * Provides things such as:
 *
 * GET /api/users
 * GET /api/users/:id
 */

try {

    const profileRoutes =
        require("./routes/profiles.js");


    app.use(
        "/api",
        profileRoutes
    );


} catch (error) {

    console.warn(
        "⚠️ profiles.js could not be loaded:",
        error.message
    );

}


/* =========================================================
   CURRENT USER
========================================================= */

app.get(
    "/api/me",
    (req, res) => {

        console.log(
            "👤 /api/me:",
            req.session?.user
        );


        if (
            !req.session ||
            !req.session.user
        ) {

            return res.json({

                loggedIn:
                    false,

                authenticated:
                    false,

                user:
                    null

            });

        }


        return res.json({

            loggedIn:
                true,

            authenticated:
                true,

            user:
                req.session.user

        });

    }
);


/* =========================================================
   API HEALTH CHECK
========================================================= */

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success:
                true,

            message:
                "ShrekBook API is alive 🧌",

            loggedIn:
                !!req.session?.user

        });

    }
);


/* =========================================================
   USERS FALLBACK
========================================================= */

/*
 * This fallback exists in case profiles.js isn't
 * providing /api/users.
 *
 * If profiles.js already provides this route,
 * this one will NOT be reached.
 */

app.get(
    "/api/users",
    async (req, res) => {

        console.log(
            "🔥 FALLBACK /api/users"
        );


        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("profiles")
                    .select("*");


            if (error) {

                console.error(
                    "❌ USERS SUPABASE ERROR:",
                    error
                );


                return res.status(500).json({

                    success:
                        false,

                    error:
                        error.message

                });

            }


            return res.json({

                success:
                    true,

                users:
                    data || []

            });

        } catch (error) {

            console.error(
                "❌ USERS CRASH:",
                error
            );


            return res.status(500).json({

                success:
                    false,

                error:
                    error.message ||
                    "Could not load users."

            });

        }

    }
);


/* =========================================================
   STATIC FILES
========================================================= */

const publicPath =
    path.join(
        __dirname,
        "public"
    );


app.use(
    express.static(
        publicPath,
        {

            extensions:
                [
                    "html"
                ],

            index:
                "index.html"

        }
    )
);


/* =========================================================
   EXPLICIT HOME PAGE
========================================================= */

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                publicPath,
                "index.html"
            )
        );

    }
);


/* =========================================================
   LOGIN PAGE
========================================================= */

app.get(
    "/login",
    (req, res) => {

        res.sendFile(
            path.join(
                publicPath,
                "login.html"
            )
        );

    }
);


/* =========================================================
   SIGNUP PAGE
========================================================= */

app.get(
    "/signup",
    (req, res) => {

        res.sendFile(
            path.join(
                publicPath,
                "signup.html"
            )
        );

    }
);


/* =========================================================
   PROFILE PAGE
========================================================= */

app.get(
    "/profile",
    (req, res) => {

        res.sendFile(
            path.join(
                publicPath,
                "profile.html"
            )
        );

    }
);


/* =========================================================
   404 API HANDLER
========================================================= */

app.use(
    "/api",
    (req, res) => {

        console.warn(
            "❌ API ROUTE NOT FOUND:",
            req.method,
            req.originalUrl
        );


        return res.status(404).json({

            success:
                false,

            error:
                "API endpoint not found.",

            path:
                req.originalUrl

        });

    }
);


/* =========================================================
   GENERAL 404
========================================================= */

app.use(
    (req, res) => {

        /*
         * If this was an API request, return JSON.
         */

        if (
            req.originalUrl.startsWith(
                "/api/"
            )
        ) {

            return res.status(404).json({

                success:
                    false,

                error:
                    "Not found."

            });

        }


        /*
         * Otherwise send the home page.
         *
         * This prevents random frontend routes
         * from displaying a blank Express error.
         */

        return res.sendFile(
            path.join(
                publicPath,
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
            "🔥 GLOBAL SERVER ERROR:",
            error
        );


        if (
            res.headersSent
        ) {

            return next(
                error
            );

        }


        if (
            req.originalUrl.startsWith(
                "/api/"
            )
        ) {

            return res.status(500).json({

                success:
                    false,

                error:
                    error.message ||
                    "Internal server error."

            });

        }


        return res.status(500).send(
            "ShrekBook server error."
        );

    }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "========================================"
        );

        console.log(
            "🧌 SHREKBOOK SERVER STARTED"
        );

        console.log(
            `🌐 PORT: ${PORT}`
        );

        console.log(
            `📁 PUBLIC: ${publicPath}`
        );

        console.log(
            `🔐 SESSION: enabled`
        );

        console.log(
            `🗄️ SUPABASE: ${
                supabase
                    ? "connected"
                    : "missing"
            }`
        );

        console.log(
            "========================================"
        );

    }
);

