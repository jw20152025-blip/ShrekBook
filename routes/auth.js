
const express = require("express");

const router = express.Router();


// ==================================================
// SUPABASE
// ==================================================

function db(req) {
    return req.app.locals.supabase;
}


// ==================================================
// LOGIN
// ==================================================

router.post(
    "/login",
    async (req, res) => {

        try {

            const email =
                String(
                    req.body.email || ""
                )
                .trim()
                .toLowerCase();

            const password =
                String(
                    req.body.password || ""
                );


            if (!email || !password) {

                return res.status(400).json({
                    error:
                        "Email and password are required."
                });

            }


            // ------------------------------------------
            // SUPABASE LOGIN
            // ------------------------------------------

            const {
                data,
                error
            } = await db(req)
                .auth
                .signInWithPassword({
                    email,
                    password
                });


            if (error) {

                console.error(
                    "LOGIN SUPABASE ERROR:",
                    error
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


            // ------------------------------------------
            // SAVE USER IN EXPRESS SESSION
            // ------------------------------------------

            req.session.user = {

                id:
                    data.user.id,

                email:
                    data.user.email || email

            };


            // ------------------------------------------
            // FORCE SESSION SAVE
            // ------------------------------------------
            //
            // This is important on Render.
            // It makes sure the session cookie is
            // established before the response finishes.
            //

            req.session.save(
                (saveError) => {

                    if (saveError) {

                        console.error(
                            "SESSION SAVE ERROR:",
                            saveError
                        );

                        return res.status(500).json({
                            error:
                                "Could not create login session."
                        });

                    }


                    console.log(
                        "LOGIN SESSION CREATED:",
                        req.session.user
                    );


                    return res.json({

                        success:
                            true,

                        user: {

                            id:
                                data.user.id,

                            email:
                                data.user.email ||
                                email

                        }

                    });

                }
            );

        } catch (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);


// ==================================================
// SIGNUP
// ==================================================

router.post(
    "/signup",
    async (req, res) => {

        try {

            const username =
                String(
                    req.body.username || ""
                )
                .trim();

            const displayName =
                String(
                    req.body.display_name || ""
                )
                .trim();

            const email =
                String(
                    req.body.email || ""
                )
                .trim()
                .toLowerCase();

            const password =
                String(
                    req.body.password || ""
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


            if (password.length < 6) {

                return res.status(400).json({
                    error:
                        "Password must be at least 6 characters."
                });

            }


            // ------------------------------------------
            // CREATE AUTH USER
            // ------------------------------------------

            const {
                data: authData,
                error: authError
            } = await db(req)
                .auth
                .admin
                .createUser({

                    email,

                    password,

                    email_confirm:
                        true

                });


            if (authError) {

                console.error(
                    "SIGNUP AUTH ERROR:",
                    authError
                );

                return res.status(400).json({
                    error:
                        authError.message
                });

            }


            if (
                !authData ||
                !authData.user
            ) {

                return res.status(500).json({
                    error:
                        "Could not create account."
                });

            }


            // ------------------------------------------
            // CREATE PROFILE
            // ------------------------------------------

            const {
                error: profileError
            } = await db(req)
                .from("profiles")
                .insert({

                    id:
                        authData.user.id,

                    username:
                        username,

                    display_name:
                        displayName ||
                        username

                });


            if (profileError) {

                console.error(
                    "SIGNUP PROFILE ERROR:",
                    profileError
                );


                // Try to clean up the Auth user
                // if profile creation failed.

                try {

                    await db(req)
                        .auth
                        .admin
                        .deleteUser(
                            authData.user.id
                        );

                } catch (cleanupError) {

                    console.error(
                        "SIGNUP CLEANUP ERROR:",
                        cleanupError
                    );

                }


                return res.status(400).json({
                    error:
                        profileError.message
                });

            }


            return res.status(201).json({

                success:
                    true,

                user: {

                    id:
                        authData.user.id,

                    email:
                        authData.user.email

                }

            });

        } catch (error) {

            console.error(
                "SIGNUP ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);


// ==================================================
// CURRENT USER
// ==================================================

router.get(
    "/me",
    async (req, res) => {

        try {

            if (
                !req.session ||
                !req.session.user
            ) {

                return res.json({

                    loggedIn:
                        false,

                    user:
                        null

                });

            }


            const userId =
                req.session.user.id;


            // ------------------------------------------
            // GET PROFILE
            // ------------------------------------------

            const {
                data: profile,
                error
            } = await db(req)
                .from("profiles")
                .select(`
                    id,
                    username,
                    display_name
                `)
                .eq(
                    "id",
                    userId
                )
                .maybeSingle();


            if (error) {

                console.error(
                    "GET CURRENT PROFILE ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            return res.json({

                loggedIn:
                    true,

                user: {

                    id:
                        userId,

                    email:
                        req.session.user.email,

                    username:
                        profile?.username ||
                        null,

                    display_name:
                        profile?.display_name ||
                        null

                }

            });

        } catch (error) {

            console.error(
                "ME ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);


// ==================================================
// LOGOUT
// ==================================================

router.post(
    "/logout",
    async (req, res) => {

        try {

            req.session.destroy(
                (error) => {

                    if (error) {

                        console.error(
                            "LOGOUT SESSION ERROR:",
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


                    return res.json({

                        success:
                            true

                    });

                }
            );

        } catch (error) {

            console.error(
                "LOGOUT ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);


module.exports = router;

