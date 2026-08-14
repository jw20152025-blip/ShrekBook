const express = require("express");

const router = express.Router();

const {
    supabase
} = require("../server");


/* ==================================================
GET ROOMS
================================================== */

router.get(
    "/chat/rooms",
    async (req, res) => {

        try {

            if (!req.session.user) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }


            const userId =
                req.session.user.id;


            const {
                data: rooms,
                error: roomError
            } =
                await supabase
                    .from("chat_rooms")
                    .select(`
                        id,
                        name,
                        created_by,
                        is_private,
                        created_at
                    `)
                    .order(
                        "created_at",
                        {
                            ascending:
                                true
                        }
                    );


            if (roomError) {

                return res.status(500).json({
                    error:
                        roomError.message
                });

            }


            const {
                data: memberships,
                error: memberError
            } =
                await supabase
                    .from("chat_members")
                    .select("room_id")
                    .eq(
                        "user_id",
                        userId
                    );


            if (memberError) {

                return res.status(500).json({
                    error:
                        memberError.message
                });

            }


            const memberRooms =
                new Set(
                    (memberships || [])
                        .map(
                            member =>
                                member.room_id
                        )
                );


            const visibleRooms =
                (rooms || [])
                    .filter(room => {

                        if (
                            !room.is_private
                        ) {

                            return true;

                        }


                        return (
                            room.created_by ===
                            userId ||

                            memberRooms.has(
                                room.id
                            )
                        );

                    });


            res.json(
                visibleRooms
            );


        } catch (error) {

            console.error(
                "GET ROOMS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);


/* ==================================================
CREATE ROOM
================================================== */

router.post(
    "/chat/rooms",
    async (req, res) => {

        try {

            if (!req.session.user) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }


            const name =
                String(
                    req.body.name || ""
                ).trim();


            const isPrivate =
                req.body.is_private === true;


            if (!name) {

                return res.status(400).json({
                    error:
                        "Room name cannot be empty."
                });

            }


            if (name.length > 50) {

                return res.status(400).json({
                    error:
                        "Room name is too long."
                });

            }


            const {
                data: room,
                error
            } =
                await supabase
                    .from("chat_rooms")
                    .insert({

                        name,

                        created_by:
                            req.session.user.id,

                        is_private:
                            isPrivate

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
                error: memberError
            } =
                await supabase
                    .from("chat_members")
                    .insert({

                        room_id:
                            room.id,

                        user_id:
                            req.session.user.id

                    });


            if (memberError) {

                await supabase
                    .from("chat_rooms")
                    .delete()
                    .eq(
                        "id",
                        room.id
                    );


                return res.status(500).json({
                    error:
                        memberError.message
                });

            }


            res.status(201).json(
                room
            );


        } catch (error) {

            console.error(
                "CREATE ROOM ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);


/* ==================================================
JOIN ROOM
================================================== */

router.post(
    "/chat/rooms/:roomId/join",
    async (req, res) => {

        try {

            if (!req.session.user) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }


            const roomId =
                req.params.roomId;

            const userId =
                req.session.user.id;


            const {
                data: room,
                error
            } =
                await supabase
                    .from("chat_rooms")
                    .select(`
                        id,
                        created_by,
                        is_private
                    `)
                    .eq(
                        "id",
                        roomId
                    )
                    .maybeSingle();


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            if (!room) {

                return res.status(404).json({
                    error:
                        "Room not found."
                });

            }


            if (room.is_private) {

                const {
                    data: membership
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


                if (
                    !membership &&
                    room.created_by !== userId
                ) {

                    return res.status(403).json({
                        error:
                            "🔒 You need an invitation to enter this room."
                    });

                }

            }


            const {
                error: joinError
            } =
                await supabase
                    .from("chat_members")
                    .upsert(
                        {

                            room_id:
                                roomId,

                            user_id:
                                userId

                        },
                        {
                            onConflict:
                                "room_id,user_id"
                        }
                    );


            if (joinError) {

                return res.status(500).json({
                    error:
                        joinError.message
                });

            }


            res.json({
                success:
                    true
            });


        } catch (error) {

            console.error(
                "JOIN ROOM ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);


/* ==================================================
LEAVE ROOM
================================================== */

router.post(
    "/chat/rooms/:roomId/leave",
    async (req, res) => {

        try {

            if (!req.session.user) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }


            const {
                error
            } =
                await supabase
                    .from("chat_members")
                    .delete()
                    .eq(
                        "room_id",
                        req.params.roomId
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

            res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);


/* ==================================================
DELETE ROOM
================================================== */

router.delete(
    "/chat/rooms/:roomId",
    async (req, res) => {

        try {

            if (!req.session.user) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }


            const {
                data: room
            } =
                await supabase
                    .from("chat_rooms")
                    .select("created_by")
                    .eq(
                        "id",
                        req.params.roomId
                    )
                    .maybeSingle();


            if (!room) {

                return res.status(404).json({
                    error:
                        "Room not found."
                });

            }


            if (
                room.created_by !==
                req.session.user.id
            ) {

                return res.status(403).json({
                    error:
                        "Only the room creator can delete it."
                });

            }


            const {
                error
            } =
                await supabase
                    .from("chat_rooms")
                    .delete()
                    .eq(
                        "id",
                        req.params.roomId
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

            res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);


/* ==================================================
INVITE USERS
================================================== */

router.get(
    "/chat/rooms/:roomId/invite-users",
    async (req, res) => {

        try {

            if (!req.session.user) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }


            const roomId =
                req.params.roomId;


            const {
                data: room
            } =
                await supabase
                    .from("chat_rooms")
                    .select(`
                        created_by,
                        is_private
                    `)
                    .eq(
                        "id",
                        roomId
                    )
                    .maybeSingle();


            if (!room) {

                return res.status(404).json({
                    error:
                        "Room not found."
                });

            }


            if (
                room.created_by !==
                req.session.user.id
            ) {

                return res.status(403).json({
                    error:
                        "Only the creator can invite people."
                });

            }


            const {
                data: members
            } =
                await supabase
                    .from("chat_members")
                    .select("user_id")
                    .eq(
                        "room_id",
                        roomId
                    );


            const memberIds =
                new Set(
                    (members || [])
                        .map(
                            member =>
                                member.user_id
                        )
                );


            const {
                data: users,
                error
            } =
                await supabase
                    .from("profiles")
                    .select(`
                        id,
                        username,
                        display_name,
                        avatar
                    `)
                    .order(
                        "username",
                        {
                            ascending:
                                true
                        }
                    );


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.json(
                (users || [])
                    .filter(
                        user =>
                            !memberIds.has(
                                user.id
                            )
                    )
            );


        } catch (error) {

            console.error(
                "INVITE USERS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);


/* ==================================================
INVITE USER
================================================== */

router.post(
    "/chat/rooms/:roomId/invite",
    async (req, res) => {

        try {

            if (!req.session.user) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }


            const roomId =
                req.params.roomId;

            const invitedUserId =
                req.body.user_id;


            if (!invitedUserId) {

                return res.status(400).json({
                    error:
                        "No user selected."
                });

            }


            const {
                data: room
            } =
                await supabase
                    .from("chat_rooms")
                    .select(`
                        created_by,
                        is_private
                    `)
                    .eq(
                        "id",
                        roomId
                    )
                    .maybeSingle();


            if (!room) {

                return res.status(404).json({
                    error:
                        "Room not found."
                });

            }


            if (
                room.created_by !==
                req.session.user.id
            ) {

                return res.status(403).json({
                    error:
                        "Only the creator can invite people."
                });

            }


            const {
                data: user
            } =
                await supabase
                    .from("profiles")
                    .select("id")
                    .eq(
                        "id",
                        invitedUserId
                    )
                    .maybeSingle();


            if (!user) {

                return res.status(404).json({
                    error:
                        "User not found."
                });

            }


            const {
                error
            } =
                await supabase
                    .from("chat_members")
                    .upsert(
                        {

                            room_id:
                                roomId,

                            user_id:
                                invitedUserId

                        },
                        {
                            onConflict:
                                "room_id,user_id"
                        }
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
                "INVITE ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);


/* ==================================================
GET MESSAGES
================================================== */

router.get(
    "/chat/rooms/:roomId/messages",
    async (req, res) => {

        try {

            if (!req.session.user) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }


            const roomId =
                req.params.roomId;

            const userId =
                req.session.user.id;


            const {
                data: membership
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


            if (!membership) {

                return res.status(403).json({
                    error:
                        "You are not a member of this room."
                });

            }


            const {
                data: messages,
                error
            } =
                await supabase
                    .from("chat_messages")
                    .select(`
                        id,
                        room_id,
                        user_id,
                        content,
                        created_at
                    `)
                    .eq(
                        "room_id",
                        roomId
                    )
                    .order(
                        "created_at",
                        {
                            ascending:
                                true
                        }
                    )
                    .limit(200);


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            const result = [];


            for (
                const message
                of messages || []
            ) {

                const {
                    data: profile
                } =
                    await supabase
                        .from("profiles")
                        .select(`
                            username,
                            display_name,
                            avatar
                        `)
                        .eq(
                            "id",
                            message.user_id
                        )
                        .maybeSingle();


                result.push({

                    ...message,

                    username:
                        profile?.username ||
                        "User",

                    display_name:
                        profile?.display_name ||
                        profile?.username ||
                        "User",

                    avatar:
                        profile?.avatar ||
                        null

                });

            }


            res.json(result);


        } catch (error) {

            console.error(
                "MESSAGES ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);


/* ==================================================
SEND MESSAGE
================================================== */

router.post(
    "/chat/rooms/:roomId/messages",
    async (req, res) => {

        try {

            if (!req.session.user) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }


            const roomId =
                req.params.roomId;

            const userId =
                req.session.user.id;


            const {
                data: membership
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


            if (!membership) {

                return res.status(403).json({
                    error:
                        "You are not a member of this room."
                });

            }


            const content =
                String(
                    req.body.content || ""
                ).trim();


            if (!content) {

                return res.status(400).json({
                    error:
                        "Message cannot be empty."
                });

            }


            if (content.length > 1000) {

                return res.status(400).json({
                    error:
                        "Message is too long."
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
                    .select()
                    .single();


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.status(201).json(data);


        } catch (error) {

            console.error(
                "SEND MESSAGE ERROR:",
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