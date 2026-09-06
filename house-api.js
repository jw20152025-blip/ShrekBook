const express = require("express");

const router = express.Router();
const multer = require("multer");
const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 100 * 1024 * 1024
    }
});

/*
============================================================
SHREKBOOK HOUSE API
============================================================
Requires:

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

Then:

const houseRouter = require("./house-api")({
    supabase
});


============================================================
*/

module.exports = function createHouseRouter({ supabase }) {

    // ========================================================
    // AUTH
    // ========================================================

    async function requireHouseLogin(req, res, next) {
        try {
            /*
             * This uses the existing ShrekBook session.
             *
             * If your existing server uses a different property
             * for the logged-in user's UUID, change ONLY this line.
             */
            const userId = req.session?.userId;

            if (!userId) {
                return res.status(401).json({
                    error: "You must be logged in."
                });
            }

            req.houseUserId = userId;

            next();
        } catch (error) {
            console.error("House auth error:", error);

            res.status(500).json({
                error: "Authentication error."
            });
        }
    }


    // ========================================================
    // HELPERS
    // ========================================================

    async function getMembership(houseId, userId) {
        const { data, error } = await supabase
            .from("house_members")
            .select("id, house_id, user_id, role, joined_at")
            .eq("house_id", houseId)
            .eq("user_id", userId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return data;
    }


    async function requireMember(houseId, userId) {
        const membership = await getMembership(
            houseId,
            userId
        );

        if (!membership) {
            return null;
        }

        return membership;
    }


    async function requireAdmin(houseId, userId) {
        const membership = await getMembership(
            houseId,
            userId
        );

        if (
            !membership ||
            !["owner", "admin"].includes(membership.role)
        ) {
            return null;
        }

        return membership;
    }


    async function getHouse(houseId) {
        const { data, error } = await supabase
            .from("houses")
            .select(`
                id,
                name,
                description,
                owner_id,
                house_type_id,
                created_at,
                updated_at,
                house_types (
                    id,
                    name,
                    cost,
                    tax_reduction,
                    room_count
                )
            `)
            .eq("id", houseId)
            .single();

        if (error) {
            return null;
        }

        return data;
    }


    async function getProfile(userId) {
        const { data, error } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar")
            .eq("id", userId)
            .single();

        if (error) {
            throw error;
        }

        return data;
    }


    async function getHouseMembers(houseId) {
        const { data, error } = await supabase
            .from("house_members")
            .select(`
                id,
                house_id,
                user_id,
                role,
                joined_at,
                profiles (
                    id,
                    username,
                    display_name,
                    avatar
                )
            `)
            .eq("house_id", houseId)
            .order("joined_at", {
                ascending: true
            });

        if (error) {
            throw error;
        }

        return data || [];
    }


    async function chargeShrekCoins(userId, amount) {
        amount = Number(amount);

        if (
            !Number.isSafeInteger(amount) ||
            amount < 0
        ) {
            throw new Error("Invalid ShrekCoin amount.");
        }

        if (amount === 0) {
            return true;
        }

        const { data: profile, error } = await supabase
            .from("profiles")
            .select("shrekcoins")
            .eq("id", userId)
            .single();

        if (error) {
            throw error;
        }

        const balance = Number(profile.shrekcoins || 0);

        if (balance < amount) {
            return false;
        }

        /*
         * Optimistic update.
         *
         * The balance condition prevents two simultaneous
         * requests from spending the same balance.
         */
        const { data, error: updateError } = await supabase
            .from("profiles")
            .update({
                shrekcoins: balance - amount
            })
            .eq("id", userId)
            .eq("shrekcoins", balance)
            .select("shrekcoins")
            .maybeSingle();

        if (updateError) {
            throw updateError;
        }

        return Boolean(data);
    }


    // ========================================================
    // HOUSE TYPES
    // ========================================================

    router.get(
        "/houses/types",
        requireHouseLogin,
        async (req, res) => {
            try {
                const { data, error } = await supabase
                    .from("house_types")
                    .select(`
                        id,
                        name,
                        cost,
                        tax_reduction,
                        room_count
                    `)
                    .order("cost", {
                        ascending: true
                    });

                if (error) {
                    throw error;
                }

                res.json({
                    houseTypes: data || []
                });

            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to load house types."
                });
            }
        }
    );


    // ========================================================
    // CREATE HOUSE
    // ========================================================

    router.post(
        "/houses",
        requireHouseLogin,
        async (req, res) => {
            try {
                const userId = req.houseUserId;

                const name = String(
                    req.body?.name || ""
                ).trim();

                const description = String(
                    req.body?.description || ""
                ).trim();

                const houseTypeId = Number(
                    req.body?.houseTypeId
                );

                if (!name) {
                    return res.status(400).json({
                        error: "House name is required."
                    });
                }

                if (
                    !Number.isSafeInteger(houseTypeId)
                ) {
                    return res.status(400).json({
                        error: "Invalid house type."
                    });
                }

                const { data: houseType, error: typeError } =
                    await supabase
                        .from("house_types")
                        .select(`
                            id,
                            name,
                            cost,
                            tax_reduction,
                            room_count
                        `)
                        .eq("id", houseTypeId)
                        .single();

                if (typeError || !houseType) {
                    return res.status(404).json({
                        error: "House type not found."
                    });
                }

                /*
                 * A user may own only one house.
                 */

                const { data: existingHouse } =
                    await supabase
                        .from("houses")
                        .select("id")
                        .eq("owner_id", userId)
                        .maybeSingle();

                if (existingHouse) {
                    return res.status(409).json({
                        error: "You already own a house."
                    });
                }

                /*
                 * Charge the ShrekCoins first.
                 */

                const charged = await chargeShrekCoins(
                    userId,
                    houseType.cost
                );

                if (!charged) {
                    return res.status(400).json({
                        error: "You do not have enough ShrekCoins."
                    });
                }

                let house = null;

                try {
                    /*
                     * Create house.
                     */

                    const { data, error } = await supabase
                        .from("houses")
                        .insert({
                            name,
                            description,
                            owner_id: userId,
                            house_type_id: houseType.id
                        })
                        .select()
                        .single();

                    if (error) {
                        throw error;
                    }

                    house = data;


                    /*
                     * Create owner membership.
                     */

                    const { error: memberError } =
                        await supabase
                            .from("house_members")
                            .insert({
                                house_id: house.id,
                                user_id: userId,
                                role: "owner"
                            });

                    if (memberError) {
                        throw memberError;
                    }


                    /*
                     * Automatically create rooms based
                     * on the house type.
                     */

                    const roomTemplates = [
                        {
                            name: "General",
                            room_type: "general"
                        },
                        {
                            name: "Chat",
                            room_type: "chat"
                        },
                        {
                            name: "Media",
                            room_type: "media"
                        }
                    ];

                    const roomCount =
                        Number(houseType.room_count);

                    const rooms = [];

                    for (
                        let i = 0;
                        i < roomCount;
                        i++
                    ) {
                        if (i < roomTemplates.length) {
                            rooms.push({
                                house_id: house.id,
                                name: roomTemplates[i].name,
                                room_type:
                                    roomTemplates[i].room_type,
                                position: i
                            });
                        } else {
                            rooms.push({
                                house_id: house.id,
                                name: `Room ${i + 1}`,
                                room_type: "chat",
                                position: i
                            });
                        }
                    }

                    const { error: roomError } =
                        await supabase
                            .from("house_rooms")
                            .insert(rooms);

                    if (roomError) {
                        throw roomError;
                    }

                } catch (creationError) {

                    /*
                     * Refund if house creation fails.
                     */

                    if (houseType.cost > 0) {
                        await supabase
                            .from("profiles")
                            .select("shrekcoins")
                            .eq("id", userId)
                            .single()
                            .then(async ({ data }) => {

                                if (!data) {
                                    return;
                                }

                                await supabase
                                    .from("profiles")
                                    .update({
                                        shrekcoins:
                                            Number(
                                                data.shrekcoins || 0
                                            ) + houseType.cost
                                    })
                                    .eq("id", userId);
                            });
                    }

                    throw creationError;
                }

                res.status(201).json({
                    house
                });

            } catch (error) {
                console.error(
                    "Create house error:",
                    error
                );

                res.status(500).json({
                    error: "Failed to create house."
                });
            }
        }
    );


    // ========================================================
    // DIRECTORY
    // ========================================================

    router.get(
        "/houses",
        requireHouseLogin,
        async (req, res) => {
            try {
                const search = String(
                    req.query.search || ""
                ).trim();

                let query = supabase
                    .from("houses")
                    .select(`
                        id,
                        name,
                        description,
                        owner_id,
                        house_type_id,
                        created_at,
                        house_types (
                            id,
                            name,
                            cost,
                            tax_reduction,
                            room_count
                        )
                    `)
                    .order("created_at", {
                        ascending: false
                    });

                if (search) {
                    query = query.or(
                        `name.ilike.%${search}%,description.ilike.%${search}%`
                    );
                }

                const { data: houses, error } =
                    await query;

                if (error) {
                    throw error;
                }

                const results = [];

                for (const house of houses || []) {

                    const members =
                        await getHouseMembers(
                            house.id
                        );

                    const owner =
                        await getProfile(
                            house.owner_id
                        );

                    results.push({
                        ...house,
                        owner,
                        memberCount: members.length
                    });
                }

                res.json({
                    houses: results
                });

            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to load house directory."
                });
            }
        }
    );


    // ========================================================
    // SINGLE HOUSE
    // ========================================================

    router.get(
        "/houses/:id",
        requireHouseLogin,
        async (req, res) => {
            try {
                const houseId =
                    Number(req.params.id);

                const house =
                    await getHouse(houseId);

                if (!house) {
                    return res.status(404).json({
                        error: "House not found."
                    });
                }

                const members =
                    await getHouseMembers(
                        houseId
                    );

                const owner =
                    await getProfile(
                        house.owner_id
                    );

                const { data: rooms, error } =
                    await supabase
                        .from("house_rooms")
                        .select(`
                            id,
                            house_id,
                            name,
                            room_type,
                            description,
                            position,
                            created_at
                        `)
                        .eq("house_id", houseId)
                        .order("position", {
                            ascending: true
                        });

                if (error) {
                    throw error;
                }

                const membership =
                    await getMembership(
                        houseId,
                        req.houseUserId
                    );

                res.json({
                    house,
                    owner,
                    members,
                    rooms: rooms || [],
                    membership
                });

            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to load house."
                });
            }
        }
    );


    // ========================================================
    // INVITATIONS
    // ========================================================

    router.get(
        "/houses/invitations",
        requireHouseLogin,
        async (req, res) => {
            try {
                const { data, error } =
                    await supabase
                        .from("house_invitations")
                        .select(`
                            id,
                            house_id,
                            inviter_id,
                            invitee_id,
                            status,
                            created_at,
                            responded_at,
                            houses (
                                id,
                                name,
                                description,
                                house_type_id,
                                house_types (
                                    id,
                                    name
                                )
                            )
                        `)
                        .eq(
                            "invitee_id",
                            req.houseUserId
                        )
                        .order("created_at", {
                            ascending: false
                        });

                if (error) {
                    throw error;
                }

                res.json({
                    invitations: data || []
                });

            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error:
                        "Failed to load invitations."
                });
            }
        }
    );


    // ========================================================
    // SEND INVITATION
    // ========================================================

    router.post(
        "/houses/:id/invitations",
        requireHouseLogin,
        async (req, res) => {
            try {
                const houseId =
                    Number(req.params.id);

                const inviteeId =
                    String(
                        req.body?.userId || ""
                    );

                const admin =
                    await requireAdmin(
                        houseId,
                        req.houseUserId
                    );

                if (!admin) {
                    return res.status(403).json({
                        error:
                            "You do not have permission."
                    });
                }

                if (!inviteeId) {
                    return res.status(400).json({
                        error:
                            "User ID is required."
                    });
                }

                const existingMember =
                    await getMembership(
                        houseId,
                        inviteeId
                    );

                if (existingMember) {
                    return res.status(409).json({
                        error:
                            "That user is already a member."
                    });
                }

                const { data, error } =
                    await supabase
                        .from("house_invitations")
                        .insert({
                            house_id: houseId,
                            inviter_id:
                                req.houseUserId,
                            invitee_id: inviteeId,
                            status: "pending"
                        })
                        .select()
                        .single();

                if (error) {
                    throw error;
                }

                res.status(201).json({
                    invitation: data
                });

            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error:
                        "Failed to send invitation."
                });
            }
        }
    );


    // ========================================================
    // ACCEPT / DECLINE INVITATION
    // ========================================================

    router.post(
        "/houses/invitations/:id/respond",
        requireHouseLogin,
        async (req, res) => {
            try {
                const invitationId =
                    Number(req.params.id);

                const action =
                    String(
                        req.body?.action || ""
                    );

                if (
                    !["accepted", "declined"]
                        .includes(action)
                ) {
                    return res.status(400).json({
                        error:
                            "Invalid invitation action."
                    });
                }

                const { data: invitation, error } =
                    await supabase
                        .from("house_invitations")
                        .select("*")
                        .eq("id", invitationId)
                        .eq(
                            "invitee_id",
                            req.houseUserId
                        )
                        .eq("status", "pending")
                        .single();

                if (error || !invitation) {
                    return res.status(404).json({
                        error:
                            "Invitation not found."
                    });
                }

                if (action === "declined") {

                    const { error:
                        updateError } =
                        await supabase
                            .from(
                                "house_invitations"
                            )
                            .update({
                                status: "declined",
                                responded_at:
                                    new Date()
                                        .toISOString()
                            })
                            .eq(
                                "id",
                                invitationId
                            );

                    if (updateError) {
                        throw updateError;
                    }

                    return res.json({
                        success: true
                    });
                }


                /*
                 * ACCEPT
                 */

                const existingMember =
                    await getMembership(
                        invitation.house_id,
                        req.houseUserId
                    );

                if (!existingMember) {

                    const { error:
                        memberError } =
                        await supabase
                            .from(
                                "house_members"
                            )
                            .insert({
                                house_id:
                                    invitation.house_id,
                                user_id:
                                    req.houseUserId,
                                role: "member"
                            });

                    if (memberError) {
                        throw memberError;
                    }
                }

                const { error:
                    invitationError } =
                    await supabase
                        .from(
                            "house_invitations"
                        )
                        .update({
                            status: "accepted",
                            responded_at:
                                new Date()
                                    .toISOString()
                        })
                        .eq(
                            "id",
                            invitationId
                        );

                if (invitationError) {
                    throw invitationError;
                }

                res.json({
                    success: true,
                    houseId:
                        invitation.house_id
                });

            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error:
                        "Failed to respond to invitation."
                });
            }
        }
    );


    // ========================================================
    // ROOM
    // ========================================================

    router.get(
        "/houses/:houseId/rooms/:roomId",
        requireHouseLogin,
        async (req, res) => {
            try {
                const houseId =
                    Number(req.params.houseId);

                const roomId =
                    Number(req.params.roomId);

                const membership =
                    await requireMember(
                        houseId,
                        req.houseUserId
                    );

                if (!membership) {
                    return res.status(403).json({
                        error:
                            "You are not a member of this house."
                    });
                }

                const { data: room, error } =
                    await supabase
                        .from("house_rooms")
                        .select(`
                            id,
                            house_id,
                            name,
                            room_type,
                            description,
                            position,
                            created_at
                        `)
                        .eq("id", roomId)
                        .eq("house_id", houseId)
                        .single();

                if (error || !room) {
                    return res.status(404).json({
                        error: "Room not found."
                    });
                }

                const { data: messages,
                    error: messageError } =
                    await supabase
                        .from("house_messages")
                        .select(`
                            id,
                            room_id,
                            user_id,
                            content,
                            created_at,
                            updated_at,
                            profiles (
                                id,
                                username,
                                display_name,
                                avatar
                            ),
                            house_media (
                                id,
                                media_type,
                                file_name,
                                storage_path,
                                mime_type,
                                file_size,
                                created_at
                            )
                        `)
                        .eq("room_id", roomId)
                        .order("created_at", {
                            ascending: true
                        });

                if (messageError) {
                    throw messageError;
                }

                res.json({
                    room,
                    membership,
                    messages: messages || []
                });

            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error:
                        "Failed to load room."
                });
            }
        }
    );


    // ========================================================
    // SEND MESSAGE
    // ========================================================

    router.post(
        "/houses/:houseId/rooms/:roomId/messages",
        requireHouseLogin,
        async (req, res) => {
            try {
                const houseId =
                    Number(req.params.houseId);

                const roomId =
                    Number(req.params.roomId);

                const membership =
                    await requireMember(
                        houseId,
                        req.houseUserId
                    );

                if (!membership) {
                    return res.status(403).json({
                        error:
                            "You are not a member."
                    });
                }

                const content =
                    String(
                        req.body?.content || ""
                    ).trim();

                if (!content) {
                    return res.status(400).json({
                        error:
                            "Message cannot be empty."
                    });
                }

                const { data, error } =
                    await supabase
                        .from("house_messages")
                        .insert({
                            room_id: roomId,
                            user_id:
                                req.houseUserId,
                            content
                        })
                        .select(`
                            id,
                            room_id,
                            user_id,
                            content,
                            created_at,
                            profiles (
                                id,
                                username,
                                display_name,
                                avatar
                            )
                        `)
                        .single();

                if (error) {
                    throw error;
                }

                res.status(201).json({
                    message: data
                });

            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error:
                        "Failed to send message."
                });
            }
        }
    );


    // ========================================================
    // DELETE MESSAGE
    // ========================================================

    router.delete(
        "/houses/:houseId/messages/:messageId",
        requireHouseLogin,
        async (req, res) => {
            try {
                const houseId =
                    Number(req.params.houseId);

                const messageId =
                    Number(req.params.messageId);

                const membership =
                    await requireMember(
                        houseId,
                        req.houseUserId
                    );

                if (!membership) {
                    return res.status(403).json({
                        error:
                            "You are not a member."
                    });
                }

                const { data: message } =
                    await supabase
                        .from("house_messages")
                        .select(`
                            id,
                            user_id,
                            house_rooms (
                                house_id
                            )
                        `)
                        .eq("id", messageId)
                        .single();

                if (!message) {
                    return res.status(404).json({
                        error:
                            "Message not found."
                    });
                }

                const isOwner =
                    message.user_id ===
                    req.houseUserId;

                const isAdmin =
                    ["owner", "admin"]
                        .includes(
                            membership.role
                        );

                if (!isOwner && !isAdmin) {
                    return res.status(403).json({
                        error:
                            "You cannot delete this message."
                    });
                }

                const { error } =
                    await supabase
                        .from("house_messages")
                        .delete()
                        .eq("id", messageId);

                if (error) {
                    throw error;
                }

                res.json({
                    success: true
                });

            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error:
                        "Failed to delete message."
                });
            }
        }
    );


    // ========================================================
    // CREATE CALL
    // ========================================================

    router.post(
        "/houses/:houseId/rooms/:roomId/calls",
        requireHouseLogin,
        async (req, res) => {
            try {
                const houseId =
                    Number(req.params.houseId);

                const roomId =
                    Number(req.params.roomId);

                const callType =
                    String(
                        req.body?.type || ""
                    );

                if (
                    !["voice", "video"]
                        .includes(callType)
                ) {
                    return res.status(400).json({
                        error:
                            "Call type must be voice or video."
                    });
                }

                const membership =
                    await requireMember(
                        houseId,
                        req.houseUserId
                    );

                if (!membership) {
                    return res.status(403).json({
                        error:
                            "You are not a member."
                    });
                }

                /*
                 * Make sure there isn't already
                 * an active call in this room.
                 */

                const { data: existing } =
                    await supabase
                        .from("house_calls")
                        .select("id")
                        .eq("room_id", roomId)
                        .eq("active", true)
                        .maybeSingle();

                if (existing) {
                    return res.status(409).json({
                        error:
                            "A call is already active."
                    });
                }

                const { data: call, error } =
                    await supabase
                        .from("house_calls")
                        .insert({
                            room_id: roomId,
                            started_by:
                                req.houseUserId,
                            call_type: callType,
                            active: true
                        })
                        .select()
                        .single();

                if (error) {
                    throw error;
                }

                await supabase
                    .from(
                        "house_call_participants"
                    )
                    .insert({
                        call_id: call.id,
                        user_id:
                            req.houseUserId
                    });

                res.status(201).json({
                    call
                });

            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error:
                        "Failed to create call."
                });
            }
        }
    );


    // ========================================================
    // END CALL
    // ========================================================

    router.post(
        "/houses/calls/:callId/end",
        requireHouseLogin,
        async (req, res) => {
            try {
                const callId =
                    Number(req.params.callId);

                const { data: call, error } =
                    await supabase
                        .from("house_calls")
                        .select("*")
                        .eq("id", callId)
                        .single();

                if (error || !call) {
                    return res.status(404).json({
                        error: "Call not found."
                    });
                }

                const membership =
                    await getMembership(
                        await getRoomHouseId(
                            call.room_id
                        ),
                        req.houseUserId
                    );

                if (
                    !membership ||
                    !["owner", "admin"]
                        .includes(
                            membership.role
                        )
                ) {
                    return res.status(403).json({
                        error:
                            "You cannot end this call."
                    });
                }

                await supabase
                    .from("house_calls")
                    .update({
                        active: false
                    })
                    .eq("id", callId);

                res.json({
                    success: true
                });

            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error:
                        "Failed to end call."
                });
            }
        }
    );
    // ========================================================
    // UPLOAD ROOM MEDIA
    // ========================================================

    router.post(
        "/houses/:houseId/rooms/:roomId/media",
        requireHouseLogin,
        upload.single("file"),
        async (req, res) => {

            try {

                const houseId =
                    Number(req.params.houseId);

                const roomId =
                    Number(req.params.roomId);

                const membership =
                    await requireMember(
                        houseId,
                        req.houseUserId
                    );

                if (!membership) {
                    return res.status(403).json({
                        error:
                            "You are not a member of this house."
                    });
                }

                if (!req.file) {
                    return res.status(400).json({
                        error:
                            "No file was uploaded."
                    });
                }

                const mimeType =
                    req.file.mimetype.toLowerCase();

                let mediaType;

                if (mimeType.startsWith("image/")) {
                    mediaType = "image";
                }
                else if (mimeType.startsWith("video/")) {
                    mediaType = "video";
                }
                else if (mimeType.startsWith("audio/")) {
                    mediaType = "audio";
                }
                else {
                    return res.status(400).json({
                        error:
                            "Only images, videos, and audio files are allowed."
                    });
                }

                /*
                * Extra safety checks.
                */

                const allowedMimeTypes = new Set([
                    "image/jpeg",
                    "image/png",
                    "image/gif",
                    "image/webp",

                    "video/mp4",
                    "video/webm",
                    "video/ogg",

                    "audio/mpeg",
                    "audio/mp3",
                    "audio/wav",
                    "audio/ogg",
                    "audio/webm",
                    "audio/mp4",
                    "audio/aac"
                ]);

                if (!allowedMimeTypes.has(mimeType)) {
                    return res.status(400).json({
                        error:
                            "That file type is not supported."
                    });
                }

                /*
                * Make a safe-ish filename.
                */

                const originalName =
                    String(
                        req.file.originalname || "file"
                    )
                    .replace(/[^a-zA-Z0-9._-]/g, "_");

                const extension =
                    originalName.includes(".")
                        ? originalName.substring(
                            originalName.lastIndexOf(".")
                        )
                        : "";

                const storagePath =
                    `houses/${houseId}/rooms/${roomId}/` +
                    `${req.houseUserId}/` +
                    `${Date.now()}-${crypto.randomUUID()}${extension}`;


                /*
                * Upload to Supabase Storage.
                */

                const { error: uploadError } =
                    await supabase.storage
                        .from("house-media")
                        .upload(
                            storagePath,
                            req.file.buffer,
                            {
                                contentType: mimeType,
                                upsert: false
                            }
                        );

                if (uploadError) {
                    throw uploadError;
                }


                /*
                * Create the message first.
                */

                const content =
                    String(
                        req.body?.content || ""
                    ).trim();

                const {
                    data: message,
                    error: messageError
                } = await supabase
                    .from("house_messages")
                    .insert({
                        room_id: roomId,
                        user_id:
                            req.houseUserId,
                        content
                    })
                    .select(`
                        id,
                        room_id,
                        user_id,
                        content,
                        created_at,
                        updated_at,
                        profiles (
                            id,
                            username,
                            display_name,
                            avatar
                        )
                    `)
                    .single();

                if (messageError) {

                    /*
                    * Clean up the uploaded file if
                    * creating the message failed.
                    */

                    await supabase.storage
                        .from("house-media")
                        .remove([
                            storagePath
                        ]);

                    throw messageError;
                }


                /*
                * Save media metadata.
                */

                const {
                    data: media,
                    error: mediaError
                } = await supabase
                    .from("house_media")
                    .insert({
                        room_id: roomId,
                        user_id:
                            req.houseUserId,
                        message_id:
                            message.id,
                        media_type:
                            mediaType,
                        file_name:
                            originalName,
                        storage_path:
                            storagePath,
                        mime_type:
                            mimeType,
                        file_size:
                            req.file.size
                    })
                    .select()
                    .single();

                if (mediaError) {

                    await supabase
                        .from("house_messages")
                        .delete()
                        .eq(
                            "id",
                            message.id
                        );

                    await supabase.storage
                        .from("house-media")
                        .remove([
                            storagePath
                        ]);

                    throw mediaError;
                }


                /*
                * Generate the public URL.
                */

                const {
                    data: publicUrlData
                } = supabase.storage
                    .from("house-media")
                    .getPublicUrl(
                        storagePath
                    );

                res.status(201).json({
                    message: {
                        ...message,
                        house_media: [
                            media
                        ]
                    },

                    media,

                    url:
                        publicUrlData.publicUrl
                });

            } catch (error) {

                console.error(
                    "House media upload error:",
                    error
                );

                res.status(500).json({
                    error:
                        "Failed to upload media."
                });
            }
        }
    );
    router.get(
        "/api/houses/:houseId/rooms/:roomId",
        async (req, res) => {
            const userId = requireHouseLogin(req, res);

            if (!userId) return;

            const houseId = Number(req.params.houseId);
            const roomId = Number(req.params.roomId);

            if (
                !Number.isInteger(houseId) ||
                !Number.isInteger(roomId) ||
                houseId <= 0 ||
                roomId <= 0
            ) {
                return res.status(400).json({
                    error: "Invalid House or room ID."
                });
            }

            try {
                // Get house
                const { data: house, error: houseError } =
                    await supabase
                        .from("houses")
                        .select(`
                            id,
                            name,
                            description,
                            owner_id,
                            house_type_id,
                            created_at,
                            updated_at,
                            house_types (
                                id,
                                name,
                                cost,
                                tax_reduction,
                                room_count
                            )
                        `)
                        .eq("id", houseId)
                        .maybeSingle();

                if (houseError) throw houseError;

                if (!house) {
                    return res.status(404).json({
                        error: "House not found."
                    });
                }

                // Get room
                const { data: room, error: roomError } =
                    await supabase
                        .from("house_rooms")
                        .select(`
                            id,
                            house_id,
                            name,
                            room_type,
                            description,
                            position,
                            created_at,
                            updated_at
                        `)
                        .eq("id", roomId)
                        .eq("house_id", houseId)
                        .maybeSingle();

                if (roomError) throw roomError;

                if (!room) {
                    return res.status(404).json({
                        error: "Room not found."
                    });
                }

                // Get members
                const members = await getHouseMembers(houseId);

                const membership =
                    members.find(
                        member => member.user_id === userId
                    ) || (
                        house.owner_id === userId
                            ? {
                                house_id: houseId,
                                user_id: userId,
                                role: "owner"
                            }
                            : null
                    );

                // Must be a member to access the room
                if (!membership) {
                    return res.status(403).json({
                        error: "You are not a member of this house."
                    });
                }

                const canManageAccess =
                    ["owner", "admin"].includes(
                        membership.role
                    );

                res.json({
                    house,
                    room,
                    members,
                    membership,
                    canAccess: true,
                    canManageAccess,
                    houseType: house.house_types
                });

            } catch (error) {
                console.error(
                    "ROOM DETAILS ERROR:",
                    error
                );

                res.status(500).json({
                    error: "Failed to load room."
                });
            }
        }
    );
    async function getRoomHouseId(roomId) {
        const { data, error } =
            await supabase
                .from("house_rooms")
                .select("house_id")
                .eq("id", roomId)
                .single();

        if (error) {
            throw error;
        }

        return data.house_id;
    }


    return router;
};