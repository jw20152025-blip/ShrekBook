const express = require("express");

const router = express.Router();

function getSupabase(req) {
    return req.app.locals.supabase;
}

function normalizeEmail(email) {
    return String(email || "")
        .trim()
        .toLowerCase();
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
                normalizeEmail(
                    req.body.email
                );

            const password =
                String(
                    req.body.password || ""
                );

            const username =
                String(
                    req.body.username || ""
                ).trim();

            const displayName =
                String(
                    req.body.display_name ||
                    req.body.displayName ||
                    username ||
                    ""
                ).trim();

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

            if (password.length < 6) {

                return res.status(400).json({
                    error:
                        "Password must be at least 6 characters."
                });

            }

            // Check email ban
            const {
                data: bans,
                error: banError
            } = await supabase
                .from("bans")
                .select(
                    "id,user_id,email,reason,active,banned_at"
                )
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
                        "This email is banned.",
                    banned:
                        true,
                    reason:
                        bans[0].reason ||
                        "No reason provided."
                });

            }

            // Create Auth user
            const {
                data,
                error
            } =
                await supabase.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true
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

            // Create profile
            const {
                error: profileError
            } =
                await supabase
                    .from("profiles")
                    .insert({
                        id: user.id,
                        username,
                        display_name:
                            displayName
                    });

            if (profileError) {

                console.error(
                    "PROFILE CREATE ERROR:",
                    profileError
                );

                try {

                    await supabase.auth.admin
                        .deleteUser(
                            user.id
                        );

                } catch (rollbackError) {

                    console.error(
                        "ROLLBACK ERROR:",
                        rollbackError
                    );

                }

                return res.status(500).json({
                    error:
                        profileError.message
                });

            }

            res.status(201).json({
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    username,
                    display_name:
                        displayName
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
                normalizeEmail(
                    req.body.email
                );

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

            // Email ban
            const {
                data: emailBans
            } = await supabase
                .from("bans")
                .select(
                    "id,user_id,email,reason,active"
                )
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
                emailBans &&
                emailBans.length > 0
            ) {

                return res.status(403).json({
                    error:
                        "This account is banned.",
                    banned: true,
                    reason:
                        emailBans[0].reason ||
                        "No reason provided."
                });

            }

            const {
                data,
                error
            } =
                await supabase.auth.signInWithPassword({
                    email,
                    password
                });

            if (error) {

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

            // User-ID ban
            const {
                data: userBans
            } = await supabase
                .from("bans")
                .select(
                    "id,user_id,email,reason,active"
                )
                .eq(
                    "user_id",
                    data.user.id
                )
                .eq(
                    "active",
                    true
                )
                .limit(1);

            if (
                userBans &&
                userBans.length > 0
            ) {

                return res.status(403).json({
                    error:
                        "This account is banned.",
                    banned: true,
                    reason:
                        userBans[0].reason ||
                        "No reason provided."
                });

            }

            req.session.user = {
                id:
                    data.user.id,
                email:
                    data.user.email
            };

            req.session.save(
                error => {

                    if (error) {

                        console.error(
                            "SESSION SAVE ERROR:",
                            error
                        );

                        return res.status(500).json({
                            error:
                                "Could not create login session."
                        });

                    }

                    res.json({
                        success: true,
                        user:
                            req.session.user
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

router.post(
    "/logout",
    (req, res) => {

        req.session.destroy(
            error => {

                if (error) {

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
                    loggedIn: false,
                    user: null
                });

            }

            const supabase =
                getSupabase(req);

            const userId =
                req.session.user.id;

            const {
                data: profile,
                error
            } =
                await supabase
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

            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }

            res.json({
                loggedIn: true,
                user: {
                    id: userId,
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