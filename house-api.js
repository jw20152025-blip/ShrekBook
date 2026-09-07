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
            .maybeSingle();

        if (error) {
            throw error;
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
        const membership =
            await getMembership(houseId, userId);

        return !!membership;
    }

    async function isHouseAdmin(houseId, userId) {
        const membership =
            await getMembership(houseId, userId);

        if (!membership) {
            return false;
        }

        return (
            membership.role === "owner" ||
            membership.role === "admin"
        );
    }

    async function getRoom(roomId) {
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
            .maybeSingle();

        if (error) {
            throw error;
        }

        return data;
    }

    async function getRoomHouseId(roomId) {
        const room = await getRoom(roomId);

        if (!room) {
            return null;
        }

        return room.house_id;
    }

    async function verifyRoomMembership(
        houseId,
        roomId,
        userId
    ) {
        const member =
            await isHouseMember(
                houseId,
                userId
            );

        if (!member) {
            return {
                ok: false,
                status: 403,
                error:
                    "You are not a member of this house."
            };
        }

        const room =
            await getRoom(roomId);

        if (!room) {
            return {
                ok: false,
                status: 404,
                error: "Room not found."
            };
        }

        if (
            String(room.house_id) !==
            String(houseId)
        ) {
            return {
                ok: false,
                status: 404,
                error: "Room not found."
            };
        }

        return {
            ok: true,
            room
        };
    }

    function getExtension(fileName) {
        if (!fileName) {
            return "";
        }

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
        if (!mimeType) {
            return null;
        }

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
        if (!messages || !messages.length) {
            return messages || [];
        }

        for (const message of messages) {
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

        return messages;
    }

    async function getProfilesByIds(userIds) {
        if (!userIds || !userIds.length) {
            return [];
        }

        const { data, error } =
            await supabase
                .from("profiles")
                .select(`
                    id,
                    username,
                    display_name,
                    avatar
                `)
                .in("id", userIds);

        if (error) {
            throw error;
        }

        return data || [];
    }

    function makeProfileMap(profiles) {
        const map = {};

        for (const profile of profiles || []) {
            map[profile.id] = profile;
        }

        return map;
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

                return res.json({
                    houseTypes: data || []
                });

            } catch (error) {
                console.error(
                    "HOUSE TYPES ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
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
                } = req.body || {};

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
                // HOUSE TYPE
                // ------------------------------------------------

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
                // PROFILE / SHREKCOINS
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
                // CREATE HOUSE
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
                // ADD OWNER
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
                    console.error(
                        "HOUSE MEMBER ERROR:",
                        memberError
                    );

                    await supabase
                        .from("houses")
                        .delete()
                        .eq("id", house.id);

                    throw memberError;
                }

                // ------------------------------------------------
                // CREATE ROOMS
                // ------------------------------------------------

                const defaultRooms = [
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
                    },
                    {
                        name: "Voice",
                        room_type: "voice"
                    },
                    {
                        name: "Video",
                        room_type: "video"
                    },
                    {
                        name: "Announcements",
                        room_type: "announcement"
                    },
                    {
                        name: "Lobby",
                        room_type: "chat"
                    },
                    {
                        name: "Hangout",
                        room_type: "chat"
                    },
                    {
                        name: "Gallery",
                        room_type: "media"
                    },
                    {
                        name: "Music",
                        room_type: "media"
                    },
                    {
                        name: "Gaming",
                        room_type: "chat"
                    },
                    {
                        name: "Discussion",
                        room_type: "chat"
                    },
                    {
                        name: "Events",
                        room_type: "chat"
                    },
                    {
                        name: "Community",
                        room_type: "chat"
                    },
                    {
                        name: "Main Room",
                        room_type: "general"
                    }
                ];

                const roomCount =
                    Number(
                        houseType.room_count
                    );

                const roomsToCreate =
                    defaultRooms
                        .slice(0, roomCount)
                        .map(
                            (room, index) => ({
                                house_id:
                                    house.id,
                                name:
                                    room.name,
                                room_type:
                                    room.room_type,
                                description: "",
                                position:
                                    index
                            })
                        );

                if (roomsToCreate.length) {
                    const {
                        error: roomsError
                    } = await supabase
                        .from("house_rooms")
                        .insert(
                            roomsToCreate
                        );

                    if (roomsError) {
                        console.error(
                            "ROOM CREATION ERROR:",
                            roomsError
                        );

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
                // TAKE SHREKCOINS
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
                    console.error(
                        "SHREKCOIN UPDATE ERROR:",
                        coinError
                    );

                    // Best-effort cleanup
                    await supabase
                        .from("house_rooms")
                        .delete()
                        .eq(
                            "house_id",
                            house.id
                        );

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

                    throw coinError;
                }

                return res.status(201).json({
                    success: true,
                    house
                });

            } catch (error) {
                console.error(
                    "CREATE HOUSE ERROR:",
                    error
                );

                return res.status(500).json({
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
                    error: housesError
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
                    .order("created_at", {
                        ascending: false
                    });

                if (housesError) {
                    throw housesError;
                }

                const houseList =
                    houses || [];

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

                const owners =
                    await getProfilesByIds(
                        ownerIds
                    );

                const ownerMap =
                    makeProfileMap(
                        owners
                    );

                // ------------------------------------------------
                // MEMBER COUNTS
                // ------------------------------------------------

                const houseIds =
                    houseList.map(
                        house => house.id
                    );

                let memberRows = [];

                if (houseIds.length) {
                    const {
                        data,
                        error
                    } = await supabase
                        .from("house_members")
                        .select(`
                            house_id,
                            user_id
                        `)
                        .in(
                            "house_id",
                            houseIds
                        );

                    if (error) {
                        throw error;
                    }

                    memberRows =
                        data || [];
                }

                const memberCounts = {};

                for (const member of memberRows) {
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
                // ROOMS
                // ------------------------------------------------

                let roomRows = [];

                if (houseIds.length) {
                    const {
                        data,
                        error
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

                    if (error) {
                        throw error;
                    }

                    roomRows =
                        data || [];
                }

                const roomCounts = {};

                for (const room of roomRows) {
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
                // RESPONSE
                // ------------------------------------------------

                const result =
                    houseList.map(
                        house => {

                            const owner =
                                ownerMap[
                                    house.owner_id
                                ] || null;

                            const type =
                                house.house_types
                                    ? {
                                        id:
                                            house
                                                .house_types
                                                .id,

                                        name:
                                            house
                                                .house_types
                                                .name,

                                        cost:
                                            house
                                                .house_types
                                                .cost,

                                        tax_reduction:
                                            house
                                                .house_types
                                                .tax_reduction,

                                        room_count:
                                            house
                                                .house_types
                                                .room_count
                                    }
                                    : null;

                            return {
                                id:
                                    house.id,

                                name:
                                    house.name,

                                description:
                                    house.description,

                                owner_id:
                                    house.owner_id,

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

                                type,

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

                return res.json({
                    houses: result
                });

            } catch (error) {
                console.error(
                    "HOUSE DIRECTORY ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
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
                // MEMBERSHIP
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
                // OWNER
                // ------------------------------------------------

                const ownerProfiles =
                    await getProfilesByIds([
                        house.owner_id
                    ]);

                const owner =
                    ownerProfiles[0] || null;

                // ------------------------------------------------
                // ROOMS
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
                    .order("position", {
                        ascending: true
                    });

                if (roomsError) {
                    throw roomsError;
                }

                // ------------------------------------------------
                // MEMBERS
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
                    .order("joined_at", {
                        ascending: true
                    });

                if (membersError) {
                    throw membersError;
                }

                const memberUserIds =
                    [
                        ...new Set(
                            (members || [])
                                .map(
                                    member =>
                                        member.user_id
                                )
                        )
                    ];

                const memberProfiles =
                    await getProfilesByIds(
                        memberUserIds
                    );

                const profileMap =
                    makeProfileMap(
                        memberProfiles
                    );

                const enrichedMembers =
                    (members || []).map(
                        member => ({
                            ...member,

                            profile:
                                profileMap[
                                    member.user_id
                                ] || null
                        })
                    );

                // ------------------------------------------------
                // CLEAN HOUSE OBJECT
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
                                    house
                                        .house_types
                                        .id,

                                name:
                                    house
                                        .house_types
                                        .name,

                                cost:
                                    house
                                        .house_types
                                        .cost,

                                tax_reduction:
                                    house
                                        .house_types
                                        .tax_reduction,

                                room_count:
                                    house
                                        .house_types
                                        .room_count
                            }
                            : null,

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

                    rooms:
                        rooms || [],

                    members:
                        enrichedMembers,

                    member_count:
                        enrichedMembers.length
                };

                return res.json({
                    house: cleanHouse,
                    membership
                });

            } catch (error) {
                console.error(
                    "GET HOUSE ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        "Failed to load house."
                });
            }
        }
    );

    // ========================================================
    // HOUSE INVITATIONS - INBOX
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
                    .from(
                        "house_invitations"
                    )
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
                            item =>
                                item.house_id
                        )
                    )
                ];

                const inviterIds = [
                    ...new Set(
                        rows.map(
                            item =>
                                item.inviter_id
                        )
                    )
                ];

                let houses = [];
                let inviters = [];

                if (houseIds.length) {
                    const {
                        data,
                        error
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

                    if (error) {
                        throw error;
                    }

                    houses =
                        data || [];
                }

                if (inviterIds.length) {
                    inviters =
                        await getProfilesByIds(
                            inviterIds
                        );
                }

                const houseMap = {};
                const inviterMap = {};

                for (const house of houses) {
                    houseMap[
                        house.id
                    ] = house;
                }

                for (const inviter of inviters) {
                    inviterMap[
                        inviter.id
                    ] = inviter;
                }

                const result =
                    rows.map(
                        invitation => {

                            const inviter =
                                inviterMap[
                                    invitation
                                        .inviter_id
                                ] || null;

                            return {
                                ...invitation,

                                house:
                                    houseMap[
                                        invitation
                                            .house_id
                                    ] || null,

                                inviter:
                                    inviter
                                        ? {
                                            id:
                                                inviter.id,

                                            username:
                                                inviter.username,

                                            display_name:
                                                inviter.display_name,

                                            avatar:
                                                inviter.avatar
                                        }
                                        : null
                            };
                        }
                    );

                return res.json(result);

            } catch (error) {
                console.error(
                    "HOUSE INVITATIONS ERROR:",
                    error
                );

                return res.status(500).json({
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
                    req.params.id;

                const inviterId =
                    req.houseUserId;

                const inviteeId =
                    req.body?.invitee_id;

                if (!inviteeId) {
                    return res.status(400).json({
                        error:
                            "Invitee is required."
                    });
                }

                if (
                    String(inviteeId) ===
                    String(inviterId)
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

                // ------------------------------------------------
                // INVITEE EXISTS
                // ------------------------------------------------

                const {
                    data: invitee,
                    error: inviteeError
                } = await supabase
                    .from("profiles")
                    .select("id")
                    .eq(
                        "id",
                        inviteeId
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

                // ------------------------------------------------
                // ALREADY MEMBER
                // ------------------------------------------------

                const alreadyMember =
                    await isHouseMember(
                        houseId,
                        inviteeId
                    );

                if (alreadyMember) {
                    return res.status(400).json({
                        error:
                            "That user is already a member of this house."
                    });
                }

                // ------------------------------------------------
                // EXISTING INVITE
                // ------------------------------------------------

                const {
                    data: existingInvitation,
                    error: existingError
                } = await supabase
                    .from(
                        "house_invitations"
                    )
                    .select("id")
                    .eq(
                        "house_id",
                        houseId
                    )
                    .eq(
                        "invitee_id",
                        inviteeId
                    )
                    .eq(
                        "status",
                        "pending"
                    )
                    .maybeSingle();

                if (existingError) {
                    throw existingError;
                }

                if (existingInvitation) {
                    return res.status(400).json({
                        error:
                            "That user already has a pending invitation."
                    });
                }

                // ------------------------------------------------
                // CREATE INVITE
                // ------------------------------------------------

                const {
                    data: invitation,
                    error
                } = await supabase
                    .from(
                        "house_invitations"
                    )
                    .insert({
                        house_id:
                            houseId,

                        inviter_id:
                            inviterId,

                        invitee_id:
                            inviteeId,

                        status:
                            "pending"
                    })
                    .select()
                    .single();

                if (error) {
                    throw error;
                }

                return res.status(201).json({
                    success: true,
                    invitation
                });

            } catch (error) {
                console.error(
                    "SEND INVITATION ERROR:",
                    error
                );

                return res.status(500).json({
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
                    req.params.id;

                const userId =
                    req.houseUserId;

                const response =
                    req.body?.response;

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
                    .from(
                        "house_invitations"
                    )
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
                    String(
                        invitation.invitee_id
                    ) !==
                    String(userId)
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

                // ------------------------------------------------
                // DECLINE
                // ------------------------------------------------

                if (
                    response === "declined"
                ) {
                    const {
                        data: updated,
                        error:
                            updateError
                    } = await supabase
                        .from(
                            "house_invitations"
                        )
                        .update({
                            status:
                                "declined",

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

                    return res.json({
                        success: true,
                        invitation:
                            updated
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
                    const {
                        error:
                            memberError
                    } = await supabase
                        .from(
                            "house_members"
                        )
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

                const {
                    data: updated,
                    error: updateError
                } = await supabase
                    .from(
                        "house_invitations"
                    )
                    .update({
                        status:
                            "accepted",

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

                return res.json({
                    success: true,
                    invitation:
                        updated
                });

            } catch (error) {
                console.error(
                    "RESPOND INVITATION ERROR:",
                    error
                );

                return res.status(500).json({
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
                const houseId =
                    req.params.houseId;

                const roomId =
                    req.params.roomId;

                const userId =
                    req.houseUserId;

                const verified =
                    await verifyRoomMembership(
                        houseId,
                        roomId,
                        userId
                    );

                if (!verified.ok) {
                    return res.status(
                        verified.status
                    ).json({
                        error:
                            verified.error
                    });
                }

                const room =
                    verified.room;

                // ------------------------------------------------
                // MESSAGES
                // ------------------------------------------------

                const {
                    data: messages,
                    error:
                        messagesError
                } = await supabase
                    .from(
                        "house_messages"
                    )
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
                // MESSAGE PROFILES
                // ------------------------------------------------

                const userIds = [
                    ...new Set(
                        (messages || [])
                            .map(
                                message =>
                                    message.user_id
                            )
                            .filter(Boolean)
                    )
                ];

                const profiles =
                    await getProfilesByIds(
                        userIds
                    );

                const profileMap =
                    makeProfileMap(
                        profiles
                    );

                const enrichedMessages =
                    (messages || []).map(
                        message => ({
                            ...message,

                            profile:
                                profileMap[
                                    message.user_id
                                ] || null
                        })
                    );

                return res.json({
                    room,

                    messages:
                        enrichedMessages
                });

            } catch (error) {
                console.error(
                    "GET HOUSE ROOM ERROR:",
                    error
                );

                return res.status(500).json({
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
                const houseId =
                    req.params.houseId;

                const roomId =
                    req.params.roomId;

                const userId =
                    req.houseUserId;

                const content =
                    typeof req.body?.content ===
                    "string"
                        ? req.body.content.trim()
                        : "";

                if (!content) {
                    return res.status(400).json({
                        error:
                            "Message cannot be empty."
                    });
                }

                if (
                    content.length >
                    10000
                ) {
                    return res.status(400).json({
                        error:
                            "Message is too long."
                    });
                }

                const verified =
                    await verifyRoomMembership(
                        houseId,
                        roomId,
                        userId
                    );

                if (!verified.ok) {
                    return res.status(
                        verified.status
                    ).json({
                        error:
                            verified.error
                    });
                }

                const {
                    data: message,
                    error
                } = await supabase
                    .from(
                        "house_messages"
                    )
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

                return res.status(201).json({
                    success: true,
                    message
                });

            } catch (error) {
                console.error(
                    "SEND HOUSE MESSAGE ERROR:",
                    error
                );

                return res.status(500).json({
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
                    req.params.houseId;

                const messageId =
                    req.params.messageId;

                const userId =
                    req.houseUserId;

                const {
                    data: message,
                    error
                } = await supabase
                    .from(
                        "house_messages"
                    )
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
                    String(
                        messageHouseId
                    ) !==
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

                const isOwner =
                    String(
                        message.user_id
                    ) ===
                    String(userId);

                if (!admin && !isOwner) {
                    return res.status(403).json({
                        error:
                            "You do not have permission to delete this message."
                    });
                }

                // ------------------------------------------------
                // MEDIA FILES
                // ------------------------------------------------

                const {
                    data: media,
                    error:
                        mediaError
                } = await supabase
                    .from(
                        "house_media"
                    )
                    .select(
                        "storage_path"
                    )
                    .eq(
                        "message_id",
                        messageId
                    );

                if (mediaError) {
                    throw mediaError;
                }

                // ------------------------------------------------
                // DELETE MESSAGE
                // ------------------------------------------------

                const {
                    error:
                        deleteError
                } = await supabase
                    .from(
                        "house_messages"
                    )
                    .delete()
                    .eq(
                        "id",
                        messageId
                    );

                if (deleteError) {
                    throw deleteError;
                }

                // ------------------------------------------------
                // DELETE STORAGE
                // ------------------------------------------------

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
                        await supabase
                            .storage
                            .from(
                                "house-media"
                            )
                            .remove(
                                paths
                            );
                    }
                }

                return res.json({
                    success: true
                });

            } catch (error) {
                console.error(
                    "DELETE HOUSE MESSAGE ERROR:",
                    error
                );

                return res.status(500).json({
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

                const mediaType =
                    getMediaType(
                        req.file.mimetype
                    );

                if (!mediaType) {
                    return res.status(400).json({
                        error:
                            "Unable to determine media type."
                    });
                }

                const verified =
                    await verifyRoomMembership(
                        houseId,
                        roomId,
                        userId
                    );

                if (!verified.ok) {
                    return res.status(
                        verified.status
                    ).json({
                        error:
                            verified.error
                    });
                }

                // ------------------------------------------------
                // STORAGE PATH
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
                // UPLOAD
                // ------------------------------------------------

                const {
                    error: uploadError
                } = await supabase
                    .storage
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

                // ------------------------------------------------
                // OPTIONAL CAPTION
                // ------------------------------------------------

                const content =
                    typeof req.body?.content ===
                    "string"
                        ? req.body.content.trim()
                        : "";

                if (
                    content.length >
                    10000
                ) {
                    await supabase
                        .storage
                        .from(
                            "house-media"
                        )
                        .remove([
                            storagePath
                        ]);

                    return res.status(400).json({
                        error:
                            "Message is too long."
                    });
                }

                // ------------------------------------------------
                // MESSAGE
                // ------------------------------------------------

                const {
                    data: message,
                    error:
                        messageError
                } = await supabase
                    .from(
                        "house_messages"
                    )
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
                    await supabase
                        .storage
                        .from(
                            "house-media"
                        )
                        .remove([
                            storagePath
                        ]);

                    throw messageError;
                }

                // ------------------------------------------------
                // MEDIA RECORD
                // ------------------------------------------------

                const {
                    data: media,
                    error:
                        mediaError
                } = await supabase
                    .from(
                        "house_media"
                    )
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
                            req.file
                                .originalname,

                        storage_path:
                            storagePath,

                        mime_type:
                            req.file
                                .mimetype,

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

                    await supabase
                        .storage
                        .from(
                            "house-media"
                        )
                        .remove([
                            storagePath
                        ]);

                    throw mediaError;
                }

                // ------------------------------------------------
                // PUBLIC URL
                // ------------------------------------------------

                const {
                    data: publicUrlData
                } = supabase
                    .storage
                    .from(
                        "house-media"
                    )
                    .getPublicUrl(
                        storagePath
                    );

                media.url =
                    publicUrlData
                        ?.publicUrl ||
                    null;

                return res.status(201).json({
                    success: true,
                    message,
                    media
                });

            } catch (error) {
                console.error(
                    "HOUSE MEDIA UPLOAD ERROR:",
                    error
                );

                return res.status(500).json({
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
                const houseId =
                    req.params.houseId;

                const roomId =
                    req.params.roomId;

                const userId =
                    req.houseUserId;

                const callType =
                    req.body?.call_type;

                if (
                    callType !== "voice" &&
                    callType !== "video"
                ) {
                    return res.status(400).json({
                        error:
                            "Call type must be voice or video."
                    });
                }

                const verified =
                    await verifyRoomMembership(
                        houseId,
                        roomId,
                        userId
                    );

                if (!verified.ok) {
                    return res.status(
                        verified.status
                    ).json({
                        error:
                            verified.error
                    });
                }

                // ------------------------------------------------
                // EXISTING CALL
                // ------------------------------------------------

                const {
                    data: existingCall,
                    error:
                        existingCallError
                } = await supabase
                    .from(
                        "house_calls"
                    )
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

                if (existingCallError) {
                    throw existingCallError;
                }

                if (existingCall) {
                    // Make sure caller is a participant
                    await supabase
                        .from(
                            "house_call_participants"
                        )
                        .upsert(
                            {
                                call_id:
                                    existingCall.id,

                                user_id:
                                    userId,

                                left_at:
                                    null
                            },
                            {
                                onConflict:
                                    "call_id,user_id"
                            }
                        );

                    return res.json({
                        success: true,
                        call:
                            existingCall
                    });
                }

                // ------------------------------------------------
                // CREATE CALL
                // ------------------------------------------------

                const {
                    data: call,
                    error
                } = await supabase
                    .from(
                        "house_calls"
                    )
                    .insert({
                        room_id:
                            roomId,

                        started_by:
                            userId,

                        call_type:
                            callType,

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

                // ------------------------------------------------
                // CREATOR PARTICIPANT
                // ------------------------------------------------

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

                return res.status(201).json({
                    success: true,
                    call
                });

            } catch (error) {
                console.error(
                    "CREATE HOUSE CALL ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        "Failed to create call."
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
                const houseId =
                    req.params.houseId;

                const roomId =
                    req.params.roomId;

                const userId =
                    req.houseUserId;

                const verified =
                    await verifyRoomMembership(
                        houseId,
                        roomId,
                        userId
                    );

                if (!verified.ok) {
                    return res.status(
                        verified.status
                    ).json({
                        error:
                            verified.error
                    });
                }

                const {
                    data: call,
                    error
                } = await supabase
                    .from(
                        "house_calls"
                    )
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

                return res.json({
                    call,

                    participants:
                        participants || []
                });

            } catch (error) {
                console.error(
                    "GET ACTIVE CALL ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
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
                    .from(
                        "house_calls"
                    )
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

                if (!houseId) {
                    return res.status(404).json({
                        error:
                            "Room not found."
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

                const {
                    data:
                        existingParticipant,
                    error:
                        existingError
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

                if (existingError) {
                    throw existingError;
                }

                let participant;

                if (
                    existingParticipant
                ) {
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
                            existingParticipant.id
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

                return res.json({
                    success: true,
                    call,
                    participant
                });

            } catch (error) {
                console.error(
                    "JOIN HOUSE CALL ERROR:",
                    error
                );

                return res.status(500).json({
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
                const callId =
                    req.params.callId;

                const userId =
                    req.houseUserId;

                const {
                    data: participant,
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

                if (participantError) {
                    throw participantError;
                }

                if (!participant) {
                    return res.status(404).json({
                        error:
                            "You are not in this call."
                    });
                }

                const {
                    error
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

                if (error) {
                    throw error;
                }

                return res.json({
                    success: true
                });

            } catch (error) {
                console.error(
                    "LEAVE HOUSE CALL ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
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
                    .from(
                        "house_calls"
                    )
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

                if (!houseId) {
                    return res.status(404).json({
                        error:
                            "Room not found."
                    });
                }

                const admin =
                    await isHouseAdmin(
                        houseId,
                        userId
                    );

                if (
                    String(
                        call.started_by
                    ) !==
                    String(userId) &&
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
                    .from(
                        "house_calls"
                    )
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

                return res.json({
                    success: true
                });

            } catch (error) {
                console.error(
                    "END HOUSE CALL ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        "Failed to end call."
                });
            }
        }
    );

    // ========================================================
    // SEND CALL SIGNAL
    //
    // HTTP POLLING
    // NO WEBSOCKETS
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
                } = req.body || {};

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
                    error:
                        callError
                } = await supabase
                    .from(
                        "house_calls"
                    )
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

                if (callError) {
                    throw callError;
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
                            "This call is no longer active."
                    });
                }

                const houseId =
                    await getRoomHouseId(
                        call.room_id
                    );

                if (!houseId) {
                    return res.status(404).json({
                        error:
                            "Room not found."
                    });
                }

                const senderMember =
                    await isHouseMember(
                        houseId,
                        userId
                    );

                if (!senderMember) {
                    return res.status(403).json({
                        error:
                            "You are not a member of this house."
                    });
                }

                if (
                    recipient_id &&
                    String(
                        recipient_id
                    ) ===
                        String(userId)
                ) {
                    return res.status(400).json({
                        error:
                            "You cannot send a signal to yourself."
                    });
                }

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

                const {
                    data: signal,
                    error
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
                            recipient_id ||
                            null,

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

                return res.status(201).json({
                    success: true,
                    signal
                });

            } catch (error) {
                console.error(
                    "SEND CALL SIGNAL ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        "Failed to send call signal."
                });
            }
        }
    );

    // ========================================================
    // GET CALL SIGNALS
    //
    // FRONTEND POLLS THIS
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

                let afterId =
                    Number(
                        req.query.after_id ||
                            0
                    );

                if (
                    !Number.isFinite(
                        afterId
                    ) ||
                    afterId < 0
                ) {
                    afterId = 0;
                }

                const {
                    data: call,
                    error:
                        callError
                } = await supabase
                    .from(
                        "house_calls"
                    )
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

                if (callError) {
                    throw callError;
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

                if (!houseId) {
                    return res.status(404).json({
                        error:
                            "Room not found."
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

                let query =
                    supabase
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
                        .order(
                            "id",
                            {
                                ascending:
                                    true
                            }
                        )
                        .limit(100);

                // Only:
                // 1. signals specifically for this user
                // 2. broadcast signals
                query =
                    query.or(
                        `recipient_id.eq.${userId},recipient_id.is.null`
                    );

                const {
                    data: signals,
                    error
                } = await query;

                if (error) {
                    throw error;
                }

                return res.json({
                    signals:
                        signals || [],

                    active:
                        call.active
                });

            } catch (error) {
                console.error(
                    "GET CALL SIGNALS ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
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
                    .from(
                        "house_calls"
                    )
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

                if (!houseId) {
                    return res.status(404).json({
                        error:
                            "Room not found."
                    });
                }

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

                return res.json({
                    success: true
                });

            } catch (error) {
                console.error(
                    "DELETE CALL SIGNALS ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        "Failed to delete call signals."
                });
            }
        }
    );

    // ========================================================
    // DONE
    // ========================================================

    return router;
};