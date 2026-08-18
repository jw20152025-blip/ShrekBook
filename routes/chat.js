// ==================================================
// SHREKBOOK SHREKCHAT ROUTES
// ==================================================

const express = require("express");

const router = express.Router();


// ==================================================
// GET SHREKCHAT MESSAGES
// ==================================================

router.get(
    "/messages",
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await req.supabase
                .from("shrekchat_messages")
                .select(`
                    id,
                    user_id,
                    message,
                    created_at
                `)
                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                )
                .limit(100);

            if (error) {

                console.error(
                    "GET CHAT MESSAGES ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });

            }

            res.json({
                messages:
                    data || []
            });

        } catch (error) {

            console.error(
                "CHAT GET ERROR:",
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
// SEND SHREKCHAT MESSAGE
// ==================================================

router.post(
    "/messages",
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

            const message =
                String(
                    req.body.message || ""
                ).trim();


            if (!message) {

                return res.status(400).json({
                    error:
                        "Message cannot be empty."
                });

            }


            if (message.length > 1000) {

                return res.status(400).json({
                    error:
                        "Message is too long."
                });

            }


            const {
                data,
                error
            } = await req.supabase
                .from("shrekchat_messages")
                .insert({

                    user_id:
                        req.session.user.id,

                    message:
                        message

                })
                .select(`
                    id,
                    user_id,
                    message,
                    created_at
                `)
                .single();


            if (error) {

                console.error(
                    "SEND CHAT MESSAGE ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.status(201).json({

                success:
                    true,

                message:
                    data

            });

        } catch (error) {

            console.error(
                "CHAT POST ERROR:",
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
// DELETE CHAT MESSAGE
// ==================================================

router.delete(
    "/messages/:id",
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

            const messageId =
                req.params.id;


            const {
                data: message,
                error: findError
            } = await req.supabase
                .from("shrekchat_messages")
                .select("id,user_id")
                .eq(
                    "id",
                    messageId
                )
                .maybeSingle();


            if (findError) {

                return res.status(500).json({
                    error:
                        findError.message
                });

            }


            if (!message) {

                return res.status(404).json({
                    error:
                        "Message not found."
                });

            }


            // Users can delete their own messages.
            if (
                message.user_id !==
                req.session.user.id
            ) {

                return res.status(403).json({
                    error:
                        "You can only delete your own messages."
                });

            }


            const {
                error
            } = await req.supabase
                .from("shrekchat_messages")
                .delete()
                .eq(
                    "id",
                    messageId
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
                "DELETE CHAT MESSAGE ERROR:",
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