const express = require("express");

const router = express.Router();

function db(req) {
    return req.app.locals.supabase;
}

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
            } = await db(req)
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
            } = await db(req)
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
                success: true,
                post: data
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

module.exports = router;