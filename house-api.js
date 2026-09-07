// ============================================================
// SHREKBOOK HOUSES API
// ============================================================

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");

const router = express.Router();

// ============================================================
// MULTER
// ============================================================

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 100 * 1024 * 1024
    }
});

// ============================================================
// ROUTER FACTORY
// ============================================================

module.exports = function createHouseRouter({ supabase }) {

    // ========================================================
    // AUTH
    // ========================================================

    function requireHouseLogin(req, res, next) {

        const userId = req.session?.user?.id;

        if (!userId) {
            return res.status(401).json({
                error: "You must be logged in."
            });
        }

        req.houseUserId = userId;

        next();
    }

    // ========================================================
    // HOUSE HELPERS
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
            .maybeSingle();

        if (error) {
            console.error("GET HOUSE ERROR:", error);
            return null;
        }

        return data;
    }

    async function getMembership(houseId, userId) {

        if (!houseId || !userId) {
            return null;
        }

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

        const membership =
            await getMembership(
                houseId,
                userId
            );

        return !!membership;
    }

    async function isHouseAdmin(houseId, userId) {

        const membership =
            await getMembership(
                houseId,
                userId
            );

        if (!membership) {
            return false;
        }

        return (
            membership.role === "owner" ||
            membership.role === "admin"
        );
    }

    async function getRoom(roomId, houseId) {

        const { data, error } = await supabase
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

        if (error) {
            throw error;
        }

        return data;
    }

    async function getRoomHouseId(roomId) {

        const { data, error } = await supabase
            .from("house_rooms")
            .select("house_id")
            .eq("id", roomId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return data?.house_id || null;
    }

    // ========================================================
    // MEDIA HELPERS
    // ========================================================

    function getExtension(fileName) {

        const dot =
            fileName.lastIndexOf(".");

        if (dot === -1) {
            return "";
        }

        return fileName
            .substring(dot)
            .toLowerCase();
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

            // Images
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",

            // Video
            "video/mp4",
            "video/webm",
            "video/ogg",

            // Audio
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

        for (const message of messages || []) {

            if (!message.house_media) {
                message.house_media = [];
                continue;
            }

            for (const media of message.house_media) {

                const { data } =
                    supabase.storage
                        .from("house-media")
                        .getPublicUrl(
                            media.storage_path
                        );

                media.url =
                    data?.publicUrl || null;
            }
        }

        return messages || [];
    }

    // ========================================================
    // HOUSE TYPES
    // ========================================================

    router.get(
        "/houses/types",
        async (req, res) => {

            try {

                const { data, error } =
                    await supabase
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

                console.error(
                    "HOUSE TYPES ERROR:",
                    error
                );

                res.status(500).json({
                    error:
                        error.message ||
                        "Failed to load house types."
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

                const userId =
                    req.houseUserId;

                const {
                    name,
                    description,
                    house_type_id
                } = req.body;

                if (
                    typeof name !== "string" ||
                    !name.trim()
                ) {
                    return res.status(400).json({
                        error:
                            "House name is required."
                    });
                }

                if (!house_type_id) {
                    return res.status(400).json({
                        error:
                            "You must choose a house type."
                    });
                }

                // ------------------------------------------------
                // House type
                // ------------------------------------------------

                const {
                    data: houseType,
                    error: typeError
                } = await supabase
                    .from("house_types")
                    .select(`
                        id,
                        name,
                        cost,
                        tax_reduction,
                        room_count
                    `)
                    .eq(
                        "id",
                        Number(house_type_id)
                    )
                    .maybeSingle();

                if (typeError) {
                    throw typeError;
                }

                if (!houseType) {
                    return res.status(400).json({
                        error:
                            "That house type does not exist."
                    });
                }

                // ------------------------------------------------
                // Profile / ShrekCoins
                // ------------------------------------------------

                const {
                    data: profile,
                    error: profileError
                } = await supabase
                    .from("profiles")
                    .select(`
                        id,
                        shrekcoins
                    `)
                    .eq("id", userId)
                    .maybeSingle();

                if (profileError) {
                    throw profileError;
                }

                if (!profile) {
                    return res.status(404).json({
                        error:
                            "Profile not found."
                    });
                }

                const coins =
                    Number(profile.shrekcoins || 0);

                const cost =
                    Number(houseType.cost || 0);

                if (coins < cost) {

                    return res.status(400).json({
                        error:
                            `You need ${cost.toLocaleString()} ShrekCoins, but you only have ${coins.toLocaleString()}.`
                    });
                }

                // ------------------------------------------------
                // Create house
                // ------------------------------------------------

                const {
                    data: house,
                    error: houseError
                } = await supabase
                    .from("houses")
                    .insert({
                        name: name.trim(),
                        description:
                            typeof description === "string"
                                ? description.trim()
                                : "",
                        owner_id: userId,
                        house_type_id:
                            Number(house_type_id)
                    })
                    .select(`
                        id,
                        name,
                        description,
                        owner_id,
                        house_type_id,
                        created_at,
                        updated_at
                    `)
                    .single();

                if (houseError) {
                    throw houseError;
                }

                // ------------------------------------------------
                // Owner membership
                // ------------------------------------------------

                const {
                    error: memberError
                } = await supabase
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

                    throw memberError;
                }

                // ------------------------------------------------
                // Create rooms
                // ------------------------------------------------

                const roomTemplates = [

                    {
                        name: "General",
                        type: "general"
                    },

                    {
                        name: "Chat",
                        type: "chat"
                    },

                    {
                        name: "Media",
                        type: "media"
                    },

                    {
                        name: "Voice",
                        type: "voice"
                    },

                    {
                        name: "Video",
                        type: "video"
                    },

                    {
                        name: "Announcements",
                        type: "announcement"
                    },

                    {
                        name: "Lobby",
                        type: "chat"
                    },

                    {
                        name: "Hangout",
                        type: "chat"
                    },

                    {
                        name: "Gallery",
                        type: "media"
                    },

                    {
                        name: "Music",
                        type: "media"
                    },

                    {
                        name: "Gaming",
                        type: "chat"
                    },

                    {
                        name: "Discussion",
                        type: "chat"
                    },

                    {
                        name: "Events",
                        type: "chat"
                    },

                    {
                        name: "Community",
                        type: "chat"
                    },

                    {
                        name: "Main Room",
                        type: "general"
                    }
                ];

                const rooms = [];

                for (
                    let i = 0;
                    i < Number(houseType.room_count);
                    i++
                ) {

                    const template =
                        roomTemplates[i] || {
                            name:
                                `Room ${i + 1}`,
                            type: "chat"
                        };

                    rooms.push({
                        house_id: house.id,
                        name: template.name,
                        room_type: template.type,
                        description: "",
                        position: i
                    });
                }

                if (rooms.length) {

                    const {
                        error: roomsError
                    } = await supabase
                        .from("house_rooms")
                        .insert(rooms);

                    if (roomsError) {

                        await supabase
                            .from("house_members")
                            .delete()
                            .eq(
                                "house_id",
                                house.id
                            );

                        await supabase
                            .from("houses")
                            .delete()
                            .eq(
                                "id",
                                house.id
                            );

                        throw roomsError;
                    }
                }

                // ------------------------------------------------
                // Charge ShrekCoins
                // ------------------------------------------------

                const {
                    error: coinError
                } = await supabase
                    .from("profiles")
                    .update({
                        shrekcoins:
                            coins - cost
                    })
                    .eq("id", userId);

                if (coinError) {
                    throw coinError;
                }

                res.status(201).json({
                    success: true,
                    house
                });

            } catch (error) {

                console.error(
                    "CREATE HOUSE ERROR:",
                    error
                );

                res.status(500).json({
                    error:
                        error.message ||
                        "Failed to create house."
                });
            }
        }
    );

    // ========================================================
    // HOUSE DIRECTORY
    // ========================================================

    router.get(
        "/houses",
        async (req, res) => {

            try {

                const {
                    data: houses,
                    error
                } = await supabase
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
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );

                if (error) {
                    throw error;
                }

                const houseList =
                    houses || [];

                // ------------------------------------------------
                // Owners
                // ------------------------------------------------

                const ownerIds = [
                    ...new Set(
                        houseList
                            .map(
                                house =>
                                    house.owner_id
                            )
                            .filter(Boolean)
                    )
                ];

                let owners = [];

                if (ownerIds.length) {

                    const {
                        data,
                        error: ownerError
                    } = await supabase
                        .from("profiles")
                        .select(`
                            id,
                            username,
                            display_name,
                            avatar
                        `)
                        .in(
                            "id",
                            ownerIds
                        );

                    if (ownerError) {
                        throw ownerError;
                    }

                    owners = data || [];
                }

                const ownerMap =
                    new Map(
                        owners.map(
                            owner => [
                                owner.id,
                                owner
                            ]
                        )
                    );

                // ------------------------------------------------
                // Member counts
                // ------------------------------------------------

                const houseIds =
                    houseList.map(
                        house => house.id
                    );

                let memberRows = [];

                if (houseIds.length) {

                    const {
                        data,
                        error: memberError
                    } = await supabase
                        .from("house_members")
                        .select(
                            "house_id"
                        )
                        .in(
                            "house_id",
                            houseIds
                        );

                    if (memberError) {
                        throw memberError;
                    }

                    memberRows = data || [];
                }

                const memberCounts = {};

                for (
                    const member
                    of memberRows
                ) {

                    memberCounts[
                        member.house_id
                    ] =
                        (
                            memberCounts[
                                member.house_id
                            ] || 0
                        ) + 1;
                }

                // ------------------------------------------------
                // Rooms
                // ------------------------------------------------

                let roomRows = [];

                if (houseIds.length) {

                    const {
                        data,
                        error: roomError
                    } = await supabase
                        .from("house_rooms")
                        .select(`
                            id,
                            house_id
                        `)
                        .in(
                            "house_id",
                            houseIds
                        );

                    if (roomError) {
                        throw roomError;
                    }

                    roomRows = data || [];
                }

                const roomCounts = {};

                for (
                    const room
                    of roomRows
                ) {

                    roomCounts[
                        room.house_id
                    ] =
                        (
                            roomCounts[
                                room.house_id
                            ] || 0
                        ) + 1;
                }

                // ------------------------------------------------
                // Build response
                // ------------------------------------------------

                const result =
                    houseList.map(
                        house => {

                            const owner =
                                ownerMap.get(
                                    house.owner_id
                                ) || null;

                            const type =
                                house.house_types ||
                                null;

                            return {

                                id: house.id,

                                name:
                                    house.name,

                                description:
                                    house.description,

                                created_at:
                                    house.created_at,

                                owner:
                                    owner
                                        ? {
                                            id:
                                                owner.id,

                                            username:
                                                owner.username,

                                            display_name:
                                                owner.display_name,

                                            avatar:
                                                owner.avatar
                                        }
                                        : null,

                                type:
                                    type
                                        ? {
                                            id:
                                                type.id,

                                            name:
                                                type.name,

                                            cost:
                                                type.cost,

                                            tax_reduction:
                                                type.tax_reduction,

                                            room_count:
                                                type.room_count
                                        }
                                        : null,

                                member_count:
                                    memberCounts[
                                        house.id
                                    ] || 0,

                                room_count:
                                    roomCounts[
                                        house.id
                                    ] || 0
                            };
                        }
                    );

                res.json({
                    houses: result
                });

            } catch (error) {

                console.error(
                    "HOUSE DIRECTORY ERROR:",
                    error
                );

                res.status(500).json({
                    error:
                        error.message ||
                        "Failed to load houses."
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
                    req.params.id;

                const userId =
                    req.houseUserId;

                // ------------------------------------------------
                // House
                // ------------------------------------------------

                const house =
                    await getHouse(
                        houseId
                    );

                if (!house) {
                    return res.status(404).json({
                        error:
                            "House not found."
                    });
                }

                // ------------------------------------------------
                // Membership
                // ------------------------------------------------

                const membership =
                    await getMembership(
                        houseId,
                        userId
                    );

                if (!membership) {
                    return res.status(403).json({
                        error:
                            "You are not a member of this house."
                    });
                }

                // ------------------------------------------------
                // Owner
                // ------------------------------------------------

                const {
                    data: owner,
                    error: ownerError
                } = await supabase
                    .from("profiles")
                    .select(`
                        id,
                        username,
                        display_name,
                        avatar
                    `)
                    .eq(
                        "id",
                        house.owner_id
                    )
                    .maybeSingle();

                if (ownerError) {
                    throw ownerError;
                }

                // ------------------------------------------------
                // Rooms
                // ------------------------------------------------

                const {
                    data: rooms,
                    error: roomsError
                } = await supabase
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
                    .eq(
                        "house_id",
                        houseId
                    )
                    .order(
                        "position",
                        {
                            ascending: true
                        }
                    );

                if (roomsError) {
                    throw roomsError;
                }

                // ------------------------------------------------
                // Members
                // ------------------------------------------------

                const {
                    data: members,
                    error: membersError
                } = await supabase
                    .from("house_members")
                    .select(`
                        id,
                        house_id,
                        user_id,
                        role,
                        joined_at
                    `)
                    .eq(
                        "house_id",
                        houseId
                    )
                    .order(
                        "joined_at",
                        {
                            ascending: true
                        }
                    );

                if (membersError) {
                    throw membersError;
                }

                const memberIds = [
                    ...new Set(
                        (members || [])
                            .map(
                                member =>
                                    member.user_id
                            )
                    )
                ];

                let profiles = [];

                if (memberIds.length) {

                    const {
                        data,
                        error: profileError
                    } = await supabase
                        .from("profiles")
                        .select(`
                            id,
                            username,
                            display_name,
                            avatar
                        `)
                        .in(
                            "id",
                            memberIds
                        );

                    if (profileError) {
                        throw profileError;
                    }

                    profiles = data || [];
                }

                const profileMap =
                    new Map(
                        profiles.map(
                            profile => [
                                profile.id,
                                profile
                            ]
                        )
                    );

                const enrichedMembers =
                    (members || [])
                        .map(
                            member => ({

                                id:
                                    member.id,

                                house_id:
                                    member.house_id,

                                user_id:
                                    member.user_id,

                                role:
                                    member.role,

                                joined_at:
                                    member.joined_at,

                                profile:
                                    profileMap.get(
                                        member.user_id
                                    ) || null
                            })
                        );

                // ------------------------------------------------
                // Clean house object
                // ------------------------------------------------

                const cleanHouse = {

                    id:
                        house.id,

                    name:
                        house.name,

                    description:
                        house.description,

                    owner_id:
                        house.owner_id,

                    house_type_id:
                        house.house_type_id,

                    created_at:
                        house.created_at,

                    updated_at:
                        house.updated_at,

                    type:
                        house.house_types
                            ? {
                                id:
                                    house.house_types.id,

                                name:
                                    house.house_types.name,

                                cost:
                                    house.house_types.cost,

                                tax_reduction:
                                    house.house_types
                                        .tax_reduction,

                                room_count:
                                    house.house_types
                                        .room_count
                            }
                            : null,

                    owner:
                        owner || null,

                    member_count:
                        enrichedMembers.length,

                    room_count:
                        (rooms || []).length
                };

                res.json({

                    house:
                        cleanHouse,

                    membership,

                    owner:
                        owner || null,

                    rooms:
                        rooms || [],

                    members:
                        enrichedMembers
                });

            } catch (error) {

                console.error(
                    "GET HOUSE ERROR:",
                    error
                );

                res.status(500).json({
                    error:
                        error.message ||
                        "Failed to load house."
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

                const userId =
                    req.houseUserId;

                const {
                    data: invitations,
                    error
                } = await supabase
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
                    .eq(
                        "invitee_id",
                        userId
                    )
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );

                if (error) {
                    throw error;
                }

                const rows =
                    invitations || [];

                const houseIds = [
                    ...new Set(
                        rows.map(
                            invitation =>
                                invitation.house_id
                        )
                    )
                ];

                const inviterIds = [
                    ...new Set(
                        rows.map(
                            invitation =>
                                invitation.inviter_id
                        )
                    )
                ];

                let houses = [];
                let inviters = [];

                if (houseIds.length) {

                    const {
                        data,
                        error: houseError
                    } = await supabase
                        .from("houses")
                        .select(`
                            id,
                            name,
                            description,
                            owner_id,
                            house_type_id
                        `)
                        .in(
                            "id",
                            houseIds
                        );

                    if (houseError) {
                        throw houseError;
                    }

                    houses = data || [];
                }

                if (inviterIds.length) {

                    const {
                        data,
                        error: inviterError
                    } = await supabase
                        .from("profiles")
                        .select(`
                            id,
                            username,
                            display_name,
                            avatar
                        `)
                        .in(
                            "id",
                            inviterIds
                        );

                    if (inviterError) {
                        throw inviterError;
                    }

                    inviters = data || [];
                }

                const houseMap =
                    new Map(
                        houses.map(
                            house => [
                                house.id,
                                house
                            ]
                        )
                    );

                const inviterMap =
                    new Map(
                        inviters.map(
                            inviter => [
                                inviter.id,
                                inviter
                            ]
                        )
                    );

                res.json(
                    rows.map(
                        invitation => ({

                            ...invitation,

                            house:
                                houseMap.get(
                                    invitation.house_id
                                ) || null,

                            inviter:
                                inviterMap.get(
                                    invitation.inviter_id
                                ) || null
                        })
                    )
                );

            } catch (error) {

                console.error(
                    "GET INVITATIONS ERROR:",
                    error
                );

                res.status(500).json({
                    error:
                        error.message ||
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
                    req.params.id;

                const inviterId =
                    req.houseUserId;

                const {
                    invitee_id
                } = req.body;

                if (!invitee_id) {
                    return res.status(400).json({
                        error:
                            "Invitee is required."
                    });
                }

                if (
                    invitee_id ===
                    inviterId
                ) {
                    return res.status(400).json({
                        error:
                            "You cannot invite yourself."
                    });
                }

                const house =
                    await getHouse(
                        houseId
                    );

                if (!house) {
                    return res.status(404).json({
                        error:
                            "House not found."
                    });
                }

                const admin =
                    await isHouseAdmin(
                        houseId,
                        inviterId
                    );

                if (!admin) {
                    return res.status(403).json({
                        error:
                            "Only the owner or an admin can invite people."
                    });
                }

                const {
                    data: invitee,
                    error: inviteeError
                } = await supabase
                    .from("profiles")
                    .select("id")
                    .eq(
                        "id",
                        invitee_id
                    )
                    .maybeSingle();

                if (inviteeError) {
                    throw inviteeError;
                }

                if (!invitee) {
                    return res.status(404).json({
                        error:
                            "User not found."
                    });
                }

                if (
                    await isHouseMember(
                        houseId,
                        invitee_id
                    )
                ) {
                    return res.status(400).json({
                        error:
                            "That user is already a member of this house."
                    });
                }

                const {
                    data: existing
                } = await supabase
                    .from("house_invitations")
                    .select("id")
                    .eq(
                        "house_id",
                        houseId
                    )
                    .eq(
                        "invitee_id",
                        invitee_id
                    )
                    .eq(
                        "status",
                        "pending"
                    )
                    .maybeSingle();

                if (existing) {
                    return res.status(400).json({
                        error:
                            "That user already has a pending invitation."
                    });
                }

                const {
                    data: invitation,
                    error
                } = await supabase
                    .from("house_invitations")
                    .insert({
                        house_id:
                            houseId,

                        inviter_id:
                            inviterId,

                        invitee_id:
                            invitee_id,

                        status:
                            "pending"
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
                    "SEND INVITATION ERROR:",
                    error
                );

                res.status(500).json({
                    error:
                        error.message ||
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
                    req.params.id;

                const userId =
                    req.houseUserId;

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

                const {
                    data: invitation,
                    error
                } = await supabase
                    .from("house_invitations")
                    .select(`
                        id,
                        house_id,
                        inviter_id,
                        invitee_id,
                        status
                    `)
                    .eq(
                        "id",
                        invitationId
                    )
                    .maybeSingle();

                if (error) {
                    throw error;
                }

                if (!invitation) {
                    return res.status(404).json({
                        error:
                            "Invitation not found."
                    });
                }

                if (
                    invitation.invitee_id !==
                    userId
                ) {
                    return res.status(403).json({
                        error:
                            "You cannot respond to this invitation."
                    });
                }

                if (
                    invitation.status !==
                    "pending"
                ) {
                    return res.status(400).json({
                        error:
                            "This invitation has already been answered."
                    });
                }

                if (
                    response ===
                    "accepted"
                ) {

                    const member =
                        await isHouseMember(
                            invitation.house_id,
                            userId
                        );

                    if (!member) {

                        const {
                            error:
                                memberError
                        } = await supabase
                            .from("house_members")
                            .insert({
                                house_id:
                                    invitation.house_id,

                                user_id:
                                    userId,

                                role:
                                    "member"
                            });

                        if (memberError) {
                            throw memberError;
                        }
                    }
                }

                const {
                    data: updated,
                    error:
                        updateError
                } = await supabase
                    .from("house_invitations")
                    .update({

                        status:
                            response,

                        responded_at:
                            new Date()
                                .toISOString()

                    })
                    .eq(
                        "id",
                        invitationId
                    )
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
                    "RESPOND INVITATION ERROR:",
                    error
                );

                res.status(500).json({
                    error:
                        error.message ||
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

                const houseId =
                    req.params.houseId;

                const roomId =
                    req.params.roomId;

                const userId =
                    req.houseUserId;

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

                const room =
                    await getRoom(
                        roomId,
                        houseId
                    );

                if (!room) {
                    return res.status(404).json({
                        error:
                            "Room not found."
                    });
                }

                // ------------------------------------------------
                // Messages
                // ------------------------------------------------

                const {
                    data: messages,
                    error:
                        messagesError
                } = await supabase
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

                if (messagesError) {
                    throw messagesError;
                }

                await attachMediaUrls(
                    messages || []
                );

                // ------------------------------------------------
                // Message profiles
                // ------------------------------------------------

                const userIds = [
                    ...new Set(
                        (messages || [])
                            .map(
                                message =>
                                    message.user_id
                            )
                    )
                ];

                let profiles = [];

                if (userIds.length) {

                    const {
                        data,
                        error:
                            profileError
                    } = await supabase
                        .from("profiles")
                        .select(`
                            id,
                            username,
                            display_name,
                            avatar
                        `)
                        .in(
                            "id",
                            userIds
                        );

                    if (profileError) {
                        throw profileError;
                    }

                    profiles =
                        data || [];
                }

                const profileMap =
                    new Map(
                        profiles.map(
                            profile => [
                                profile.id,
                                profile
                            ]
                        )
                    );

                const enrichedMessages =
                    (messages || [])
                        .map(
                            message => ({

                                ...message,

                                profile:
                                    profileMap.get(
                                        message.user_id
                                    ) || null
                            })
                        );

                res.json({

                    room,

                    messages:
                        enrichedMessages
                });

            } catch (error) {

                console.error(
                    "GET ROOM ERROR:",
                    error
                );

                res.status(500).json({
                    error:
                        error.message ||
                        "Failed to load house room."
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
                    req.params.houseId;

                const roomId =
                    req.params.roomId;

                const userId =
                    req.houseUserId;

                const content =
                    typeof req.body.content === "string"
                        ? req.body.content.trim()
                        : "";

                if (!content) {
                    return res.status(400).json({
                        error:
                            "Message cannot be empty."
                    });
                }

                if (content.length > 10000) {
                    return res.status(400).json({
                        error:
                            "Message is too long."
                    });
                }

                if (
                    !(await isHouseMember(
                        houseId,
                        userId
                    ))
                ) {
                    return res.status(403).json({
                        error:
                            "You are not a member of this house."
                    });
                }

                const room =
                    await getRoom(
                        roomId,
                        houseId
                    );

                if (!room) {
                    return res.status(404).json({
                        error:
                            "Room not found."
                    });
                }

                const {
                    data: message,
                    error
                } = await supabase
                    .from("house_messages")
                    .insert({
                        room_id:
                            roomId,

                        user_id:
                            userId,

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
                    "SEND MESSAGE ERROR:",
                    error
                );

                res.status(500).json({
                    error:
                        error.message ||
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
                    req.params.houseId;

                const messageId =
                    req.params.messageId;

                const userId =
                    req.houseUserId;

                const {
                    data: message,
                    error
                } = await supabase
                    .from("house_messages")
                    .select(`
                        id,
                        room_id,
                        user_id
                    `)
                    .eq(
                        "id",
                        messageId
                    )
                    .maybeSingle();

                if (error) {
                    throw error;
                }

                if (!message) {
                    return res.status(404).json({
                        error:
                            "Message not found."
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
                        error:
                            "Message not found."
                    });
                }

                const admin =
                    await isHouseAdmin(
                        houseId,
                        userId
                    );

                const owner =
                    message.user_id ===
                    userId;

                if (!admin && !owner) {
                    return res.status(403).json({
                        error:
                            "You do not have permission to delete this message."
                    });
                }

                const {
                    data: media
                } = await supabase
                    .from("house_media")
                    .select(
                        "storage_path"
                    )
                    .eq(
                        "message_id",
                        messageId
                    );

                const {
                    error:
                        deleteError
                } = await supabase
                    .from("house_messages")
                    .delete()
                    .eq(
                        "id",
                        messageId
                    );

                if (deleteError) {
                    throw deleteError;
                }

                if (
                    media &&
                    media.length
                ) {

                    const paths =
                        media
                            .map(
                                item =>
                                    item.storage_path
                            )
                            .filter(Boolean);

                    if (paths.length) {

                        await supabase.storage
                            .from(
                                "house-media"
                            )
                            .remove(paths);
                    }
                }

                res.json({
                    success: true
                });

            } catch (error) {

                console.error(
                    "DELETE MESSAGE ERROR:",
                    error
                );

                res.status(500).json({
                    error:
                        error.message ||
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

                const houseId =
                    req.params.houseId;

                const roomId =
                    req.params.roomId;

                const userId =
                    req.houseUserId;

                if (!req.file) {
                    return res.status(400).json({
                        error:
                            "No file uploaded."
                    });
                }

                if (
                    !isAllowedMediaType(
                        req.file.mimetype
                    )
                ) {
                    return res.status(400).json({
                        error:
                            "This file type is not supported."
                    });
                }

                if (
                    !(await isHouseMember(
                        houseId,
                        userId
                    ))
                ) {
                    return res.status(403).json({
                        error:
                            "You are not a member of this house."
                    });
                }

                const room =
                    await getRoom(
                        roomId,
                        houseId
                    );

                if (!room) {
                    return res.status(404).json({
                        error:
                            "Room not found."
                    });
                }

                const mediaType =
                    getMediaType(
                        req.file.mimetype
                    );

                const extension =
                    getExtension(
                        req.file.originalname
                    );

                const safeName =
                    `${Date.now()}-${crypto.randomUUID()}${extension}`;

                const storagePath =
                    `houses/${houseId}/rooms/${roomId}/${userId}/${safeName}`;

                // ------------------------------------------------
                // Upload file
                // ------------------------------------------------

                const {
                    error: uploadError
                } = await supabase.storage
                    .from("house-media")
                    .upload(
                        storagePath,
                        req.file.buffer,
                        {
                            contentType:
                                req.file.mimetype,

                            upsert:
                                false
                        }
                    );

                if (uploadError) {
                    throw uploadError;
                }

                const content =
                    typeof req.body.content === "string"
                        ? req.body.content.trim()
                        : "";

                if (content.length > 10000) {

                    await supabase.storage
                        .from("house-media")
                        .remove([
                            storagePath
                        ]);

                    return res.status(400).json({
                        error:
                            "Message is too long."
                    });
                }

                // ------------------------------------------------
                // Create message
                // ------------------------------------------------

                const {
                    data: message,
                    error:
                        messageError
                } = await supabase
                    .from("house_messages")
                    .insert({
                        room_id:
                            roomId,

                        user_id:
                            userId,

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
                        .remove([
                            storagePath
                        ]);

                    throw messageError;
                }

                // ------------------------------------------------
                // Media database record
                // ------------------------------------------------

                const {
                    data: media,
                    error:
                        mediaError
                } = await supabase
                    .from("house_media")
                    .insert({

                        room_id:
                            roomId,

                        user_id:
                            userId,

                        message_id:
                            message.id,

                        media_type:
                            mediaType,

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

                    await supabase
                        .from(
                            "house_messages"
                        )
                        .delete()
                        .eq(
                            "id",
                            message.id
                        );

                    await supabase.storage
                        .from(
                            "house-media"
                        )
                        .remove([
                            storagePath
                        ]);

                    throw mediaError;
                }

                const {
                    data: publicUrlData
                } =
                    supabase.storage
                        .from(
                            "house-media"
                        )
                        .getPublicUrl(
                            storagePath
                        );

                media.url =
                    publicUrlData?.publicUrl ||
                    null;

                res.status(201).json({

                    success: true,

                    message,

                    media
                });

            } catch (error) {

                console.error(
                    "MEDIA UPLOAD ERROR:",
                    error
                );

                res.status(500).json({
                    error:
                        error.message ||
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

                const houseId =
                    req.params.houseId;

                const roomId =
                    req.params.roomId;

                const userId =
                    req.houseUserId;

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

                if (
                    !(await isHouseMember(
                        houseId,
                        userId
                    ))
                ) {
                    return res.status(403).json({
                        error:
                            "You are not a member of this house."
                    });
                }

                const room =
                    await getRoom(
                        roomId,
                        houseId
                    );

                if (!room) {
                    return res.status(404).json({
                        error:
                            "Room not found."
                    });
                }

                const {
                    data: existing
                } = await supabase
                    .from("house_calls")
                    .select(`
                        id,
                        room_id,
                        started_by,
                        call_type,
                        active,
                        created_at
                    `)
                    .eq(
                        "room_id",
                        roomId
                    )
                    .eq(
                        "active",
                        true
                    )
                    .maybeSingle();

                if (existing) {

                    return res.json({
                        success: true,
                        call: existing
                    });
                }

                const {
                    data: call,
                    error
                } = await supabase
                    .from("house_calls")
                    .insert({

                        room_id:
                            roomId,

                        started_by:
                            userId,

                        call_type:
                            call_type,

                        active:
                            true
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

                const {
                    error:
                        participantError
                } = await supabase
                    .from(
                        "house_call_participants"
                    )
                    .insert({

                        call_id:
                            call.id,

                        user_id:
                            userId
                    });

                if (participantError) {

                    await supabase
                        .from(
                            "house_calls"
                        )
                        .delete()
                        .eq(
                            "id",
                            call.id
                        );

                    throw participantError;
                }

                res.status(201).json({
                    success: true,
                    call
                });

            } catch (error) {

                console.error(
                    "CREATE CALL ERROR:",
                    error
                );

                res.status(500).json({
                    error:
                        error.message ||
                        "Failed to create call."
                });
            }
        }
    );

    // ========================================================
    // ACTIVE CALL
    // ========================================================

    router.get(
        "/houses/:houseId/rooms/:roomId/calls/active",
        requireHouseLogin,
        async (req, res) => {

            try {

                const houseId =
                    req.params.houseId;

                const roomId =
                    req.params.roomId;

                const userId =
                    req.houseUserId;

                if (
                    !(await isHouseMember(
                        houseId,
                        userId
                    ))
                ) {
                    return res.status(403).json({
                        error:
                            "You are not a member of this house."
                    });
                }

                const {
                    data: call,
                    error
                } = await supabase
                    .from("house_calls")
                    .select(`
                        id,
                        room_id,
                        started_by,
                        call_type,
                        active,
                        created_at
                    `)
                    .eq(
                        "room_id",
                        roomId
                    )
                    .eq(
                        "active",
                        true
                    )
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

                const {
                    data: participants,
                    error:
                        participantError
                } = await supabase
                    .from(
                        "house_call_participants"
                    )
                    .select(`
                        id,
                        call_id,
                        user_id,
                        joined_at,
                        left_at
                    `)
                    .eq(
                        "call_id",
                        call.id
                    )
                    .is(
                        "left_at",
                        null
                    );

                if (participantError) {
                    throw participantError;
                }

                res.json({

                    call,

                    participants:
                        participants || []
                });

            } catch (error) {

                console.error(
                    "ACTIVE CALL ERROR:",
                    error
                );

                res.status(500).json({
                    error:
                        error.message ||
                        "Failed to load active call."
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

                const callId =
                    req.params.callId;

                const userId =
                    req.houseUserId;

                const {
                    data: call,
                    error
                } = await supabase
                    .from("house_calls")
                    .select(`
                        id,
                        room_id,
                        started_by,
                        call_type,
                        active,
                        created_at
                    `)
                    .eq(
                        "id",
                        callId
                    )
                    .maybeSingle();

                if (error) {
                    throw error;
                }

                if (!call) {
                    return res.status(404).json({
                        error:
                            "Call not found."
                    });
                }

                if (!call.active) {
                    return res.status(400).json({
                        error:
                            "This call has ended."
                    });
                }

                const houseId =
                    await getRoomHouseId(
                        call.room_id
                    );

                if (
                    !(await isHouseMember(
                        houseId,
                        userId
                    ))
                ) {
                    return res.status(403).json({
                        error:
                            "You are not a member of this house."
                    });
                }

                const {
                    data: existing
                } = await supabase
                    .from(
                        "house_call_participants"
                    )
                    .select(`
                        id,
                        call_id,
                        user_id,
                        joined_at,
                        left_at
                    `)
                    .eq(
                        "call_id",
                        callId
                    )
                    .eq(
                        "user_id",
                        userId
                    )
                    .maybeSingle();

                let participant;

                if (existing) {

                    const {
                        data,
                        error:
                            updateError
                    } = await supabase
                        .from(
                            "house_call_participants"
                        )
                        .update({
                            left_at:
                                null
                        })
                        .eq(
                            "id",
                            existing.id
                        )
                        .select()
                        .single();

                    if (updateError) {
                        throw updateError;
                    }

                    participant =
                        data;

                } else {

                    const {
                        data,
                        error:
                            insertError
                    } = await supabase
                        .from(
                            "house_call_participants"
                        )
                        .insert({

                            call_id:
                                callId,

                            user_id:
                                userId
                        })
                        .select()
                        .single();

                    if (insertError) {
                        throw insertError;
                    }

                    participant =
                        data;
                }

                res.json({

                    success: true,

                    call,

                    participant
                });

            } catch (error) {

                console.error(
                    "JOIN CALL ERROR:",
                    error
                );

                res.status(500).json({
                    error:
                        error.message ||
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

                const callId =
                    req.params.callId;

                const userId =
                    req.houseUserId;

                const {
                    data: participant,
                    error
                } = await supabase
                    .from(
                        "house_call_participants"
                    )
                    .select(`
                        id,
                        call_id,
                        user_id,
                        left_at
                    `)
                    .eq(
                        "call_id",
                        callId
                    )
                    .eq(
                        "user_id",
                        userId
                    )
                    .maybeSingle();

                if (error) {
                    throw error;
                }

                if (!participant) {
                    return res.status(404).json({
                        error:
                            "You are not in this call."
                    });
                }

                const {
                    error:
                        updateError
                } = await supabase
                    .from(
                        "house_call_participants"
                    )
                    .update({
                        left_at:
                            new Date()
                                .toISOString()
                    })
                    .eq(
                        "id",
                        participant.id
                    );

                if (updateError) {
                    throw updateError;
                }

                res.json({
                    success: true
                });

            } catch (error) {

                console.error(
                    "LEAVE CALL ERROR:",
                    error
                );

                res.status(500).json({
                    error:
                        error.message ||
                        "Failed to leave call."
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
                    req.params.callId;

                const userId =
                    req.houseUserId;

                const {
                    data: call,
                    error
                } = await supabase
                    .from("house_calls")
                    .select(`
                        id,
                        room_id,
                        started_by,
                        active
                    `)
                    .eq(
                        "id",
                        callId
                    )
                    .maybeSingle();

                if (error) {
                    throw error;
                }

                if (!call) {
                    return res.status(404).json({
                        error:
                            "Call not found."
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
                    call.started_by !==
                        userId &&
                    !admin
                ) {
                    return res.status(403).json({
                        error:
                            "You do not have permission to end this call."
                    });
                }

                const {
                    error:
                        updateError
                } = await supabase
                    .from("house_calls")
                    .update({
                        active:
                            false
                    })
                    .eq(
                        "id",
                        callId
                    );

                if (updateError) {
                    throw updateError;
                }

                await supabase
                    .from(
                        "house_call_participants"
                    )
                    .update({
                        left_at:
                            new Date()
                                .toISOString()
                    })
                    .eq(
                        "call_id",
                        callId
                    )
                    .is(
                        "left_at",
                        null
                    );

                res.json({
                    success: true
                });

            } catch (error) {

                console.error(
                    "END CALL ERROR:",
                    error
                );

                res.status(500).json({
                    error:
                        error.message ||
                        "Failed to end call."
                });
            }
        }
    );

    // ========================================================
    // SEND CALL SIGNAL
    // ========================================================

    router.post(
        "/houses/calls/:callId/signals",
        requireHouseLogin,
        async (req, res) => {

            try {

                const callId =
                    req.params.callId;

                const userId =
                    req.houseUserId;

                const {
                    recipient_id = null,
                    signal_type,
                    signal_data
                } = req.body;

                if (
                    ![
                        "offer",
                        "answer",
                        "ice-candidate"
                    ].includes(
                        signal_type
                    )
                ) {
                    return res.status(400).json({
                        error:
                            "Invalid signal type."
                    });
                }

                if (
                    !signal_data ||
                    typeof signal_data !==
                        "object"
                ) {
                    return res.status(400).json({
                        error:
                            "Signal data is required."
                    });
                }

                const {
                    data: call,
                    error
                } = await supabase
                    .from("house_calls")
                    .select(`
                        id,
                        room_id,
                        active
                    `)
                    .eq(
                        "id",
                        callId
                    )
                    .maybeSingle();

                if (error) {
                    throw error;
                }

                if (!call) {
                    return res.status(404).json({
                        error:
                            "Call not found."
                    });
                }

                if (!call.active) {
                    return res.status(400).json({
                        error:
                            "This call has ended."
                    });
                }

                const houseId =
                    await getRoomHouseId(
                        call.room_id
                    );

                if (
                    !(await isHouseMember(
                        houseId,
                        userId
                    ))
                ) {
                    return res.status(403).json({
                        error:
                            "You are not a member of this house."
                    });
                }

                if (
                    recipient_id &&
                    !(await isHouseMember(
                        houseId,
                        recipient_id
                    ))
                ) {
                    return res.status(400).json({
                        error:
                            "Recipient is not a member of this house."
                    });
                }

                const {
                    data: signal,
                    error:
                        signalError
                } = await supabase
                    .from(
                        "house_call_signals"
                    )
                    .insert({

                        call_id:
                            callId,

                        sender_id:
                            userId,

                        recipient_id:
                            recipient_id,

                        signal_type:
                            signal_type,

                        signal_data:
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

                if (signalError) {
                    throw signalError;
                }

                res.status(201).json({

                    success: true,

                    signal
                });

            } catch (error) {

                console.error(
                    "SEND SIGNAL ERROR:",
                    error
                );

                res.status(500).json({
                    error:
                        error.message ||
                        "Failed to send call signal."
                });
            }
        }
    );

    // ========================================================
    // GET CALL SIGNALS
    // ========================================================

    router.get(
        "/houses/calls/:callId/signals",
        requireHouseLogin,
        async (req, res) => {

            try {

                const callId =
                    req.params.callId;

                const userId =
                    req.houseUserId;

                const afterId =
                    Number(
                        req.query.after_id ||
                        0
                    );

                const {
                    data: call,
                    error
                } = await supabase
                    .from("house_calls")
                    .select(`
                        id,
                        room_id,
                        active
                    `)
                    .eq(
                        "id",
                        callId
                    )
                    .maybeSingle();

                if (error) {
                    throw error;
                }

                if (!call) {
                    return res.status(404).json({
                        error:
                            "Call not found."
                    });
                }

                const houseId =
                    await getRoomHouseId(
                        call.room_id
                    );

                if (
                    !(await isHouseMember(
                        houseId,
                        userId
                    ))
                ) {
                    return res.status(403).json({
                        error:
                            "You are not a member of this house."
                    });
                }

                const {
                    data: signals,
                    error:
                        signalError
                } = await supabase
                    .from(
                        "house_call_signals"
                    )
                    .select(`
                        id,
                        call_id,
                        sender_id,
                        recipient_id,
                        signal_type,
                        signal_data,
                        created_at
                    `)
                    .eq(
                        "call_id",
                        callId
                    )
                    .gt(
                        "id",
                        afterId
                    )
                    .neq(
                        "sender_id",
                        userId
                    )
                    .or(
                        `recipient_id.eq.${userId},recipient_id.is.null`
                    )
                    .order(
                        "id",
                        {
                            ascending: true
                        }
                    )
                    .limit(100);

                if (signalError) {
                    throw signalError;
                }

                res.json({

                    signals:
                        signals || [],

                    active:
                        call.active
                });

            } catch (error) {

                console.error(
                    "GET SIGNALS ERROR:",
                    error
                );

                res.status(500).json({
                    error:
                        error.message ||
                        "Failed to get call signals."
                });
            }
        }
    );

    // ========================================================
    // DELETE CALL SIGNALS
    // ========================================================

    router.delete(
        "/houses/calls/:callId/signals",
        requireHouseLogin,
        async (req, res) => {

            try {

                const callId =
                    req.params.callId;

                const userId =
                    req.houseUserId;

                const {
                    data: call,
                    error
                } = await supabase
                    .from("house_calls")
                    .select(`
                        id,
                        room_id
                    `)
                    .eq(
                        "id",
                        callId
                    )
                    .maybeSingle();

                if (error) {
                    throw error;
                }

                if (!call) {
                    return res.status(404).json({
                        error:
                            "Call not found."
                    });
                }

                const houseId =
                    await getRoomHouseId(
                        call.room_id
                    );

                if (
                    !(await isHouseAdmin(
                        houseId,
                        userId
                    ))
                ) {
                    return res.status(403).json({
                        error:
                            "Only house admins can clear call signals."
                    });
                }

                const {
                    error:
                        deleteError
                } = await supabase
                    .from(
                        "house_call_signals"
                    )
                    .delete()
                    .eq(
                        "call_id",
                        callId
                    );

                if (deleteError) {
                    throw deleteError;
                }

                res.json({
                    success: true
                });

            } catch (error) {

                console.error(
                    "DELETE SIGNALS ERROR:",
                    error
                );

                res.status(500).json({
                    error:
                        error.message ||
                        "Failed to delete call signals."
                });
            }
        }
    );

    // ========================================================
    // RETURN ROUTER
    // ========================================================

    return router;
};