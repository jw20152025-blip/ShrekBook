// ==================================================
// SHREKBOOK USER / PROFILE ROUTES
// ==================================================

const express = require("express");

const router = express.Router();


// ==================================================
// GET ALL USERS
// ==================================================

router.get(
    "/",
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await req.supabase
                .from("profiles")
                .select(`
                    id,
                    username,
                    display_name,
                    avatar_url
                `)
                .order(
                    "username",
                    {
                        ascending: true
                    }
                );

            if (error) {

                console.error(
                    "GET USERS ERROR:",
                    error
                );

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
                "USERS ERROR:",
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
// GET USER BY ID
// ==================================================

router.get(
    "/:id",
    async (req, res) => {

        try {

            const userId =
                req.params.id;


            const {
                data: profile,
                error: profileError
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


            if (profileError) {

                console.error(
                    "GET PROFILE ERROR:",
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
                        "User not found."
                });

            }


            // Get the user's posts.
            const {
                data: posts,
                error: postsError
            } = await req.supabase
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

                console.error(
                    "GET USER POSTS ERROR:",
                    postsError
                );

                return res.status(500).json({
                    error:
                        postsError.message
                });

            }


            res.json({

                user:
                    profile,

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
// GET CURRENT PROFILE
// ==================================================

router.get(
    "/me/profile",
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


            const {
                data,
                error
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
                    req.session.user.id
                )
                .maybeSingle();


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            if (!data) {

                return res.status(404).json({
                    error:
                        "Profile not found."
                });

            }


            res.json({
                profile:
                    data
            });

        } catch (error) {

            console.error(
                "GET MY PROFILE ERROR:",
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
    "/me/profile",
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


            const displayName =
                String(
                    req.body.display_name || ""
                ).trim();

            const username =
                String(
                    req.body.username || ""
                ).trim();

            const bio =
                String(
                    req.body.bio || ""
                ).trim();


            if (
                username &&
                username.length > 30
            ) {

                return res.status(400).json({
                    error:
                        "Username is too long."
                });

            }


            if (
                displayName &&
                displayName.length > 50
            ) {

                return res.status(400).json({
                    error:
                        "Display name is too long."
                });

            }


            if (
                bio.length > 500
            ) {

                return res.status(400).json({
                    error:
                        "Bio is too long."
                });

            }


            const updates = {
                display_name:
                    displayName || null,

                username:
                    username || null,

                bio:
                    bio || null
            };


            const {
                data,
                error
            } = await req.supabase
                .from("profiles")
                .update(updates)
                .eq(
                    "id",
                    req.session.user.id
                )
                .select(`
                    id,
                    username,
                    display_name,
                    avatar_url,
                    bio
                `)
                .single();


            if (error) {

                console.error(
                    "UPDATE PROFILE ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.json({

                success:
                    true,

                profile:
                    data

            });

        } catch (error) {

            console.error(
                "PROFILE UPDATE ERROR:",
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