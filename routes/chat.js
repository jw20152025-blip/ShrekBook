/* =========================================================
   SHREKCHAT ROUTES
========================================================= */

const express =
    require("express");

const router =
    express.Router();

const supabase =
    require("../utils/supabase.js");


/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

function requireLogin(req, res, next) {

    if (!req.session.user) {

        return res.status(401).json({
            error:
                "You must be logged in."
        });

    }

    next();

}


/* =========================================================
   GET ROOMS
========================================================= */

router.get(
    "/chat/rooms",
    requireLogin,
    async (req, res) => {

        try {

            const userId =
                req.session.user.id;


            const {
                data: memberships,
                error: membershipError
            } =
                await supabase
                    .from("chat_members")
                    .select("room_id")
                    .eq(
                        "user_id",
                        userId
                    );


            if (membershipError) {

                console.error(
                    "CHAT MEMBERS ERROR:",
                    membershipError
                );

                return res.status(500).json({
                    error:
                        membershipError.message
                });

            }


            const roomIds =
                (memberships || [])
                    .map(
                        member =>
                            member.room_id
                    )
                    .filter(Boolean);


            if (!roomIds.length) {

                return res.json({
                    success: true,
                    rooms: []
                });

            }


            const {
                data: rooms,
                error: roomError
            } =
                await supabase
                    .from("chat_rooms")
                    .select("*")
                    .in(
                        "id",
                        roomIds
                    );


            if (roomError) {

                console.error(
                    "CHAT ROOMS ERROR:",
                    roomError
                );

                return res.status(500).json({
                    error:
                        roomError.message
                });

            }


            return res.json({

                success:
                    true,

                rooms:
                    rooms || []

            });


        } catch (error) {

            console.error(
                "GET CHAT ROOMS ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    error.message ||
                    "Server error."
            });

        }

    }
);


/* =========================================================
   GET MESSAGES
========================================================= */

router.get(
    "/chat/rooms/:roomId/messages",
    requireLogin,
    async (req, res) => {

        try {

            const roomId =
                req.params.roomId;

            const userId =
                req.session.user.id;


            /* Make sure user belongs to room */

            const {
                data: membership,
                error: membershipError
            } =
                await supabase
                    .from("chat_members")
                    .select("room_id")
                    .eq(
                        "room_id",
                        roomId
                    )
                    .eq(
                        "user_id",
                        userId
                    )
                    .maybeSingle();


            if (membershipError) {

                return res.status(500).json({
                    error:
                        membershipError.message
                });

            }


            if (!membership) {

                return res.status(403).json({
                    error:
                        "You are not a member of this chat."
                });

            }


            const {
                data: messages,
                error
            } =
                await supabase
                    .from("chat_messages")
                    .select("*")
                    .eq(
                        "room_id",
                        roomId
                    )
                    .order(
                        "created_at",
                        {
                            ascending: true
                        }
                    );


            if (error) {

                console.error(
                    "CHAT MESSAGE ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            return res.json({

                success:
                    true,

                messages:
                    messages || []

            });


        } catch (error) {

            console.error(
                "GET MESSAGES ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    error.message ||
                    "Server error."
            });

        }

    }
);


/* =========================================================
   SEND MESSAGE
========================================================= */

router.post(
    "/chat/rooms/:roomId/messages",
    requireLogin,
    async (req, res) => {

        try {

            const roomId =
                req.params.roomId;

            const userId =
                req.session.user.id;

            const content =
                String(
                    req.body.content ||
                    ""
                ).trim();


            if (!content) {

                return res.status(400).json({
                    error:
                        "Message cannot be empty."
                });

            }


            if (content.length > 5000) {

                return res.status(400).json({
                    error:
                        "Message is too long."
                });

            }


            /* Verify membership */

            const {
                data: membership,
                error: membershipError
            } =
                await supabase
                    .from("chat_members")
                    .select("room_id")
                    .eq(
                        "room_id",
                        roomId
                    )
                    .eq(
                        "user_id",
                        userId
                    )
                    .maybeSingle();


            if (membershipError) {

                return res.status(500).json({
                    error:
                        membershipError.message
                });

            }


            if (!membership) {

                return res.status(403).json({
                    error:
                        "You are not a member of this chat."
                });

            }


            const {
                data: message,
                error
            } =
                await supabase
                    .from("chat_messages")
                    .insert({

                        room_id:
                            roomId,

                        sender_id:
                            userId,

                        content:
                            content

                    })
                    .select()
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


            return res.status(201).json({

                success:
                    true,

                message:
                    message

            });


        } catch (error) {

            console.error(
                "SEND MESSAGE CRASH:",
                error
            );

            return res.status(500).json({
                error:
                    error.message ||
                    "Server error."
            });

        }

    }
);


module.exports =
    router;