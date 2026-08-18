// ==================================================
// SHREKBOOK REACTION ROUTES
// ==================================================

const express = require("express");

const router = express.Router();


// ==================================================
// GET REACTIONS FOR POST
// ==================================================

router.get(
    "/:postId",
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await req.supabase
                .from("reactions")
                .select(`
                    id,
                    post_id,
                    user_id,
                    reaction
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
                const item of data || []
            ) {

                const type =
                    item.reaction ||
                    "gyatt";

                counts[type] =
                    (
                        counts[type] ||
                        0
                    ) + 1;

            }


            res.json({

                reactions:
                    data || [],

                counts

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
    "/:postId",
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


            const reaction =
                String(
                    req.body.reaction ||
                    "gyatt"
                )
                .trim();


            const userId =
                req.session.user.id;

            const postId =
                req.params.postId;


            const {
                data: existing
            } = await req.supabase
                .from("reactions")
                .select("id")
                .eq(
                    "post_id",
                    postId
                )
                .eq(
                    "user_id",
                    userId
                )
                .maybeSingle();


            let data;
            let error;


            if (existing) {

                ({
                    data,
                    error
                } = await req.supabase
                    .from("reactions")
                    .update({
                        reaction
                    })
                    .eq(
                        "id",
                        existing.id
                    )
                    .select()
                    .single());

            } else {

                ({
                    data,
                    error
                } = await req.supabase
                    .from("reactions")
                    .insert({

                        post_id:
                            postId,

                        user_id:
                            userId,

                        reaction

                    })
                    .select()
                    .single());

            }


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.json({

                success:
                    true,

                reaction:
                    data

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
    "/:postId",
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
            } = await req.supabase
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
                success:
                    true
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