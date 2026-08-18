const express = require("express");

const router = express.Router();

function db(req) {
    return req.app.locals.supabase;
}

// ==================================================
// GET COMMENTS
// ==================================================

router.get(
    "/posts/:postId/comments",
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await db(req)
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
    "/posts/:postId/comments",
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
            } = await db(req)
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
                success: true,
                comment: data
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

// ==================================================
// DELETE COMMENT
// ==================================================

router.delete(
    "/comments/:id",
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
                data: comment,
                error: findError
            } = await db(req)
                .from("comments")
                .select(
                    "id,user_id"
                )
                .eq(
                    "id",
                    req.params.id
                )
                .maybeSingle();

            if (findError) {

                return res.status(500).json({
                    error:
                        findError.message
                });

            }

            if (!comment) {

                return res.status(404).json({
                    error:
                        "Comment not found."
                });

            }

            if (
                comment.user_id !==
                req.session.user.id
            ) {

                return res.status(403).json({
                    error:
                        "You can only delete your own comments."
                });

            }

            const {
                error
            } = await db(req)
                .from("comments")
                .delete()
                .eq(
                    "id",
                    req.params.id
                );

            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }

            res.json({
                success: true
            });

        } catch (error) {

            console.error(
                "DELETE COMMENT ERROR:",
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