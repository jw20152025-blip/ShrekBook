/* ==================================================
   SHREKBOOK REACTIONS
================================================== */

const express = require("express");

const router = express.Router();

const supabase =
    require("../utils/supabase");

/* ==================================================
   GIVE REACTION
================================================== */

router.post(
    "/users/:id/reaction",
    async (req, res) => {

        if (!req.session.user) {

            return res.status(401).json({
                error:
                    "You must be logged in."
            });

        }

        try {

            const toUserId =
                req.params.id;

            const type =
                String(
                    req.body.type || ""
                );

            const allowed = [
                "gyatt",
                "cat",
                "ogred"
            ];

            if (
                !allowed.includes(type)
            ) {

                return res.status(400).json({
                    error:
                        "Invalid reaction type."
                });

            }

            /*
             * Prevent reacting to yourself.
             */

            if (
                req.session.user.id ===
                toUserId
            ) {

                return res.status(400).json({
                    error:
                        "You cannot react to yourself."
                });

            }

            /*
             * Remove an existing reaction
             * from this user to this profile.
             */

            await supabase
                .from("reactions")
                .delete()
                .eq(
                    "from_user_id",
                    req.session.user.id
                )
                .eq(
                    "to_user_id",
                    toUserId
                );

            const {
                data: reaction,
                error
            } =
                await supabase
                    .from("reactions")
                    .insert({

                        from_user_id:
                            req.session.user.id,

                        to_user_id:
                            toUserId,

                        type

                    })
                    .select()
                    .single();

            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }

            const {
                data: reactions
            } =
                await supabase
                    .from("reactions")
                    .select("type")
                    .eq(
                        "to_user_id",
                        toUserId
                    );

            const counts = {

                gyatt: 0,

                cat: 0,

                ogred: 0

            };

            for (
                const item
                of reactions || []
            ) {

                if (
                    counts[item.type] !==
                    undefined
                ) {

                    counts[item.type]++;

                }

            }

            res.json({

                success: true,

                reaction,

                counts

            });

        } catch (error) {

            console.error(
                "REACTION ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

module.exports = router;