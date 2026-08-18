// ==================================================
// SHREKBOOK AUTH ROUTES
// ==================================================

const express = require("express");

const router = express.Router();


// ==================================================
// HELPERS
// ==================================================

function getSupabase(req) {

    return req.app.locals.supabase;

}


// ==================================================
// SIGNUP
// ==================================================

router.post(
    "/signup",
    async (req, res) => {

        try {

            const supabase =
                getSupabase(req);

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

            const username =
                String(
                    req.body.username || ""
                )
                .trim();

            const displayName =
                String(
                    req.body.display_name ||
                    req.body.displayName ||
                    username
                )
                .trim();


            if (
                !email ||
                !password ||
                !username
            ) {

                return res.status(400).json({
                    error:
                        "Email, password, and username are required."
                });

            }


            // ------------------------------------------
            // CREATE AUTH USER
            // ------------------------------------------

            const {
                data,
                error
            } =
                await supabase.auth.admin
                    .createUser({

                        email,

                        password,

                        email_confirm:
                            true

                    });


            if (error) {

                return res.status(400).json({
                    error:
                        error.message
                });

            }


            if (
                !data ||
                !data.user
            ) {

                return res.status(500).json({
                    error:
                        "Could not create account."
                });

            }


            const user =
                data.user;


            // ------------------------------------------
            // CREATE PROFILE
            // ------------------------------------------

            const {
                error: profileError
            } =
                await supabase
                    .from("profiles")
                    .insert({

                        id:
                            user.id,

                        username,

                        display_name:
                            displayName

                    });


            if (profileError) {

                console.error(
                    "PROFILE CREATE ERROR:",
                    profileError
                );

                // Remove auth user if profile failed
                await supabase.auth.admin
                    .deleteUser(
                        user.id
                    );

                return res.status(500).json({
                    error:
                        profileError.message
                });

            }


            res.status(201).json({

                success:
                    true,

                user: {

                    id:
                        user.id,

                    email:
                        user.email,

                    username

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

router.post(
    "/login",
    async (req, res) => {

        try {

            const supabase =
                getSupabase(req);

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
                !email ||
                !password
            ) {

                return res.status(400).json({
                    error:
                        "Email and password are required."
                });

            }


            // ------------------------------------------
            // CHECK ACTIVE BAN
            // ------------------------------------------

            const {
                data: bans,
                error: banError
            } =
                await supabase
                    .from("bans")
                    .select(`
                        id,
                        user_id,
                        email,
                        reason,
                        active,
                        banned_at
                    `)
                    .eq(
                        "email",
                        email
                    )
                    .eq(
                        "active",
                        true
                    )
                    .limit(1);


            if (banError) {

                console.error(
                    "BAN CHECK ERROR:",
                    banError
                );

            }


            if (
                bans &&
                bans.length > 0
            ) {

                return res.status(403).json({

                    error:
                        "This account is banned.",

                    banned:
                        true,

                    reason:
                        bans[0].reason ||
                        "No reason provided."

                });

            }


            // ------------------------------------------
            // SUPABASE LOGIN
            // ------------------------------------------

            const {
                data,
                error
            } =
                await supabase.auth
                    .signInWithPassword({

                        email,

                        password

                    });


            if (error) {

                return res.status(401).json({
                    error:
                        error.message
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
            // SESSION
            // ------------------------------------------

            req.session.user = {

                id:
                    data.user.id,

                email:
                    data.user.email

            };


            res.json({

                success:
                    true,

                user: {

                    id:
                        data.user.id,

                    email:
                        data.user.email

                }

            });

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

router.post(
    "/logout",
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


                res.json({
                    success:
                        true
                });

            }
        );

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

                return res.status(401).json({
                    error:
                        "Not logged in."
                });

            }


            const supabase =
                getSupabase(req);


            const {
                data: profile,
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


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.json({

                loggedIn:
                    true,

                user: {

                    id:
                        req.session.user.id,

                    email:
                        req.session.user.email,

                    ...(profile || {})

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
// EXPORT
// ==================================================

module.exports =
    router;