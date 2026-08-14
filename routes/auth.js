const express = require("express");

const router = express.Router();

const supabase =
    require("../utils/supabase.js");

const {
    createClient
} = require("@supabase/supabase-js");


/* ==================================================
   NORMAL SUPABASE AUTH CLIENT
================================================== */

const authClient =
    createClient(

        process.env.SUPABASE_URL,

        process.env.SUPABASE_ANON_KEY,

        {
            auth: {

                autoRefreshToken:
                    false,

                persistSession:
                    false

            }
        }

    );


/* ==================================================
   SIGNUP
================================================== */

router.post(
    "/signup",
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
                String(
                    req.body.email ||
                    ""
                ).trim();


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


            const {
                data: existing,
                error: usernameError
            } =
                await supabase
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
                await supabase
                    .auth
                    .admin
                    .createUser({

                        email:
                            email,

                        password:
                            password,

                        email_confirm:
                            true

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
            } =
                await supabase
                    .from("profiles")
                    .insert({

                        id:
                            userId,

                        username:
                            username,

                        display_name:
                            display_name ||
                            username,

                        avatar:
                            null,

                        bio:
                            ""

                    })
                    .select()
                    .single();


            if (profileError) {

                await supabase
                    .auth
                    .admin
                    .deleteUser(
                        userId
                    );

                return res.status(500).json({

                    error:
                        profileError.message

                });

            }


            return res.status(201).json({

                success:
                    true,

                user:
                    profile

            });

        } catch (error) {

            console.error(
                "❌ SIGNUP ERROR:",
                error
            );

            return res.status(500).json({

                error:
                    error.message ||
                    "Server error."

            });

        }

    }
);


/* ==================================================
   LOGIN
================================================== */

router.post(
    "/login",
    async (req, res) => {

        try {

            const email =
                String(
                    req.body.email ||
                    ""
                ).trim();


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


            const {
                data: authData,
                error: authError
            } =
                await authClient
                    .auth
                    .signInWithPassword({

                        email:
                            email,

                        password:
                            password

                    });


            if (authError) {

                return res.status(401).json({

                    error:
                        authError.message

                });

            }


            const authUser =
                authData.user;


            const {
                data: profile,
                error: profileError
            } =
                await supabase
                    .from("profiles")
                    .select("*")
                    .eq(
                        "id",
                        authUser.id
                    )
                    .maybeSingle();


            if (profileError) {

                return res.status(500).json({

                    error:
                        profileError.message

                });

            }


            if (!profile) {

                return res.status(404).json({

                    error:
                        "Your account exists, but your profile does not."

                });

            }


            req.session.user = {

                id:
                    profile.id,

                username:
                    profile.username,

                display_name:
                    profile.display_name

            };


            req.session.save(
                error => {

                    if (error) {

                        console.error(
                            "SESSION ERROR:",
                            error
                        );

                        return res.status(500).json({

                            error:
                                "Could not save login session."

                        });

                    }


                    res.json({

                        success:
                            true,

                        user:
                            profile

                    });

                }
            );

        } catch (error) {

            console.error(
                "❌ LOGIN ERROR:",
                error
            );

            return res.status(500).json({

                error:
                    error.message ||
                    "Server error."

            });

        }

    }
);


/* ==================================================
   LOGOUT
================================================== */

router.post(
    "/logout",
    (req, res) => {

        req.session.destroy(
            error => {

                if (error) {

                    return res.status(500).json({

                        error:
                            "Logout failed."

                    });

                }


                res.clearCookie(
                    "connect.sid"
                );


                res.json({

                    success:
                        true

                });

            }
        );

    }
);


/* ==================================================
   CURRENT USER
================================================== */

router.get(
    "/me",
    async (req, res) => {

        try {

            if (!req.session.user) {

                return res.json({

                    loggedIn:
                        false

                });

            }


            const {
                data,
                error
            } =
                await supabase
                    .from("profiles")
                    .select("*")
                    .eq(
                        "id",
                        req.session.user.id
                    )
                    .maybeSingle();


            if (
                error ||
                !data
            ) {

                return res.json({

                    loggedIn:
                        false

                });

            }


            res.json({

                loggedIn:
                    true,

                user:
                    data

            });

        } catch (error) {

            console.error(
                "❌ ME ERROR:",
                error
            );

            res.status(500).json({

                error:
                    error.message ||
                    "Server error."

            });

        }

    }
);


module.exports =
    router;