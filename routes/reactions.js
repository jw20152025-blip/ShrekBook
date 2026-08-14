const express = require("express");

const router = express.Router();

const supabase =
    require("../utils/supabase.js");


/* ==================================================
   GIVE REACTION
================================================== */

router.post(
    "/users/:id/reaction",
    async (req, res) => {

        try {

            if (!req.session.user) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }


            const fromUserId =
                req.session.user.id;

            const toUserId =
                req.params.id;

            const type =
                String(
                    req.body.type || ""
                ).trim().toLowerCase();


            const allowedTypes = [
                "gyatt",
                "cat",
                "ogred"
            ];


            if (
                !allowedTypes.includes(type)
            ) {

                return res.status(400).json({
                    error:
                        "Invalid reaction type."
                });

            }


            if (
                fromUserId === toUserId
            ) {

                return res.status(400).json({
                    error:
                        "You cannot react to yourself."
                });

            }


            const {
                data: existing,
                error: findError
            } =
                await supabase
                    .from("reactions")
                    .select("id")
                    .eq(
                        "from_user_id",
                        fromUserId
                    )
                    .eq(
                        "to_user_id",
                        toUserId
                    )
                    .maybeSingle();


            if (findError) {

                return res.status(500).json({
                    error:
                        findError.message
                });

            }


            if (existing) {

                const {
                    error: updateError
                } =
                    await supabase
                        .from("reactions")
                        .update({
                            type
                        })
                        .eq(
                            "id",
                            existing.id
                        );


                if (updateError) {

                    return res.status(500).json({
                        error:
                            updateError.message
                    });

                }

            } else {

                const {
                    error: insertError
                } =
                    await supabase
                        .from("reactions")
                        .insert({

                            from_user_id:
                                fromUserId,

                            to_user_id:
                                toUserId,

                            type

                        });


                if (insertError) {

                    return res.status(500).json({
                        error:
                            insertError.message
                    });

                }

            }


            const {
                data: reactions,
                error: countError
            } =
                await supabase
                    .from("reactions")
                    .select("type")
                    .eq(
                        "to_user_id",
                        toUserId
                    );


            if (countError) {

                return res.status(500).json({
                    error:
                        countError.message
                });

            }


            const counts = {

                gyatt: 0,

                cat: 0,

                ogred: 0

            };


            for (
                const reaction
                of reactions || []
            ) {

                if (
                    counts[
                        reaction.type
                    ] !== undefined
                ) {

                    counts[
                        reaction.type
                    ]++;

                }

            }


            res.json({

                success: true,

                counts

            });


        } catch (error) {

            console.error(
                "REACTION ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message ||
                    "Server error."
            });

        }

    }
);


module.exports = router;