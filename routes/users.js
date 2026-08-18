const express = require("express");

const router = express.Router();

function db(req) {
    return req.app.locals.supabase;
}

// ==================================================
// GET USERS
// ==================================================

router.get(
    "/users",
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await db(req)
                .from("profiles")
                .select(`
                    id,
                    username,
                    display_name,
                    avatar,
                    bio
                `)
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

            res.json({
                users:
                    data || []
            });

        } catch (error) {

            console.error(
                "GET USERS ERROR:",
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
// GET USER
// ==================================================

router.get(
    "/users/:id",
    async (req, res) => {

        try {

            const userId =
                req.params.id;

            const {
                data: profile,
                error: profileError
            } = await db(req)
                .from("profiles")
                .select(`
                    id,
                    username,
                    display_name,
                    avatar,
                    bio
                `)
                .eq(
                    "id",
                    userId
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
                        "User not found."
                });

            }

            const {
                data: posts,
                error: postsError
            } = await db(req)
                .from("posts")
                .select(`
                    id,
                    user_id,
                    content,
                    image_url,
                    created_at
                `)
                .eq(
                    "user_id",
                    userId
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );

            if (postsError) {

                return res.status(500).json({
                    error:
                        postsError.message
                });

            }

            res.json({
                user: profile,
                posts:
                    posts || []
            });

        } catch (error) {

            console.error(
                "GET USER ERROR:",
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
// UPDATE PROFILE
// ==================================================

router.put(
    "/profile",
    async (req, res) => {

        try {

            if (
                !req.session ||
                !req.session.user
            ) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }

            const username =
                req.body.username !== undefined
                    ? String(
                        req.body.username
                    ).trim()
                    : undefined;

            const displayName =
                req.body.display_name !== undefined
                    ? String(
                        req.body.display_name
                    ).trim()
                    : undefined;

            const bio =
                req.body.bio !== undefined
                    ? String(
                        req.body.bio
                    ).trim()
                    : undefined;

            const updates = {};

            if (
                username !== undefined
            ) {
                updates.username =
                    username;
            }

            if (
                displayName !== undefined
            ) {
                updates.display_name =
                    displayName;
            }

            if (
                bio !== undefined
            ) {
                updates.bio =
                    bio;
            }

            const {
                data,
                error
            } = await db(req)
                .from("profiles")
                .update(updates)
                .eq(
                    "id",
                    req.session.user.id
                )
                .select()
                .single();

            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }

            res.json({
                success: true,
                user: data
            });

        } catch (error) {

            console.error(
                "UPDATE PROFILE ERROR:",
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