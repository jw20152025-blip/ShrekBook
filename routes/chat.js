
"use strict";

const express = require("express");

const router = express.Router();

const supabase =
    require("../utils/supabase.js");


/* =========================================================
   LOGIN CHECK
========================================================= */

function requireLogin(req, res, next) {

    if (
        !req.session ||
        !req.session.user
    ) {

        return res.status(401).json({

            success: false,

            error:
                "You must be logged in."

        });

    }


    next();

}


/* =========================================================
   GET CHAT ROOMS
   GET /api/chat/rooms
========================================================= */

router.get(
    "/chat/rooms",
    requireLogin,
    async (req, res) => {

        const userId =
            req.session.user.id;


        console.log(
            "💬 GET CHAT ROOMS:",
            userId
        );


        try {

            const {
                data: memberships,
                error: membershipError
            } =
                await supabase
                    .from("chat_members")
                    .select("*")
                    .eq(
                        "user_id",
                        userId
                    );


            if (membershipError) {

                console.error(
                    "❌ CHAT MEMBERS ERROR:",
                    membershipError
                );


                return res.status(500).json({

                    success: false,

                    error:
                        membershipError.message,

                    rooms: []

                });

            }


            if (
                !memberships ||
                memberships.length === 0
            ) {

                return res.json({

                    success: true,

                    rooms: []

                });

            }


            const roomIds =
                memberships.map(
                    member =>
                        member.room_id
                );


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
                    "❌ CHAT ROOMS ERROR:",
                    roomError
                );


                return res.status(500).json({

                    success: false,

                    error:
                        roomError.message,

                    rooms: []

                });

            }


            return res.json({

                success: true,

                rooms:
                    rooms || []

            });

        } catch (error) {

            console.error(
                "❌ CHAT ROOMS CRASH:",
                error
            );


            return res.status(500).json({

                success: false,

                error:
                    error.message,

                rooms: []

            });

        }

    }
);


/* =========================================================
   GET MESSAGES
   GET /api/chat/rooms/:roomId/messages
========================================================= */

router.get(
    "/chat/rooms/:roomId/messages",
    requireLogin,
    async (req, res) => {

        const roomId =
            req.params.roomId;


        try {

            const {
                data,
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
                    "❌ CHAT MESSAGE ERROR:",
                    error
                );


                return res.status(500).json({

                    success: false,

                    error:
                        error.message,

                    messages: []

                });

            }


            return res.json({

                success: true,

                messages:
                    data || []

            });

        } catch (error) {

            console.error(
                "❌ MESSAGE CRASH:",
                error
            );


            return res.status(500).json({

                success: false,

                error:
                    error.message,

                messages: []

            });

        }

    }
);


/* =========================================================
   SEND MESSAGE
   POST /api/chat/rooms/:roomId/messages
========================================================= */

router.post(
    "/chat/rooms/:roomId/messages",
    requireLogin,
    async (req, res) => {

        const roomId =
            req.params.roomId;

        const userId =
            req.session.user.id;

        const content =
            String(
                req.body?.content ||
                ""
            ).trim();


        if (!content) {

            return res.status(400).json({

                success: false,

                error:
                    "Message cannot be empty."

            });

        }


        try {

            /*
             * Verify that the user belongs
             * to this room.
             */

            const {
                data: membership,
                error: membershipError
            } =
                await supabase
                    .from("chat_members")
                    .select("*")
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

                    success: false,

                    error:
                        membershipError.message

                });

            }


            if (!membership) {

                return res.status(403).json({

                    success: false,

                    error:
                        "You are not a member of this chat."

                });

            }


            const {
                data,
                error
            } =
                await supabase
                    .from("chat_messages")
                    .insert({

                        room_id:
                            roomId,

                        user_id:
                            userId,

                        content:
                            content

                    })
                    .select("*")
                    .single();


            if (error) {

                console.error(
                    "❌ SEND MESSAGE ERROR:",
                    error
                );


                return res.status(500).json({

                    success: false,

                    error:
                        error.message

                });

            }


            return res.status(201).json({

                success: true,

                message:
                    data

            });

        } catch (error) {

            console.error(
                "❌ SEND MESSAGE CRASH:",
                error
            );


            return res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }

    }
);


module.exports =
    router;

