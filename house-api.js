
// ============================================================
// SHREKBOOK HOUSES API
// ============================================================

const express = require("express");
const router = express.Router();
const multer = require("multer");
const crypto = require("crypto");

// ------------------------------------------------------------
// MULTER
// ------------------------------------------------------------

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 100 * 1024 * 1024
    }
});

// ------------------------------------------------------------
// ROUTER FACTORY
// ------------------------------------------------------------

module.exports = function createHouseRouter({ supabase }) {

    // ========================================================
    // AUTH
    // ========================================================

    function requireHouseLogin(req, res, next) {
        if (req.session && req.session.user) {
            return req.session.user.id;
        }

        return null;
    }
    // ========================================================
    // HELPERS
    // ========================================================

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

    async function getMembership(houseId, userId) {
        const { data, error } = await supabase
            .from("house_members")
            .select(`
                id,
                house_id,
                user_id,
                role,
                joined_at
            `)
            .eq("house_id", houseId)
            .eq("user_id", userId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return data;
    }

    async function isHouseMember(houseId, userId) {
        const membership = await getMembership(houseId, userId);
        return !!membership;
    }

    async function isHouseAdmin(houseId, userId) {
        const membership = await getMembership(houseId, userId);

        if (!membership) {
            return false;
        }

        return (
            membership.role === "owner" ||
            membership.role === "admin"
        );
    }

    async function getRoomHouseId(roomId) {
        const { data, error } = await supabase
            .from("house_rooms")
            .select("house_id")
            .eq("id", roomId)
            .single();

        if (error) {
            throw error;
        }

        return data.house_id;
    }

    function getExtension(fileName) {
        const dot = fileName.lastIndexOf(".");

        if (dot === -1) {
            return "";
        }

        return fileName.substring(dot).toLowerCase();
    }

    function getMediaType(mimeType) {
        if (mimeType.startsWith("image/")) {
            return "image";
        }

        if (mimeType.startsWith("video/")) {
            return "video";
        }

        if (mimeType.startsWith("audio/")) {
            return "audio";
        }

        return null;
    }

    function isAllowedMediaType(mimeType) {
        const allowed = [
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
        ];

        return allowed.includes(mimeType);
    }

    async function attachMediaUrls(messages) {
        if (!messages || !messages.length) {
            return messages || [];
        }

        for (const message of messages) {
            if (!message.house_media) {
                message.house_media = [];
                continue;
            }

            for (const media of message.house_media) {
                const { data } = supabase.storage
                    .from("house-media")
                    .getPublicUrl(media.storage_path);

                media.url = data?.publicUrl || null;
            }
        }

        return messages;
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

                res.json(data || []);

            } catch (error) {
                console.error("House types error:", error);

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
            const userId = req.houseUserId;

            try {
                const {
                    name,
                    description = "",
                    house_type_id
                } = req.body;

                if (!name || !name.trim()) {
                    return res.status(400).json({
                        error: "House name is required."
                    });
                }

                if (!house_type_id) {
                    return res.status(400).json({
                        error: "House type is required."
                    });
                }

                // ------------------------------------------------
                // Get house type
                // ------------------------------------------------

                const { data: houseType, error: houseTypeError } =
                    await supabase
                        .from("house_types")
                        .select(`
                            id,
                            name,
                            cost,
                            tax_reduction,
                            room_count
                        `)
                        .eq("id", house_type_id)
                        .single();

                if (houseTypeError || !houseType) {
                    return res.status(400).json({
                        error: "Invalid house type."
                    });
                }

                // ------------------------------------------------
                // Get current user
                // ------------------------------------------------

                const { data: profile, error: profileError } =
                    await supabase
                        .from("profiles")
                        .select(`
                            id,
                            shrekcoins
                        `)
                        .eq("id", userId)
                        .single();

                if (profileError || !profile) {
                    return res.status(404).json({
                        error: "Profile not found."
                    });
                }

                const currentCoins = Number(profile.shrekcoins || 0);
                const cost = Number(houseType.cost || 0);

                if (currentCoins < cost) {
                    return res.status(400).json({
                        error: `You need ${cost} ShrekCoins to buy this house.`
                    });
                }

                // ------------------------------------------------
                // Charge ShrekCoins
                // ------------------------------------------------

                const newBalance = currentCoins - cost;

                const { error: coinError } = await supabase
                    .from("profiles")
                    .update({
                        shrekcoins: newBalance
                    })
                    .eq("id", userId);

                if (coinError) {
                    throw coinError;
                }

                // ------------------------------------------------
                // Create house
                // ------------------------------------------------

                const { data: house, error: houseError } =
                    await supabase
                        .from("houses")
                        .insert({
                            name: name.trim(),
                            description: description || "",
                            owner_id: userId,
                            house_type_id: houseType.id
                        })
                        .select(`
                            id,
                            name,
                            description,
                            owner_id,
                            house_type_id,
                            created_at
                        `)
                        .single();

                if (houseError) {

                    // Refund if house creation fails
                    await supabase
                        .from("profiles")
                        .update({
                            shrekcoins: currentCoins
                        })
                        .eq("id", userId);

                    throw houseError;
                }

                // ------------------------------------------------
                // Add owner
                // ------------------------------------------------

                const { error: memberError } =
                    await supabase
                        .from("house_members")
                        .insert({
                            house_id: house.id,
                            user_id: userId,
                            role: "owner"
                        });

                if (memberError) {

                    await supabase
                        .from("houses")
                        .delete()
                        .eq("id", house.id);

                    await supabase
                        .from("profiles")
                        .update({
                            shrekcoins: currentCoins
                        })
                        .eq("id", userId);

                    throw memberError;
                }

                // ------------------------------------------------
                // Create default rooms
                // ------------------------------------------------

                const defaultRooms = [
                    {
                        name: "General",
                        room_type: "general",
                        description: "General house discussion.",
                        position: 0
                    },
                    {
                        name: "Chat",
                        room_type: "chat",
                        description: "Talk with house members.",
                        position: 1
                    }
                ];

                if (houseType.room_count >= 3) {
                    defaultRooms.push({
                        name: "Media",
                        room_type: "media",
                        description: "Share images, videos, and audio.",
                        position: 2
                    });
                }

                if (houseType.room_count >= 4) {
                    defaultRooms.push({
                        name: "Voice",
                        room_type: "voice",
                        description: "Voice chat room.",
                        position: 3
                    });
                }

                if (houseType.room_count >= 5) {
                    defaultRooms.push({
                        name: "Video",
                        room_type: "video",
                        description: "Video chat room.",
                        position: 4
                    });
                }

                while (defaultRooms.length < houseType.room_count) {
                    defaultRooms.push({
                        name: `Room ${defaultRooms.length + 1}`,
                        room_type: "chat",
                        description: "",
                        position: defaultRooms.length
                    });
                }

                const roomsToInsert = defaultRooms
                    .slice(0, houseType.room_count)
                    .map(room => ({
                        house_id: house.id,
                        name: room.name,
                        room_type: room.room_type,
                        description: room.description,
                        position: room.position
                    }));

                const { error: roomsError } =
                    await supabase
                        .from("house_rooms")
                        .insert(roomsToInsert);

                if (roomsError) {
                    console.error("Room creation error:", roomsError);
                }

                res.status(201).json({
                    success: true,
                    house,
                    house_type: houseType,
                    shrekcoins_remaining: newBalance
                });

            } catch (error) {
                console.error("Create house error:", error);

                res.status(500).json({
                    error: "Failed to create house."
                });
            }
        }
    );

    // ========================================================
    // HOUSE DIRECTORY
    // ========================================================

    router.get(
        "/houses",
        requireHouseLogin,
        async (req, res) => {
            try {
                const { data: houses, error } =
                    await supabase
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

                if (error) {
                    throw error;
                }

                if (!houses || !houses.length) {
                    return res.json([]);
                }

                const ownerIds = [
                    ...new Set(
                        houses.map(house => house.owner_id)
                    )
                ];

                const { data: owners } = await supabase
                    .from("profiles")
                    .select(`
                        id,
                        username,
                        display_name,
                        avatar_url
                    `)
                    .in("id", ownerIds);

                const ownerMap = {};

                for (const owner of owners || []) {
                    ownerMap[owner.id] = owner;
                }

                const houseIds = houses.map(
                    house => house.id
                );

                const { data: members } = await supabase
                    .from("house_members")
                    .select(`
                        house_id,
                        user_id,
                        role
                    `)
                    .in("house_id", houseIds);

                const memberCounts = {};

                for (const member of members || []) {
                    memberCounts[member.house_id] =
                        (memberCounts[member.house_id] || 0) + 1;
                }

                const result = houses.map(house => ({
                    ...house,

                    owner:
                        ownerMap[house.owner_id] || null,

                    member_count:
                        memberCounts[house.id] || 0
                }));

                res.json(result);

            } catch (error) {
                console.error("House directory error:", error);

                res.status(500).json({
                    error: "Failed to load houses."
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
                const houseId = req.params.id;

                const house = await getHouse(houseId);

                if (!house) {
                    return res.status(404).json({
                        error: "House not found."
                    });
                }

                const membership =
                    await getMembership(
                        houseId,
                        req.houseUserId
                    );

                if (!membership) {
                    return res.status(403).json({
                        error: "You are not a member of this house."
                    });
                }

                // ------------------------------------------------
                // Rooms
                // ------------------------------------------------

                const { data: rooms, error: roomsError } =
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
                        .eq("house_id", houseId)
                        .order("position", {
                            ascending: true
                        });

                if (roomsError) {
                    throw roomsError;
                }

                // ------------------------------------------------
                // Members
                // ------------------------------------------------

                const { data: members, error: membersError } =
                    await supabase
                        .from("house_members")
                        .select(`
                            id,
                            house_id,
                            user_id,
                            role,
                            joined_at
                        `)
                        .eq("house_id", houseId)
                        .order("joined_at", {
                            ascending: true
                        });

                if (membersError) {
                    throw membersError;
                }

                const memberUserIds = [
                    ...new Set(
                        (members || []).map(
                            member => member.user_id
                        )
                    )
                ];

                let profiles = [];

                if (memberUserIds.length) {
                    const { data: profileData } =
                        await supabase
                            .from("profiles")
                            .select(`
                                id,
                                username,
                                display_name,
                                avatar_url
                            `)
                            .in("id", memberUserIds);

                    profiles = profileData || [];
                }

                const profileMap = {};

                for (const profile of profiles) {
                    profileMap[profile.id] = profile;
                }

                const enrichedMembers =
                    (members || []).map(member => ({
                        ...member,
                        profile:
                            profileMap[member.user_id] || null
                    }));

                res.json({
                    house,
                    membership,
                    rooms: rooms || [],
                    members: enrichedMembers
                });

            } catch (error) {
                console.error("Get house error:", error);

                res.status(500).json({
                    error: "Failed to load house."
                });
            }
        }
    );

    // ========================================================
    // HOUSE INVITATIONS
    // ========================================================

    router.get(
        "/houses/invitations",
        requireHouseLogin,
        async (req, res) => {
            try {
                const userId = req.houseUserId;

                const { data: invitations, error } =
                    await supabase
                        .from("house_invitations")
                        .select(`
                            id,
                            house_id,
                            inviter_id,
                            invitee_id,
                            status,
                            created_at,
                            responded_at
                        `)
                        .eq("invitee_id", userId)
                        .order("created_at", {
                            ascending: false
                        });

                if (error) {
                    throw error;
                }

                const houseIds = [
                    ...new Set(
                        (invitations || []).map(
                            invitation => invitation.house_id
                        )
                    )
                ];

                const inviterIds = [
                    ...new Set(
                        (invitations || []).map(
                            invitation => invitation.inviter_id
                        )
                    )
                ];

                let houses = [];
                let inviters = [];

                if (houseIds.length) {
                    const { data } =
                        await supabase
                            .from("houses")
                            .select(`
                                id,
                                name,
                                description,
                                house_type_id
                            `)
                            .in("id", houseIds);

                    houses = data || [];
                }

                if (inviterIds.length) {
                    const { data } =
                        await supabase
                            .from("profiles")
                            .select(`
                                id,
                                username,
                                display_name,
                                avatar_url
                            `)
                            .in("id", inviterIds);

                    inviters = data || [];
                }

                const houseMap = {};
                const inviterMap = {};

                for (const house of houses) {
                    houseMap[house.id] = house;
                }

                for (const inviter of inviters) {
                    inviterMap[inviter.id] = inviter;
                }

                const result =
                    (invitations || []).map(invitation => ({
                        ...invitation,
                        house:
                            houseMap[invitation.house_id] || null,
                        inviter:
                            inviterMap[invitation.inviter_id] || null
                    }));

                res.json(result);

            } catch (error) {
                console.error(
                    "House invitations error:",
                    error
                );

                res.status(500).json({
                    error: "Failed to load invitations."
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
                const houseId = req.params.id;
                const inviterId = req.houseUserId;

                const {
                    invitee_id
                } = req.body;

                if (!invitee_id) {
                    return res.status(400).json({
                        error: "Invitee is required."
                    });
                }

                if (invitee_id === inviterId) {
                    return res.status(400).json({
                        error: "You cannot invite yourself."
                    });
                }

                const house = await getHouse(houseId);

                if (!house) {
                    return res.status(404).json({
                        error: "House not found."
                    });
                }

                const isAdmin =
                    await isHouseAdmin(
                        houseId,
                        inviterId
                    );

                if (!isAdmin) {
                    return res.status(403).json({
                        error:
                            "Only the owner or an admin can invite people."
                    });
                }

                // Check invitee exists
                const { data: invitee } =
                    await supabase
                        .from("profiles")
                        .select("id")
                        .eq("id", invitee_id)
                        .maybeSingle();

                if (!invitee) {
                    return res.status(404).json({
                        error: "User not found."
                    });
                }

                // Already a member?
                const alreadyMember =
                    await isHouseMember(
                        houseId,
                        invitee_id
                    );

                if (alreadyMember) {
                    return res.status(400).json({
                        error:
                            "That user is already a member of this house."
                    });
                }

                // Existing pending invitation?
                const { data: existingInvitation } =
                    await supabase
                        .from("house_invitations")
                        .select("id")
                        .eq("house_id", houseId)
                        .eq("invitee_id", invitee_id)
                        .eq("status", "pending")
                        .maybeSingle();

                if (existingInvitation) {
                    return res.status(400).json({
                        error:
                            "That user already has a pending invitation."
                    });
                }

                const { data: invitation, error } =
                    await supabase
                        .from("house_invitations")
                        .insert({
                            house_id: houseId,
                            inviter_id: inviterId,
                            invitee_id,
                            status: "pending"
                        })
                        .select()
                        .single();

                if (error) {
                    throw error;
                }

                res.status(201).json({
                    success: true,
                    invitation
                });

            } catch (error) {
                console.error(
                    "Send house invitation error:",
                    error
                );

                res.status(500).json({
                    error: "Failed to send invitation."
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
                const invitationId = req.params.id;
                const userId = req.houseUserId;

                const {
                    response
                } = req.body;

                if (
                    response !== "accepted" &&
                    response !== "declined"
                ) {
                    return res.status(400).json({
                        error:
                            "Response must be accepted or declined."
                    });
                }

                const { data: invitation, error } =
                    await supabase
                        .from("house_invitations")
                        .select(`
                            id,
                            house_id,
                            inviter_id,
                            invitee_id,
                            status
                        `)
                        .eq("id", invitationId)
                        .single();

                if (error || !invitation) {
                    return res.status(404).json({
                        error: "Invitation not found."
                    });
                }

                if (invitation.invitee_id !== userId) {
                    return res.status(403).json({
                        error:
                            "You cannot respond to this invitation."
                    });
                }

                if (invitation.status !== "pending") {
                    return res.status(400).json({
                        error:
                            "This invitation has already been answered."
                    });
                }

                // ------------------------------------------------
                // DECLINE
                // ------------------------------------------------

                if (response === "declined") {
                    const { data: updated, error: updateError } =
                        await supabase
                            .from("house_invitations")
                            .update({
                                status: "declined",
                                responded_at:
                                    new Date().toISOString()
                            })
                            .eq("id", invitationId)
                            .select()
                            .single();

                    if (updateError) {
                        throw updateError;
                    }

                    return res.json({
                        success: true,
                        invitation: updated
                    });
                }

                // ------------------------------------------------
                // ACCEPT
                // ------------------------------------------------

                const alreadyMember =
                    await isHouseMember(
                        invitation.house_id,
                        userId
                    );

                if (!alreadyMember) {
                    const { error: memberError } =
                        await supabase
                            .from("house_members")
                            .insert({
                                house_id: invitation.house_id,
                                user_id: userId,
                                role: "member"
                            });

                    if (memberError) {
                        throw memberError;
                    }
                }

                const { data: updated, error: updateError } =
                    await supabase
                        .from("house_invitations")
                        .update({
                            status: "accepted",
                            responded_at:
                                new Date().toISOString()
                        })
                        .eq("id", invitationId)
                        .select()
                        .single();

                if (updateError) {
                    throw updateError;
                }

                res.json({
                    success: true,
                    invitation: updated
                });

            } catch (error) {
                console.error(
                    "Respond to house invitation error:",
                    error
                );

                res.status(500).json({
                    error:
                        "Failed to respond to invitation."
                });
            }
        }
    );

    // ========================================================
    // GET ROOM
    // ========================================================

    router.get(
        "/houses/:houseId/rooms/:roomId",
        requireHouseLogin,
        async (req, res) => {
            try {
                const houseId = req.params.houseId;
                const roomId = req.params.roomId;
                const userId = req.houseUserId;

                // ------------------------------------------------
                // Membership
                // ------------------------------------------------

                const member =
                    await isHouseMember(
                        houseId,
                        userId
                    );

                if (!member) {
                    return res.status(403).json({
                        error:
                            "You are not a member of this house."
                    });
                }

                // ------------------------------------------------
                // Room
                // ------------------------------------------------

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
                        .single();

                if (roomError || !room) {
                    return res.status(404).json({
                        error: "Room not found."
                    });
                }

                // ------------------------------------------------
                // Messages
                // ------------------------------------------------

                const { data: messages, error: messagesError } =
                    await supabase
                        .from("house_messages")
                        .select(`
                            id,
                            room_id,
                            user_id,
                            content,
                            created_at,
                            updated_at,
                            house_media (
                                id,
                                room_id,
                                user_id,
                                message_id,
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

                if (messagesError) {
                    throw messagesError;
                }

                // Add public URLs to media
                await attachMediaUrls(messages || []);

                // ------------------------------------------------
                // Message profiles
                // ------------------------------------------------

                const userIds = [
                    ...new Set(
                        (messages || []).map(
                            message => message.user_id
                        )
                    )
                ];

                let profiles = [];

                if (userIds.length) {
                    const { data } =
                        await supabase
                            .from("profiles")
                            .select(`
                                id,
                                username,
                                display_name,
                                avatar_url
                            `)
                            .in("id", userIds);

                    profiles = data || [];
                }

                const profileMap = {};

                for (const profile of profiles) {
                    profileMap[profile.id] = profile;
                }

                const enrichedMessages =
                    (messages || []).map(message => ({
                        ...message,
                        profile:
                            profileMap[message.user_id] || null
                    }));

                res.json({
                    room,
                    messages: enrichedMessages
                });

            } catch (error) {
                console.error(
                    "Get house room error:",
                    error
                );

                res.status(500).json({
                    error:
                        "Failed to load house room."
                });
            }
        }
    );

    // ========================================================
    // SEND TEXT MESSAGE
    // ========================================================

    router.post(
        "/houses/:houseId/rooms/:roomId/messages",
        requireHouseLogin,
        async (req, res) => {
            try {
                const houseId = req.params.houseId;
                const roomId = req.params.roomId;
                const userId = req.houseUserId;

                const content =
                    typeof req.body.content === "string"
                        ? req.body.content.trim()
                        : "";

                if (!content) {
                    return res.status(400).json({
                        error: "Message cannot be empty."
                    });
                }

                if (content.length > 10000) {
                    return res.status(400).json({
                        error:
                            "Message is too long."
                    });
                }

                const member =
                    await isHouseMember(
                        houseId,
                        userId
                    );

                if (!member) {
                    return res.status(403).json({
                        error:
                            "You are not a member of this house."
                    });
                }

                const actualHouseId =
                    await getRoomHouseId(roomId);

                if (
                    String(actualHouseId) !==
                    String(houseId)
                ) {
                    return res.status(404).json({
                        error: "Room not found."
                    });
                }

                const { data: message, error } =
                    await supabase
                        .from("house_messages")
                        .insert({
                            room_id: roomId,
                            user_id: userId,
                            content
                        })
                        .select(`
                            id,
                            room_id,
                            user_id,
                            content,
                            created_at,
                            updated_at
                        `)
                        .single();

                if (error) {
                    throw error;
                }

                res.status(201).json({
                    success: true,
                    message
                });

            } catch (error) {
                console.error(
                    "Send house message error:",
                    error
                );

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
                const houseId = req.params.houseId;
                const messageId = req.params.messageId;
                const userId = req.houseUserId;

                const { data: message, error } =
                    await supabase
                        .from("house_messages")
                        .select(`
                            id,
                            room_id,
                            user_id
                        `)
                        .eq("id", messageId)
                        .single();

                if (error || !message) {
                    return res.status(404).json({
                        error: "Message not found."
                    });
                }

                const messageHouseId =
                    await getRoomHouseId(
                        message.room_id
                    );

                if (
                    String(messageHouseId) !==
                    String(houseId)
                ) {
                    return res.status(404).json({
                        error: "Message not found."
                    });
                }

                const admin =
                    await isHouseAdmin(
                        houseId,
                        userId
                    );

                const isOwner =
                    message.user_id === userId;

                if (!admin && !isOwner) {
                    return res.status(403).json({
                        error:
                            "You do not have permission to delete this message."
                    });
                }

                // ------------------------------------------------
                // Get media before deleting the message
                // ------------------------------------------------

                const { data: media } =
                    await supabase
                        .from("house_media")
                        .select(`
                            storage_path
                        `)
                        .eq("message_id", messageId);

                // ------------------------------------------------
                // Delete database message
                // ------------------------------------------------

                const { error: deleteError } =
                    await supabase
                        .from("house_messages")
                        .delete()
                        .eq("id", messageId);

                if (deleteError) {
                    throw deleteError;
                }

                // ------------------------------------------------
                // Delete storage files
                // ------------------------------------------------

                if (media && media.length) {
                    const paths = media
                        .map(item => item.storage_path)
                        .filter(Boolean);

                    if (paths.length) {
                        await supabase.storage
                            .from("house-media")
                            .remove(paths);
                    }
                }

                res.json({
                    success: true
                });

            } catch (error) {
                console.error(
                    "Delete house message error:",
                    error
                );

                res.status(500).json({
                    error:
                        "Failed to delete message."
                });
            }
        }
    );

    // ========================================================
    // MEDIA UPLOAD
    // ========================================================

    router.post(
        "/houses/:houseId/rooms/:roomId/media",
        requireHouseLogin,
        upload.single("file"),
        async (req, res) => {
            try {
                const houseId = req.params.houseId;
                const roomId = req.params.roomId;
                const userId = req.houseUserId;

                // ------------------------------------------------
                // File check
                // ------------------------------------------------

                if (!req.file) {
                    return res.status(400).json({
                        error: "No file uploaded."
                    });
                }

                if (!isAllowedMediaType(req.file.mimetype)) {
                    return res.status(400).json({
                        error:
                            "This file type is not supported."
                    });
                }

                const mediaType =
                    getMediaType(req.file.mimetype);

                if (!mediaType) {
                    return res.status(400).json({
                        error:
                            "Unable to determine media type."
                    });
                }

                // ------------------------------------------------
                // Membership
                // ------------------------------------------------

                const member =
                    await isHouseMember(
                        houseId,
                        userId
                    );

                if (!member) {
                    return res.status(403).json({
                        error:
                            "You are not a member of this house."
                    });
                }

                // ------------------------------------------------
                // Verify room belongs to house
                // ------------------------------------------------

                const actualHouseId =
                    await getRoomHouseId(roomId);

                if (
                    String(actualHouseId) !==
                    String(houseId)
                ) {
                    return res.status(404).json({
                        error: "Room not found."
                    });
                }

                // ------------------------------------------------
                // Storage path
                // ------------------------------------------------

                const extension =
                    getExtension(
                        req.file.originalname
                    );

                const safeFileName =
                    `${Date.now()}-${crypto.randomUUID()}${extension}`;

                const storagePath =
                    `houses/${houseId}/rooms/${roomId}/${userId}/${safeFileName}`;

                // ------------------------------------------------
                // Upload to Supabase Storage
                // ------------------------------------------------

                const { error: uploadError } =
                    await supabase.storage
                        .from("house-media")
                        .upload(
                            storagePath,
                            req.file.buffer,
                            {
                                contentType:
                                    req.file.mimetype,
                                upsert: false
                            }
                        );

                if (uploadError) {
                    throw uploadError;
                }

                // ------------------------------------------------
                // Optional text attached to media
                // ------------------------------------------------

                const content =
                    typeof req.body.content === "string"
                        ? req.body.content.trim()
                        : "";

                if (content.length > 10000) {
                    // Remove uploaded file if message
                    // validation fails.
                    await supabase.storage
                        .from("house-media")
                        .remove([storagePath]);

                    return res.status(400).json({
                        error:
                            "Message is too long."
                    });
                }

                // ------------------------------------------------
                // Create message
                // ------------------------------------------------

                const { data: message, error: messageError } =
                    await supabase
                        .from("house_messages")
                        .insert({
                            room_id: roomId,
                            user_id: userId,
                            content
                        })
                        .select(`
                            id,
                            room_id,
                            user_id,
                            content,
                            created_at,
                            updated_at
                        `)
                        .single();

                if (messageError) {
                    await supabase.storage
                        .from("house-media")
                        .remove([storagePath]);

                    throw messageError;
                }

                // ------------------------------------------------
                // Create media record
                // ------------------------------------------------

                const { data: media, error: mediaError } =
                    await supabase
                        .from("house_media")
                        .insert({
                            room_id: roomId,
                            user_id: userId,
                            message_id: message.id,
                            media_type: mediaType,
                            file_name:
                                req.file.originalname,
                            storage_path:
                                storagePath,
                            mime_type:
                                req.file.mimetype,
                            file_size:
                                req.file.size
                        })
                        .select(`
                            id,
                            room_id,
                            user_id,
                            message_id,
                            media_type,
                            file_name,
                            storage_path,
                            mime_type,
                            file_size,
                            created_at
                        `)
                        .single();

                if (mediaError) {
                    // Remove database message
                    await supabase
                        .from("house_messages")
                        .delete()
                        .eq("id", message.id);

                    // Remove storage file
                    await supabase.storage
                        .from("house-media")
                        .remove([storagePath]);

                    throw mediaError;
                }

                // ------------------------------------------------
                // Public URL
                // ------------------------------------------------

                const { data: publicUrlData } =
                    supabase.storage
                        .from("house-media")
                        .getPublicUrl(storagePath);

                media.url =
                    publicUrlData?.publicUrl || null;

                res.status(201).json({
                    success: true,
                    message,
                    media
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

    // ========================================================
    // CREATE CALL
    // ========================================================

    router.post(
        "/houses/:houseId/rooms/:roomId/calls",
        requireHouseLogin,
        async (req, res) => {
            try {
                const houseId = req.params.houseId;
                const roomId = req.params.roomId;
                const userId = req.houseUserId;

                const {
                    call_type
                } = req.body;

                if (
                    call_type !== "voice" &&
                    call_type !== "video"
                ) {
                    return res.status(400).json({
                        error:
                            "Call type must be voice or video."
                    });
                }

                const member =
                    await isHouseMember(
                        houseId,
                        userId
                    );

                if (!member) {
                    return res.status(403).json({
                        error:
                            "You are not a member of this house."
                    });
                }

                const actualHouseId =
                    await getRoomHouseId(roomId);

                if (
                    String(actualHouseId) !==
                    String(houseId)
                ) {
                    return res.status(404).json({
                        error: "Room not found."
                    });
                }

                // ------------------------------------------------
                // Check existing active call
                // ------------------------------------------------

                const { data: existingCall } =
                    await supabase
                        .from("house_calls")
                        .select(`
                            id,
                            room_id,
                            started_by,
                            call_type,
                            active,
                            created_at
                        `)
                        .eq("room_id", roomId)
                        .eq("active", true)
                        .maybeSingle();

                if (existingCall) {
                    return res.json({
                        success: true,
                        call: existingCall
                    });
                }

                // ------------------------------------------------
                // Create call
                // ------------------------------------------------

                const { data: call, error } =
                    await supabase
                        .from("house_calls")
                        .insert({
                            room_id: roomId,
                            started_by: userId,
                            call_type,
                            active: true
                        })
                        .select(`
                            id,
                            room_id,
                            started_by,
                            call_type,
                            active,
                            created_at
                        `)
                        .single();

                if (error) {
                    throw error;
                }

                // ------------------------------------------------
                // Add creator as participant
                // ------------------------------------------------

                const { error: participantError } =
                    await supabase
                        .from("house_call_participants")
                        .insert({
                            call_id: call.id,
                            user_id: userId
                        });

                if (participantError) {
                    await supabase
                        .from("house_calls")
                        .delete()
                        .eq("id", call.id);

                    throw participantError;
                }

                res.status(201).json({
                    success: true,
                    call
                });

            } catch (error) {
                console.error(
                    "Create house call error:",
                    error
                );

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
                const callId = req.params.callId;
                const userId = req.houseUserId;

                const { data: call, error } =
                    await supabase
                        .from("house_calls")
                        .select(`
                            id,
                            room_id,
                            started_by,
                            active
                        `)
                        .eq("id", callId)
                        .single();

                if (error || !call) {
                    return res.status(404).json({
                        error: "Call not found."
                    });
                }

                const houseId =
                    await getRoomHouseId(
                        call.room_id
                    );

                const admin =
                    await isHouseAdmin(
                        houseId,
                        userId
                    );

                if (
                    call.started_by !== userId &&
                    !admin
                ) {
                    return res.status(403).json({
                        error:
                            "You do not have permission to end this call."
                    });
                }

                const { error: updateError } =
                    await supabase
                        .from("house_calls")
                        .update({
                            active: false
                        })
                        .eq("id", callId);

                if (updateError) {
                    throw updateError;
                }

                // Mark participants as having left
                await supabase
                    .from("house_call_participants")
                    .update({
                        left_at:
                            new Date().toISOString()
                    })
                    .eq("call_id", callId)
                    .is("left_at", null);

                res.json({
                    success: true
                });

            } catch (error) {
                console.error(
                    "End house call error:",
                    error
                );

                res.status(500).json({
                    error:
                        "Failed to end call."
                });
            }
        }
    );

    // ========================================================
    // JOIN CALL
    // ========================================================

    router.post(
        "/houses/calls/:callId/join",
        requireHouseLogin,
        async (req, res) => {
            try {
                const callId = req.params.callId;
                const userId = req.houseUserId;

                const { data: call, error } =
                    await supabase
                        .from("house_calls")
                        .select(`
                            id,
                            room_id,
                            started_by,
                            call_type,
                            active,
                            created_at
                        `)
                        .eq("id", callId)
                        .single();

                if (error || !call) {
                    return res.status(404).json({
                        error: "Call not found."
                    });
                }

                if (!call.active) {
                    return res.status(400).json({
                        error: "This call has ended."
                    });
                }

                const houseId =
                    await getRoomHouseId(
                        call.room_id
                    );

                const member =
                    await isHouseMember(
                        houseId,
                        userId
                    );

                if (!member) {
                    return res.status(403).json({
                        error:
                            "You are not a member of this house."
                    });
                }

                // ------------------------------------------------
                // Add participant if not already there
                // ------------------------------------------------

                const { data: existingParticipant } =
                    await supabase
                        .from("house_call_participants")
                        .select(`
                            id,
                            call_id,
                            user_id,
                            joined_at,
                            left_at
                        `)
                        .eq("call_id", callId)
                        .eq("user_id", userId)
                        .maybeSingle();

                let participant;

                if (existingParticipant) {
                    const { data, error: updateError } =
                        await supabase
                            .from("house_call_participants")
                            .update({
                                left_at: null
                            })
                            .eq("id", existingParticipant.id)
                            .select()
                            .single();

                    if (updateError) {
                        throw updateError;
                    }

                    participant = data;

                } else {
                    const { data, error: insertError } =
                        await supabase
                            .from("house_call_participants")
                            .insert({
                                call_id: callId,
                                user_id: userId
                            })
                            .select()
                            .single();

                    if (insertError) {
                        throw insertError;
                    }

                    participant = data;
                }

                res.json({
                    success: true,
                    call,
                    participant
                });

            } catch (error) {
                console.error(
                    "Join house call error:",
                    error
                );

                res.status(500).json({
                    error:
                        "Failed to join call."
                });
            }
        }
    );

    // ========================================================
    // LEAVE CALL
    // ========================================================

    router.post(
        "/houses/calls/:callId/leave",
        requireHouseLogin,
        async (req, res) => {
            try {
                const callId = req.params.callId;
                const userId = req.houseUserId;

                const { data: participant } =
                    await supabase
                        .from("house_call_participants")
                        .select(`
                            id,
                            call_id,
                            user_id,
                            left_at
                        `)
                        .eq("call_id", callId)
                        .eq("user_id", userId)
                        .maybeSingle();

                if (!participant) {
                    return res.status(404).json({
                        error:
                            "You are not in this call."
                    });
                }

                const { error } =
                    await supabase
                        .from("house_call_participants")
                        .update({
                            left_at:
                                new Date().toISOString()
                        })
                        .eq("id", participant.id);

                if (error) {
                    throw error;
                }

                res.json({
                    success: true
                });

            } catch (error) {
                console.error(
                    "Leave house call error:",
                    error
                );

                res.status(500).json({
                    error:
                        "Failed to leave call."
                });
            }
        }
    );

    // ========================================================
    // GET ACTIVE CALL
    // ========================================================

    router.get(
        "/houses/:houseId/rooms/:roomId/calls/active",
        requireHouseLogin,
        async (req, res) => {
            try {
                const houseId = req.params.houseId;
                const roomId = req.params.roomId;
                const userId = req.houseUserId;

                const member =
                    await isHouseMember(
                        houseId,
                        userId
                    );

                if (!member) {
                    return res.status(403).json({
                        error:
                            "You are not a member of this house."
                    });
                }

                const { data: call, error } =
                    await supabase
                        .from("house_calls")
                        .select(`
                            id,
                            room_id,
                            started_by,
                            call_type,
                            active,
                            created_at
                        `)
                        .eq("room_id", roomId)
                        .eq("active", true)
                        .maybeSingle();

                if (error) {
                    throw error;
                }

                if (!call) {
                    return res.json({
                        call: null,
                        participants: []
                    });
                }

                const { data: participants, error: participantError } =
                    await supabase
                        .from("house_call_participants")
                        .select(`
                            id,
                            call_id,
                            user_id,
                            joined_at,
                            left_at
                        `)
                        .eq("call_id", call.id)
                        .is("left_at", null);

                if (participantError) {
                    throw participantError;
                }

                res.json({
                    call,
                    participants: participants || []
                });

            } catch (error) {
                console.error(
                    "Get active house call error:",
                    error
                );

                res.status(500).json({
                    error:
                        "Failed to load active call."
                });
            }
        }
    );

    // ========================================================
    // CALL SIGNALING
    //
    // HTTP POLLING ONLY.
    // NO WEBSOCKETS.
    // ========================================================

    router.post(
        "/houses/calls/:callId/signals",
        requireHouseLogin,
        async (req, res) => {
            try {
                const callId = req.params.callId;
                const userId = req.houseUserId;

                const {
                    recipient_id = null,
                    signal_type,
                    signal_data
                } = req.body;

                if (
                    signal_type !== "offer" &&
                    signal_type !== "answer" &&
                    signal_type !== "ice-candidate"
                ) {
                    return res.status(400).json({
                        error:
                            "Invalid signal type."
                    });
                }

                if (
                    !signal_data ||
                    typeof signal_data !== "object"
                ) {
                    return res.status(400).json({
                        error:
                            "Signal data is required."
                    });
                }

                // ------------------------------------------------
                // Verify call
                // ------------------------------------------------

                const { data: call, error: callError } =
                    await supabase
                        .from("house_calls")
                        .select(`
                            id,
                            room_id,
                            active
                        `)
                        .eq("id", callId)
                        .single();

                if (callError || !call) {
                    return res.status(404).json({
                        error: "Call not found."
                    });
                }

                if (!call.active) {
                    return res.status(400).json({
                        error:
                            "This call is no longer active."
                    });
                }

                const houseId =
                    await getRoomHouseId(
                        call.room_id
                    );

                const member =
                    await isHouseMember(
                        houseId,
                        userId
                    );

                if (!member) {
                    return res.status(403).json({
                        error:
                            "You are not a member of this house."
                    });
                }

                // ------------------------------------------------
                // Verify recipient if provided
                // ------------------------------------------------

                if (recipient_id) {
                    const recipientMember =
                        await isHouseMember(
                            houseId,
                            recipient_id
                        );

                    if (!recipientMember) {
                        return res.status(400).json({
                            error:
                                "Recipient is not a member of this house."
                        });
                    }
                }

                // ------------------------------------------------
                // Insert signal
                // ------------------------------------------------

                const { data: signal, error } =
                    await supabase
                        .from("house_call_signals")
                        .insert({
                            call_id: callId,
                            sender_id: userId,
                            recipient_id,
                            signal_type,
                            signal_data
                        })
                        .select(`
                            id,
                            call_id,
                            sender_id,
                            recipient_id,
                            signal_type,
                            signal_data,
                            created_at
                        `)
                        .single();

                if (error) {
                    throw error;
                }

                res.status(201).json({
                    success: true,
                    signal
                });

            } catch (error) {
                console.error(
                    "Send call signal error:",
                    error
                );

                res.status(500).json({
                    error:
                        "Failed to send call signal."
                });
            }
        }
    );

    // ========================================================
    // GET CALL SIGNALS
    //
    // Frontend polls this endpoint.
    // ========================================================

    router.get(
        "/houses/calls/:callId/signals",
        requireHouseLogin,
        async (req, res) => {
            try {
                const callId = req.params.callId;
                const userId = req.houseUserId;

                const afterId =
                    Number(req.query.after_id || 0);

                const { data: call, error: callError } =
                    await supabase
                        .from("house_calls")
                        .select(`
                            id,
                            room_id,
                            active
                        `)
                        .eq("id", callId)
                        .single();

                if (callError || !call) {
                    return res.status(404).json({
                        error: "Call not found."
                    });
                }

                const houseId =
                    await getRoomHouseId(
                        call.room_id
                    );

                const member =
                    await isHouseMember(
                        houseId,
                        userId
                    );

                if (!member) {
                    return res.status(403).json({
                        error:
                            "You are not a member of this house."
                    });
                }

                let query = supabase
                    .from("house_call_signals")
                    .select(`
                        id,
                        call_id,
                        sender_id,
                        recipient_id,
                        signal_type,
                        signal_data,
                        created_at
                    `)
                    .eq("call_id", callId)
                    .gt("id", afterId)
                    .order("id", {
                        ascending: true
                    })
                    .limit(100);

                // Only retrieve:
                // - signals specifically addressed to this user
                // - broadcast signals with no recipient
                query = query.or(
                    `recipient_id.eq.${userId},recipient_id.is.null`
                );

                const { data: signals, error } =
                    await query;

                if (error) {
                    throw error;
                }

                res.json({
                    signals: signals || [],
                    active: call.active
                });

            } catch (error) {
                console.error(
                    "Get call signals error:",
                    error
                );

                res.status(500).json({
                    error:
                        "Failed to get call signals."
                });
            }
        }
    );

    // ========================================================
    // DELETE OLD CALL SIGNALS
    //
    // Optional cleanup endpoint.
    // Only house admins can use it.
    // ========================================================

    router.delete(
        "/houses/calls/:callId/signals",
        requireHouseLogin,
        async (req, res) => {
            try {
                const callId = req.params.callId;
                const userId = req.houseUserId;

                const { data: call, error } =
                    await supabase
                        .from("house_calls")
                        .select(`
                            id,
                            room_id
                        `)
                        .eq("id", callId)
                        .single();

                if (error || !call) {
                    return res.status(404).json({
                        error: "Call not found."
                    });
                }

                const houseId =
                    await getRoomHouseId(
                        call.room_id
                    );

                const admin =
                    await isHouseAdmin(
                        houseId,
                        userId
                    );

                if (!admin) {
                    return res.status(403).json({
                        error:
                            "Only house admins can clear call signals."
                    });
                }

                const { error: deleteError } =
                    await supabase
                        .from("house_call_signals")
                        .delete()
                        .eq("call_id", callId);

                if (deleteError) {
                    throw deleteError;
                }

                res.json({
                    success: true
                });

            } catch (error) {
                console.error(
                    "Delete call signals error:",
                    error
                );

                res.status(500).json({
                    error:
                        "Failed to delete call signals."
                });
            }
        }
    );

    // ========================================================
    // EXPORT ROUTER
    // ========================================================

    return router;
};
