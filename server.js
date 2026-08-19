


require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const PORT = process.env.PORT || 3000;


// ==================================================
// SUPABASE
// ==================================================

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);


// ==================================================
// EXPRESS
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
            "shrekbook-secret-change-this",

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
// STATIC FILES
// ==================================================

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ==================================================
// HELPERS
// ==================================================

function normalizeEmail(email) {

    return String(
        email || ""
    )
        .trim()
        .toLowerCase();

}


function getAvatar(avatar) {

    return (
        avatar ||
        "/default-avatar.png"
    );

}


function requireLogin(req, res, next) {

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
// TEST / HEALTH
// ==================================================

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
                !!(
                    req.session &&
                    req.session.user
                )

        });

    }
);


// ==================================================
// CURRENT USER
// ==================================================

app.get(
    "/api/me",
    async (req, res) => {

        try {

            if (
                !req.session ||
                !req.session.user
            ) {

                return res.json({

                    loggedIn: false,

                    user: null

                });

            }


            const userId =
                req.session.user.id;


            const {
                data: profile,
                error
            } = await supabase
                .from("profiles")
                .select("*")
                .eq(
                    "id",
                    userId
                )
                .maybeSingle();


            if (error) {

                console.error(
                    "ME ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            if (!profile) {

                req.session.destroy(
                    () => {}
                );

                return res.json({

                    loggedIn: false,

                    user: null

                });

            }


            res.json({

                loggedIn: true,

                user: {

                    ...profile,

                    avatar:
                        getAvatar(
                            profile.avatar
                        )

                }

            });

        } catch (error) {

            console.error(
                "ME ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);


// ==================================================
// SIGNUP
// ==================================================

app.post(
    "/api/signup",
    async (req, res) => {

        try {

            const username =
                String(
                    req.body.username ||
                    ""
                ).trim();


            const display_name =
                String(
                    req.body.display_name ||
                    username
                ).trim();


            const email =
                normalizeEmail(
                    req.body.email
                );


            const password =
                String(
                    req.body.password ||
                    ""
                );


            if (
                !username ||
                !email ||
                !password
            ) {

                return res.status(400).json({
                    error:
                        "Username, email, and password are required."
                });

            }


            if (username.length > 30) {

                return res.status(400).json({
                    error:
                        "Username is too long."
                });

            }


            if (password.length < 6) {

                return res.status(400).json({
                    error:
                        "Password must be at least 6 characters."
                });

            }


            const {
                data: existing,
                error: usernameError
            } = await supabase
                .from("profiles")
                .select("id")
                .eq(
                    "username",
                    username
                )
                .maybeSingle();


            if (usernameError) {

                return res.status(500).json({
                    error:
                        usernameError.message
                });

            }


            if (existing) {

                return res.status(400).json({
                    error:
                        "That username is already taken."
                });

            }


            const {
                data: authData,
                error: authError
            } =
                await supabase.auth.admin.createUser({

                    email,

                    password,

                    email_confirm: true

                });


            if (authError) {

                return res.status(400).json({
                    error:
                        authError.message
                });

            }


            const userId =
                authData.user.id;


            const {
                data: profile,
                error: profileError
            } = await supabase
                .from("profiles")
                .insert({

                    id:
                        userId,

                    username,

                    display_name:
                        display_name ||
                        username,

                    avatar:
                        null,

                    bio:
                        "",

                    last_seen:
                        new Date().toISOString()

                })
                .select()
                .single();


            if (profileError) {

                await supabase.auth.admin
                    .deleteUser(
                        userId
                    );

                return res.status(500).json({
                    error:
                        profileError.message
                });

            }


            res.status(201).json({

                success: true,

                user: {

                    ...profile,

                    avatar:
                        getAvatar(
                            profile.avatar
                        )

                }

            });

        } catch (error) {

            console.error(
                "SIGNUP ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);


// ==================================================
// LOGIN
// ==================================================

app.post(
    "/api/login",
    async (req, res) => {

        try {

            const email =
                normalizeEmail(
                    req.body.email
                );


            const password =
                String(
                    req.body.password ||
                    ""
                );


            if (
                !email ||
                !password
            ) {

                return res.status(400).json({
                    error:
                        "Email and password are required."
                });

            }


            console.log(
                "LOGIN ATTEMPT:",
                email
            );


            const {
                data,
                error
            } =
                await supabase.auth.signInWithPassword({

                    email,

                    password

                });


            if (error) {

                console.error(
                    "SUPABASE LOGIN ERROR:",
                    error.message
                );

                return res.status(401).json({
                    error:
                        "Invalid email or password."
                });

            }


            if (
                !data ||
                !data.user
            ) {

                return res.status(401).json({
                    error:
                        "Login failed."
                });

            }


            const userId =
                data.user.id;


            const {
                data: profile,
                error: profileError
            } = await supabase
                .from("profiles")
                .select("*")
                .eq(
                    "id",
                    userId
                )
                .maybeSingle();


            if (profileError) {

                console.error(
                    "PROFILE LOGIN ERROR:",
                    profileError
                );

                return res.status(500).json({
                    error:
                        profileError.message
                });

            }


            if (!profile) {

                return res.status(404).json({
                    error:
                        "Account profile not found."
                });

            }


            // ==========================================
            // IMPORTANT:
            // THIS IS THE LOGIN SESSION.
            // ==========================================

            req.session.user = {

                id:
                    profile.id,

                username:
                    profile.username,

                display_name:
                    profile.display_name,

                avatar:
                    getAvatar(
                        profile.avatar
                    )

            };


            // Make absolutely sure the session is saved
            // before sending the response.

            req.session.save(
                err => {

                    if (err) {

                        console.error(
                            "SESSION SAVE ERROR:",
                            err
                        );

                        return res.status(500).json({
                            error:
                                "Could not create login session."
                        });

                    }


                    console.log(
                        "LOGIN SUCCESS:",
                        profile.username
                    );


                    res.json({

                        success: true,

                        user: {

                            ...profile,

                            avatar:
                                getAvatar(
                                    profile.avatar
                                )

                        }

                    });

                }
            );

        } catch (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);


// ==================================================
// LOGOUT
// ==================================================

app.post(
    "/api/logout",
    (req, res) => {

        req.session.destroy(
            error => {

                if (error) {

                    console.error(
                        "LOGOUT ERROR:",
                        error
                    );

                    return res.status(500).json({
                        error:
                            "Could not log out."
                    });

                }


                res.clearCookie(
                    "connect.sid"
                );


                res.json({
                    success: true
                });

            }
        );

    }
);


// ==================================================
// USERS
// ==================================================

app.get(
    "/api/users",
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await supabase
                .from("profiles")
                .select("*")
                .order(
                    "username",
                    {
                        ascending: true
                    }
                );


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.json(
                (data || []).map(user => ({

                    ...user,

                    avatar:
                        getAvatar(
                            user.avatar
                        )

                }))
            );

        } catch (error) {

            res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);


// ==================================================
// SINGLE USER
// ==================================================

app.get(
    "/api/users/:id",
    async (req, res) => {

        try {

            const {
                data: user,
                error
            } = await supabase
                .from("profiles")
                .select("*")
                .eq(
                    "id",
                    req.params.id
                )
                .maybeSingle();


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            if (!user) {

                return res.status(404).json({
                    error:
                        "User not found."
                });

            }


            res.json({

                ...user,

                avatar:
                    getAvatar(
                        user.avatar
                    )

            });

        } catch (error) {

            res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);


// ==================================================
// CHAT AUTH CHECK
// ==================================================

app.get(
    "/api/chat/auth",
    requireLogin,
    (req, res) => {

        res.json({

            loggedIn: true,

            user:
                req.session.user

        });

    }
);


// ==================================================
// SERVE PAGES
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


app.get(
    "/shrekchat.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "shrekchat.html"
            )
        );

    }
);


app.get(
    "/admin.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "admin.html"
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

