// ==================================================
// SHREKBOOK UPLOAD ROUTES
// ==================================================

const express = require("express");

const router = express.Router();


// ==================================================
// UPDATE AVATAR URL
// ==================================================

router.post(
    "/avatar",
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


            const avatarUrl =
                String(
                    req.body.avatar_url || ""
                ).trim();


            if (!avatarUrl) {

                return res.status(400).json({
                    error:
                        "Avatar URL is required."
                });

            }


            const {
                data,
                error
            } = await req.supabase
                .from("profiles")
                .update({

                    avatar_url:
                        avatarUrl

                })
                .eq(
                    "id",
                    req.session.user.id
                )
                .select(`
                    id,
                    avatar_url
                `)
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

                profile:
                    data

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


module.exports = router;