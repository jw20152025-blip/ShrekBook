const express = require("express");

const router = express.Router();


const supabase =
    require("../utils/supabase.js");


/* ==================================================
ALLOWED REACTIONS
================================================== */

const ALLOWED_TYPES = [
    "gyatt",
    "cat",
    "ogred"
];


/* ==================================================
GET REACTION COUNTS
================================================== */

async function getReactionCounts(userId) {

    const {
        data,
        error
    } =
        await supabase
            .from("reactions")
            .select("type")
            .eq(
                "to_user_id",
                userId
            );


    if (error) {

        throw error;

    }


    const counts = {

        gyatt:
            0,

        cat:
            0,

        ogred:
            0

    };


    for (
        const reaction
        of data || []
    ) {

        if (
            ALLOWED_TYPES.includes(
                reaction.type
            )
        ) {

            counts[
                reaction.type
            ]++;

        }

    }


    return counts;

}


/* ==================================================
GET COUNTS
================================================== */

router.get(
    "/users/:id/reactions",
    async (req, res) => {

        try {

            const counts =
                await getReactionCounts(
                    req.params.id
                );


            res.json(counts);


        } catch (error) {

            console.error(
                "REACTION COUNT ERROR:",
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


/* ==================================================
GIVE REACTION
================================================== */

router.post(
    "/users/:id/reaction",
    async (req, res) => {

        try {

            console.log(
                "🔥 REACTION REQUEST:",
                req.params.id,
                req.body
            );


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
                )
                .trim()
                .toLowerCase();


            if (
                !ALLOWED_TYPES.includes(type)
            ) {

                return res.status(400).json({
                    error:
                        "Invalid reaction type."
                });

            }


            if (
                fromUserId ===
                toUserId
            ) {

                return res.status(400).json({
                    error:
                        "You cannot react to yourself."
                });

            }


            /* ------------------------------------------
            CHECK TARGET USER
            ------------------------------------------ */

            const {
                data: targetUser,
                error: targetError
            } =
                await supabase
                    .from("profiles")
                    .select("id")
                    .eq(
                        "id",
                        toUserId
                    )
                    .maybeSingle();


            if (targetError) {

                console.error(
                    "TARGET USER ERROR:",
                    targetError
                );

                return res.status(500).json({
                    error:
                        targetError.message
                });

            }


            if (!targetUser) {

                return res.status(404).json({
                    error:
                        "User not found."
                });

            }


            /* ------------------------------------------
            CHECK DUPLICATE
            ------------------------------------------ */

            const {
                data: existing,
                error: existingError
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
                    .eq(
                        "type",
                        type
                    )
                    .maybeSingle();


            if (existingError) {

                console.error(
                    "EXISTING REACTION ERROR:",
                    existingError
                );

                return res.status(500).json({
                    error:
                        existingError.message
                });

            }


            if (existing) {

                return res.status(400).json({
                    error:
                        `You already gave this person a ${type}.`
                });

            }


            /* ------------------------------------------
            INSERT
            ------------------------------------------ */

            const {
                data: reaction,
                error: reactionError
            } =
                await supabase
                    .from("reactions")
                    .insert({

                        from_user_id:
                            fromUserId,

                        to_user_id:
                            toUserId,

                        type:
                            type

                    })
                    .select()
                    .single();


            if (reactionError) {

                console.error(
                    "REACTION INSERT ERROR:",
                    reactionError
                );

                return res.status(500).json({
                    error:
                        reactionError.message
                });

            }


            /* ------------------------------------------
            UPDATED COUNTS
            ------------------------------------------ */

            const counts =
                await getReactionCounts(
                    toUserId
                );


            res.status(201).json({

                success:
                    true,

                reaction:
                    reaction,

                counts:
                    counts,

                count:
                    counts[type]

            });


        } catch (error) {

            console.error(
                "REACTION ROUTE CRASH:",
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


/* ==================================================
REMOVE REACTION
================================================== */

router.delete(
    "/users/:id/reaction/:type",
    async (req, res) => {

        try {

            if (!req.session.user) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }


            const type =
                String(
                    req.params.type || ""
                )
                .trim()
                .toLowerCase();


            if (
                !ALLOWED_TYPES.includes(type)
            ) {

                return res.status(400).json({
                    error:
                        "Invalid reaction type."
                });

            }


            const {
                error
            } =
                await supabase
                    .from("reactions")
                    .delete()
                    .eq(
                        "from_user_id",
                        req.session.user.id
                    )
                    .eq(
                        "to_user_id",
                        req.params.id
                    )
                    .eq(
                        "type",
                        type
                    );


            if (error) {

                console.error(
                    "REMOVE REACTION ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            const counts =
                await getReactionCounts(
                    req.params.id
                );


            res.json({

                success:
                    true,

                counts:
                    counts

            });


        } catch (error) {

            console.error(
                "REMOVE REACTION ERROR:",
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