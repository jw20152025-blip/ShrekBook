// ==================================================
// SHREKBOOK AUTH ROUTES
// ==================================================

const express = require("express");

const router = express.Router();


// ==================================================
// SIGN UP
// ==================================================

router.post(
    "/signup",
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

            const username =
                String(
                    req.body.username || ""
                )
                .trim();

            const displayName =
                String(
                    req.body.display_name ||
                    req.body.displayName ||
                    username ||
                    ""
                )
                .trim();


            if (
                !email ||
                !password
            ) {

                return res.status(400).json({
                    error:
                        "Email and password are required."
                });

            }


            if (password.length < 6) {

                return res.status(400).json({
                    error:
                        "Password must be at least 6 characters."
                });

            }


            // Check active email ban.

            const {
                data: bans,
                error: banError
            } = await req.supabase
                .from("bans")
                .select("id,email,active")
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
                    "SIGNUP BAN CHECK ERROR:",
                    banError
                );

            }


            if (
                bans &&
                bans.length > 0
            ) {

                return res.status(403).json({
                    error:
                        "This email is banned."
                });

            }


            const {
                data,
                error
            } = await req.supabase.auth.admin
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


            const user =
                data.user;


            if (!user) {

                return res.status(500).json({
                    error:
                        "Account could not be created."
                });

            }


            const {
                error: profileError
            } = await req.supabase
                .from("profiles")
                .insert({

                    id:
                        user.id,

                    username:
                        username || null,

                    display_name:
                        displayName || null

                });


            if (profileError) {

                console.error(
                    "PROFILE CREATE ERROR:",
                    profileError
                );

            }


            res.status(201).json({

                success:
                    true,

                user: {
                    id:
                        user.id,

                    email:
                        user.email
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


            // Check active ban.

            const {
                data: bans
            } = await req.supabase
                .from("bans")
                .select("id,email,active")
                .eq(
                    "email",
                    email
                )
                .eq(
                    "active",
                    true
                )
                .limit(1);


            if (
                bans &&
                bans.length > 0
            ) {

                return res.status(403).json({
                    error:
                        "This account is banned."
                });

            }


            const {
                data,
                error
            } = await req.supabase.auth
                .signInWithPassword({

                    email,

                    password

                });


            if (error) {

                return res.status(401).json({
                    error:
                        "Invalid email or password."
                });

            }


            req.session.user = {

                id:
                    data.user.id,

                email:
                    data.user.email

            };


            res.json({

                success:
                    true,

                user:
                    req.session.user

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

                return res.json({
                    loggedIn:
                        false,

                    user:
                        null
                });

            }


            const userId =
                req.session.user.id;


            const {
                data: profile
            } = await req.supabase
                .from("profiles")
                .select(`
                    id,
                    username,
                    display_name,
                    avatar_url,
                    bio
                `)
                .eq(
                    "id",
                    userId
                )
                .maybeSingle();


            res.json({

                loggedIn:
                    true,

                user: {

                    id:
                        userId,

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


module.exports = router;