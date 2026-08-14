
"use strict";

/* =========================================================
   SHREKBOOK SERVER
========================================================= */

const express = require("express");
const session = require("express-session");
const path = require("path");


/* =========================================================
   APP
========================================================= */

const app = express();


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


/* =========================================================
   AUTH
========================================================= */

const authRoutes =
    require("./routes/auth.js");


app.use(
    "/api",
    authRoutes
);


/* =========================================================
   PROFILE / USER ROUTES
========================================================= */

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
   POSTS API
========================================================= */

/*
 * GET /api/posts
 *
 * Loads all posts.
 *
 * Expected table:
 *
 * posts
 *
 * id
 * user_id
 * content
 * image_url
 * created_at
 */

app.get(
    "/api/posts",
    async (req, res) => {

        console.log(
            "📝 GET /api/posts"
        );


        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("posts")
                    .select(`
                        *,
                        profiles:user_id (
                            id,
                            username,
                            display_name
                        )
                    `)
                    .order(
                        "created_at",
                        {
                            ascending:
                                false
                        }
                    );


            if (error) {

                console.error(
                    "❌ POSTS SUPABASE ERROR:",
                    error
                );


                return res.status(
                    500
                ).json({

                    success:
                        false,

                    error:
                        error.message,

                    details:
                        error.details ||
                        null

                });

            }


            return res.json({

                success:
                    true,

                posts:
                    data || []

            });


        } catch (error) {

            console.error(
                "🔥 POSTS CRASH:",
                error
            );


            return res.status(
                500
            ).json({

                success:
                    false,

                error:
                    error.message ||
                    "Could not load posts."

            });

        }

    }
);


/* =========================================================
   CREATE POST
========================================================= */

/*
 * POST /api/posts
 *
 * Login required.
 *
 * Body:
 *
 * {
 *     "content": "...",
 *     "image_url": "..."
 * }
 */

app.post(
    "/api/posts",
    async (req, res) => {

        console.log(
            "📝 POST /api/posts"
        );


        /* -------------------------
           LOGIN CHECK
        ------------------------- */

        if (
            !req.session ||
            !req.session.user
        ) {

            return res.status(
                401
            ).json({

                success:
                    false,

                error:
                    "You must be logged in to post."

            });

        }


        const user =
            req.session.user;


        /* -------------------------
           BODY
        ------------------------- */

        const content =
            typeof req.body?.content ===
            "string"
                ? req.body.content.trim()
                : "";


        const imageUrl =
            typeof req.body?.image_url ===
            "string"
                ? req.body.image_url.trim()
                : "";


        /* -------------------------
           VALIDATION
        ------------------------- */

        if (
            !content &&
            !imageUrl
        ) {

            return res.status(
                400
            ).json({

                success:
                    false,

                error:
                    "Post cannot be empty."

            });

        }


        if (
            content.length >
            10000
        ) {

            return res.status(
                400
            ).json({

                success:
                    false,

                error:
                    "Post is too long."

            });

        }


        /* -------------------------
           INSERT
        ------------------------- */

        try {

            const insertData = {

                user_id:
                    user.id,

                content:
                    content || null

            };


            /*
             * Only include image_url
             * if one was supplied.
             *
             * This makes the endpoint
             * work even if you're currently
             * only posting text.
             */

            if (imageUrl) {

                insertData.image_url =
                    imageUrl;

            }


            const {
                data,
                error
            } =
                await supabase
                    .from("posts")
                    .insert(
                        insertData
                    )
                    .select(`
                        *,
                        profiles:user_id (
                            id,
                            username,
                            display_name
                        )
                    `)
                    .single();


            if (error) {

                console.error(
                    "❌ CREATE POST SUPABASE ERROR:",
                    error
                );


                return res.status(
                    500
                ).json({

                    success:
                        false,

                    error:
                        error.message,

                    details:
                        error.details ||
                        null

                });

            }


            console.log(
                "✅ POST CREATED:",
                data
            );


            return res.status(
                201
            ).json({

                success:
                    true,

                post:
                    data

            });


        } catch (error) {

            console.error(
                "🔥 CREATE POST CRASH:",
                error
            );


            return res.status(
                500
            ).json({

                success:
                    false,

                error:
                    error.message ||
                    "Could not create post."

            });

        }

    }
);


