const express = require("express");

const router = express.Router();

function db(req) {
    return req.app.locals.supabase;
}

// ==================================================
// GET REACTION COUNTS
// ==================================================

router.get(
    "/posts/:postId/reactions",
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await db(req)
                .from("reactions")
                .select(`
                    id,
                    post_id,
                    user_id,
                    reaction_type
                `)
                .eq(
                    "post_id",
                    req.params.postId
                );

            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }

            const counts = {};

            for (
                const reaction
                of data || []
            ) {

                const type =
                    reaction.reaction_type;

                counts[type] =
                    (counts[type] || 0) + 1;
            }

            let userReaction = null;

            if (
                req.session &&
                req.session.user
            ) {

                const own =
                    (data || []).find(
                        reaction =>
                            reaction.user_id ===
                            req.session.user.id
                    );

                if (own) {
                    userReaction =
                        own.reaction_type;
                }

            }

            res.json({
                counts,
                userReaction
            });

        } catch (error) {

            console.error(
                "GET REACTIONS ERROR:",
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
// ADD / CHANGE REACTION
// ==================================================

router.post(
    "/posts/:postId/reactions",
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

            const reactionType =
                String(
                    req.body.reaction_type ||
                    req.body.reaction ||
                    ""
                )
                .trim()
                .toLowerCase();

            const allowed = [
                "like",
                "love",
                "laugh",
                "angry",
                "sad",
                "gyatt"
            ];

            if (
                !allowed.includes(
                    reactionType
                )
            ) {

                return res.status(400).json({
                    error:
                        "Invalid reaction type."
                });

            }

            const {
                data: existing
            } = await db(req)
                .from("reactions")
                .select("id,reaction_type")
                .eq(
                    "post_id",
                    req.params.postId
                )
                .eq(
                    "user_id",
                    req.session.user.id
                )
                .maybeSingle();

            if (existing) {

                const {
                    data,
                    error
                } = await db(req)
                    .from("reactions")
                    .update({
                        reaction_type:
                            reactionType
                    })
                    .eq(
                        "id",
                        existing.id
                    )
                    .select()
                    .single();

                if (error) {

                    return res.status(500).json({
                        error:
                            error.message
                    });

                }

                return res.json({
                    success: true,
                    reaction: data
                });

            }

            const {
                data,
                error
            } = await db(req)
                .from("reactions")
                .insert({
                    post_id:
                        req.params.postId,
                    user_id:
                        req.session.user.id,
                    reaction_type:
                        reactionType
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
                reaction: data
            });

        } catch (error) {

            console.error(
                "REACTION ERROR:",
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
// REMOVE REACTION
// ==================================================

router.delete(
    "/posts/:postId/reactions",
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
                error
            } = await db(req)
                .from("reactions")
                .delete()
                .eq(
                    "post_id",
                    req.params.postId
                )
                .eq(
                    "user_id",
                    req.session.user.id
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
                "REMOVE REACTION ERROR:",
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