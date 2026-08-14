/* ==================================================
   SHREKBOOK REACTIONS ROUTES
================================================== */

const express = require("express");

const router = express.Router();

const { supabase } =
    require("../utils/supabase");


/* ==================================================
   AUTH CHECK
================================================== */

function requireLogin(req, res, next) {

    if (!req.session || !req.session.user) {

        return res.status(401).json({
            error: "You must be logged in."
        });

    }

    next();

}


/* ==================================================
   GET REACTION COUNTS
================================================== */

async function getReactionCounts(userId) {

    const {
        data,
        error
    } = await supabase
        .from("reactions")
        .select("type")
        .eq("to_user_id", userId);

    if (error) {

        throw error;

    }

    const counts = {

        gyatt: 0,
        cat: 0,
        ogred: 0

    };

    for (const reaction of data || []) {

        if (
            Object.prototype.hasOwnProperty.call(
                counts,
                reaction.type
            )
        ) {

            counts[reaction.type]++;

        }

    }

    return counts;

}


/* ==================================================
   GET REACTIONS FOR PROFILE
================================================== */

router.get(
    "/users/:id/reactions",
    async (req, res) => {

        try {

            const userId =
                req.params.id;

            const counts =
                await getReactionCounts(
                    userId
                );

            res.json({

                success: true,

                counts: counts

            });

        } catch (error) {

            console.error(
                "GET REACTIONS ERROR:",
                error
            );

            res.status(500).json({

                error:
                    error.message ||
                    "Could not load reactions."

            });

        }

    }
);


/* ==================================================
   GIVE REACTION
================================================== */

router.post(
    "/users/:id/reaction",
    requireLogin,
    async (req, res) => {

        try {

            const fromUserId =
                req.session.user.id;

            const toUserId =
                req.params.id;

            const type =
                String(
                    req.body?.type || ""
                )
                .trim()
                .toLowerCase();


            /* ------------------------------------------
               VALIDATE TYPE
            ------------------------------------------ */

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


            /* ------------------------------------------
               DON'T REACT TO YOURSELF
            ------------------------------------------ */

            if (
                fromUserId === toUserId
            ) {

                return res.status(400).json({

                    error:
                        "You cannot react to yourself."

                });

            }


            /* ------------------------------------------
               CHECK TARGET PROFILE
            ------------------------------------------ */

            const {
                data: targetUser,
                error: targetError
            } = await supabase
                .from("profiles")
                .select("id")
                .eq("id", toUserId)
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
               CHECK EXISTING REACTION
            ------------------------------------------ */

            const {
                data: existing,
                error: existingError
            } = await supabase
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
               INSERT REACTION
            ------------------------------------------ */

            const {
                data: reaction,
                error: reactionError
            } = await supabase
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
   EXPORT
================================================== */

module.exports =
    router;