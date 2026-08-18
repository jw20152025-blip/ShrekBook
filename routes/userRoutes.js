// ==================================================
// SHREKBOOK USER / PROFILE ROUTES
// ==================================================

const express = require("express");

const router = express.Router();


// ==================================================
// HELPERS
// ==================================================

function getSupabase(req) {
    return req.app.locals.supabase;
}

function requireLogin(req, res, next) {

    if (
        !req.session ||
        !req.session.user
    ) {

        return res.status(401).json({
            error: "You must be logged in."
        });

    }

    next();
}


// ==================================================
// GET ALL USERS
// ==================================================

router.get(
    "/users",
    async (req, res) => {

        try {

            const supabase =
                getSupabase(req);

            const {
                data: users,
                error
            } = await supabase
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
                    users || []
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
// GET USER PROFILE
// ==================================================

router.get(
    "/users/:id",
    async (req, res) => {

        try {

            const supabase =
                getSupabase(req);

            const userId =
                req.params.id;

            if (!userId) {

                return res.status(400).json({
                    error:
                        "User ID is required."
                });

            }


            // ------------------------------------------
            // PROFILE
            // ------------------------------------------

            const {
                data: profile,
                error: profileError
            } =
                await supabase
                    .from("profiles")
                    .select(`
                        id,
                        username,
                        display_name,
                        avatar_url,
                        bio,
                        created_at
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


            // ------------------------------------------
            // POSTS
            // ------------------------------------------

            const {
                data: posts,
                error: postsError
            } =
                await supabase
                    .from("posts")
                    .select("*")
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

            }


            res.json({

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
// UPDATE OWN PROFILE
// ==================================================

router.put(
    "/profile",
    requireLogin,
    async (req, res) => {

        try {

            const supabase =
                getSupabase(req);

            const userId =
                req.session.user.id;


            const updates = {};


            if (
                req.body.username !==
                undefined
            ) {

                updates.username =
                    String(
                        req.body.username
                    )
                    .trim();

            }


            if (
                req.body.display_name !==
                undefined
            ) {

                updates.display_name =
                    String(
                        req.body.display_name
                    )
                    .trim();

            }


            if (
                req.body.bio !==
                undefined
            ) {

                updates.bio =
                    String(
                        req.body.bio
                    )
                    .trim();

            }


            if (
                Object.keys(updates).length ===
                0
            ) {

                return res.status(400).json({
                    error:
                        "No profile changes provided."
                });

            }


            const {
                data: profile,
                error
            } =
                await supabase
                    .from("profiles")
                    .update(updates)
                    .eq(
                        "id",
                        userId
                    )
                    .select()
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

                profile

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


// ==================================================
// UPLOAD AVATAR
// ==================================================

router.post(
    "/profile/avatar",
    requireLogin,
    async (req, res) => {

        /*
         * This endpoint is intentionally left as a
         * simple URL updater for now.
         *
         * Your existing image-upload helper can be
         * wired here once we move that helper into its
         * own utility file.
         */

        try {

            const supabase =
                getSupabase(req);

            const userId =
                req.session.user.id;

            const avatarUrl =
                String(
                    req.body.avatar_url ||
                    ""
                )
                .trim();


            if (!avatarUrl) {

                return res.status(400).json({
                    error:
                        "Avatar URL is required."
                });

            }


            const {
                data: profile,
                error
            } =
                await supabase
                    .from("profiles")
                    .update({

                        avatar_url:
                            avatarUrl

                    })
                    .eq(
                        "id",
                        userId
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

                success:
                    true,

                profile

            });

        } catch (error) {

            console.error(
                "AVATAR ERROR:",
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