/* =========================================================
   CHAT API
========================================================= */


/* =========================================================
   GET CHAT ROOMS
========================================================= */

app.get(
    "/api/chat/rooms",
    async (req, res) => {

        console.log(
            "💬 GET /api/chat/rooms"
        );


        if (
            !req.session ||
            !req.session.user
        ) {

            return res.status(
                401
            ).json({

                success:
                    false,

                error:
                    "You must be logged in."

            });

        }


        const userId =
            req.session.user.id;


        try {

            /*
             * First find the rooms this user
             * belongs to.
             */

            const {
                data: memberships,
                error:
                    membershipError
            } =
                await supabase
                    .from("chat_members")
                    .select(
                        "room_id"
                    )
                    .eq(
                        "user_id",
                        userId
                    );


            if (
                membershipError
            ) {

                console.error(
                    "❌ CHAT MEMBERS ERROR:",
                    membershipError
                );


                return res.status(
                    500
                ).json({

                    success:
                        false,

                    error:
                        membershipError.message

                });

            }


            const roomIds =
                (memberships || [])
                    .map(
                        member =>
                            member.room_id
                    )
                    .filter(
                        Boolean
                    );


            if (
                roomIds.length ===
                0
            ) {

                return res.json({

                    success:
                        true,

                    rooms:
                        []

                });

            }


            const {
                data: rooms,
                error:
                    roomError
            } =
                await supabase
                    .from("chat_rooms")
                    .select("*")
                    .in(
                        "id",
                        roomIds
                    );


            if (
                roomError
            ) {

                console.error(
                    "❌ CHAT ROOMS ERROR:",
                    roomError
                );


                return res.status(
                    500
                ).json({

                    success:
                        false,

                    error:
                        roomError.message

                });

            }


            return res.json({

                success:
                    true,

                rooms:
                    rooms || []

            });


        } catch (error) {

            console.error(
                "🔥 CHAT ROOMS CRASH:",
                error
            );


            return res.status(
                500
            ).json({

                success:
                    false,

                error:
                    error.message ||
                    "Could not load chat rooms."

            });

        }

    }
);


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
   API HEALTH
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


                return res.status(
                    500
                ).json({

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


            return res.status(
                500
            ).json({

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
   HOME
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
   LOGIN
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
   SIGNUP
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
   PROFILE
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
   CHAT PAGE
========================================================= */

/*
 * If chat.html exists in public/,
 * this lets /chat and /shrekchat
 * open it.
 */

app.get(
    "/chat",
    (req, res) => {

        res.sendFile(
            path.join(
                publicPath,
                "chat.html"
            )
        );

    }
);


app.get(
    "/shrekchat",
    (req, res) => {

        res.sendFile(
            path.join(
                publicPath,
                "chat.html"
            )
        );

    }
);


/* =========================================================
   API 404
========================================================= */

app.use(
    "/api",
    (req, res) => {

        console.warn(
            "❌ API ROUTE NOT FOUND:",
            req.method,
            req.originalUrl
        );


        return res.status(
            404
        ).json({

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

        if (
            req.originalUrl.startsWith(
                "/api/"
            )
        ) {

            return res.status(
                404
            ).json({

                success:
                    false,

                error:
                    "Not found."

            });

        }


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

            return res.status(
                500
            ).json({

                success:
                    false,

                error:
                    error.message ||
                    "Internal server error."

            });

        }


        return res.status(
            500
        ).send(
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
            "🔐 SESSION: enabled"
        );

        console.log(
            `🗄️ SUPABASE: ${
                supabase
                    ? "connected"
                    : "missing"
            }`
        );

        console.log(
            "📝 POSTS API: enabled"
        );

        console.log(
            "💬 CHAT API: enabled"
        );

        console.log(
            "========================================"
        );

    }
);

