// ==================================================
// SHREKBOOK POST ROUTES
// ==================================================

const express = require("express");

const router = express.Router();


// ==================================================
// GET POSTS
// ==================================================

router.get(
    "/",
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await req.supabase
                .from("posts")
                .select(`
                    id,
                    user_id,
                    content,
                    image_url,
                    created_at
                `)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.json({
                posts:
                    data || []
            });

        } catch (error) {

            console.error(
                "GET POSTS ERROR:",
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
// CREATE POST
// ==================================================

router.post(
    "/",
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


            const content =
                String(
                    req.body.content || ""
                ).trim();

            const imageUrl =
                String(
                    req.body.image_url || ""
                ).trim();


            if (
                !content &&
                !imageUrl
            ) {

                return res.status(400).json({
                    error:
                        "Post cannot be empty."
                });

            }


            if (
                content.length > 5000
            ) {

                return res.status(400).json({
                    error:
                        "Post is too long."
                });

            }


            const {
                data,
                error
            } = await req.supabase
                .from("posts")
                .insert({

                    user_id:
                        req.session.user.id,

                    content:
                        content || null,

                    image_url:
                        imageUrl || null

                })
                .select()
                .single();


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.status(201).json({

                success:
                    true,

                post:
                    data

            });

        } catch (error) {

            console.error(
                "CREATE POST ERROR:",
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
// GET COMMENTS
// ==================================================

router.get(
    "/:postId/comments",
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await req.supabase
                .from("comments")
                .select(`
                    id,
                    post_id,
                    user_id,
                    content,
                    created_at
                `)
                .eq(
                    "post_id",
                    req.params.postId
                )
                .order(
                    "created_at",
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
                comments:
                    data || []
            });

        } catch (error) {

            console.error(
                "GET COMMENTS ERROR:",
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
// ADD COMMENT
// ==================================================

router.post(
    "/:postId/comments",
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


            const content =
                String(
                    req.body.content || ""
                ).trim();


            if (!content) {

                return res.status(400).json({
                    error:
                        "Comment cannot be empty."
                });

            }


            const {
                data,
                error
            } = await req.supabase
                .from("comments")
                .insert({

                    post_id:
                        req.params.postId,

                    user_id:
                        req.session.user.id,

                    content

                })
                .select()
                .single();


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.status(201).json({

                success:
                    true,

                comment:
                    data

            });

        } catch (error) {

            console.error(
                "ADD COMMENT ERROR:",
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