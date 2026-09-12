const express = require("express");
const crypto = require("crypto");

module.exports = function createHouseRouter({ supabase }) {
    const router = express.Router();

    // ========================================================
    // AUTH
    // ========================================================

    function requireLogin(req, res, next) {
        if (!req.session?.user?.id) {
            return res.status(401).json({
                error: "You must be logged in."
            });
        }

        req.houseUserId = req.session.user.id;
        next();
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

    async function requireHouseMember(req, res, next) {
        try {
            const membership = await getMembership(
                req.params.houseId,
                req.houseUserId
            );

            if (!membership) {
                return res.status(403).json({
                    error: "You are not a member of this house."
                });
            }

            req.houseMembership = membership;
            next();
        } catch (error) {
            console.error(error);

            return res.status(500).json({
                error: "Failed to check house membership."
            });
        }
    }

    function requireAdmin(req, res, next) {
        if (
            req.houseMembership.role !== "owner" &&
            req.houseMembership.role !== "admin"
        ) {
            return res.status(403).json({
                error: "House admin permission required."
            });
        }

        next();
    }

    function requireOwner(req, res, next) {
        if (req.houseMembership.role !== "owner") {
            return res.status(403).json({
                error: "House owner permission required."
            });
        }

        next();
    }

    async function getProfile(userId) {
        const { data, error } = await supabase
            .from("profiles")
            .select(`
                id,
                username,
                display_name,
                avatar
            `)
            .eq("id", userId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return data;
    }

    async function getHouse(houseId) {
        const { data, error } = await supabase
            .from("houses")
            .select("*")
            .eq("id", houseId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return data;
    }

    async function getRoom(roomId) {
        const { data, error } = await supabase
            .from("house_rooms")
            .select("*")
            .eq("id", roomId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return data;
    }

    async function roomBelongsToHouse(roomId, houseId) {
        const room = await getRoom(roomId);

        if (!room || String(room.house_id) !== String(houseId)) {
            return null;
        }

        return room;
    }

    // ========================================================
    // DIRECTORY
    // ========================================================

    router.get(
        "/houses",
        requireLogin,
        async (req, res) => {
            try {
                const { data, error } = await supabase
                    .from("houses")
                    .select("*")
                    .order("created_at", {
                        ascending: false
                    });

                if (error) throw error;

                const houses = [];

                for (const house of data || []) {
                    const { count } = await supabase
                        .from("house_members")
                        .select("*", {
                            count: "exact",
                            head: true
                        })
                        .eq("house_id", house.id);

                    houses.push({
                        ...house,
                        member_count: count || 0
                    });
                }

                res.json({
                    houses
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to load houses."
                });
            }
        }
    );

    // ========================================================
    // CREATE HOUSE
    // ========================================================

    router.post(
        "/houses",
        requireLogin,
        async (req, res) => {
            try {
                const name = String(req.body.name || "").trim();
                const description = String(
                    req.body.description || ""
                ).trim();

                if (!name) {
                    return res.status(400).json({
                        error: "House name is required."
                    });
                }

                if (name.length > 80) {
                    return res.status(400).json({
                        error: "House name is too long."
                    });
                }

                const { data: house, error } = await supabase
                    .from("houses")
                    .insert({
                        name,
                        description,
                        owner_id: req.houseUserId
                    })
                    .select()
                    .single();

                if (error) throw error;

                const { error: memberError } = await supabase
                    .from("house_members")
                    .insert({
                        house_id: house.id,
                        user_id: req.houseUserId,
                        role: "owner"
                    });

                if (memberError) throw memberError;

                const defaultRooms = [
                    {
                        house_id: house.id,
                        name: "general",
                        description: "General house chat",
                        room_type: "text",
                        position: 0
                    },
                    {
                        house_id: house.id,
                        name: "announcements",
                        description: "Important house announcements",
                        room_type: "announcement",
                        position: 1
                    },
                    {
                        house_id: house.id,
                        name: "voice",
                        description: "House voice chat",
                        room_type: "voice",
                        position: 2
                    }
                ];

                const { error: roomError } = await supabase
                    .from("house_rooms")
                    .insert(defaultRooms);

                if (roomError) throw roomError;

                res.status(201).json({
                    house
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to create house."
                });
            }
        }
    );

    // ========================================================
    // HOUSE DETAILS
    // ========================================================

    router.get(
        "/houses/:houseId",
        requireLogin,
        requireHouseMember,
        async (req, res) => {
            try {
                const house = await getHouse(req.params.houseId);

                if (!house) {
                    return res.status(404).json({
                        error: "House not found."
                    });
                }

                const { data: rooms, error: roomError } = await supabase
                    .from("house_rooms")
                    .select("*")
                    .eq("house_id", house.id)
                    .order("position", {
                        ascending: true
                    });

                if (roomError) throw roomError;

                const { data: members, error: memberError } = await supabase
                    .from("house_members")
                    .select(`
                        id,
                        house_id,
                        user_id,
                        role,
                        joined_at
                    `)
                    .eq("house_id", house.id)
                    .order("joined_at", {
                        ascending: true
                    });

                if (memberError) throw memberError;

                const membersWithProfiles = [];

                for (const member of members || []) {
                    const profile = await getProfile(member.user_id);

                    membersWithProfiles.push({
                        ...member,
                        profile
                    });
                }

                res.json({
                    house,
                    membership: req.houseMembership,
                    rooms: rooms || [],
                    members: membersWithProfiles
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
    // UPDATE HOUSE
    // ========================================================

    router.put(
        "/houses/:houseId",
        requireLogin,
        requireHouseMember,
        requireAdmin,
        async (req, res) => {
            try {
                const name = String(req.body.name || "").trim();
                const description = String(
                    req.body.description || ""
                ).trim();

                if (!name) {
                    return res.status(400).json({
                        error: "House name is required."
                    });
                }

                const { data, error } = await supabase
                    .from("houses")
                    .update({
                        name,
                        description
                    })
                    .eq("id", req.params.houseId)
                    .select()
                    .single();

                if (error) throw error;

                res.json({
                    house: data
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to update house."
                });
            }
        }
    );

    // ========================================================
    // DELETE HOUSE
    // ========================================================

    router.delete(
        "/houses/:houseId",
        requireLogin,
        requireHouseMember,
        requireOwner,
        async (req, res) => {
            try {
                const { error } = await supabase
                    .from("houses")
                    .delete()
                    .eq("id", req.params.houseId);

                if (error) throw error;

                res.json({
                    success: true
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to delete house."
                });
            }
        }
    );

    // ========================================================
    // MEMBERS
    // ========================================================

    router.get(
        "/houses/:houseId/members",
        requireLogin,
        requireHouseMember,
        async (req, res) => {
            try {
                const { data, error } = await supabase
                    .from("house_members")
                    .select("*")
                    .eq("house_id", req.params.houseId)
                    .order("joined_at", {
                        ascending: true
                    });

                if (error) throw error;

                const members = [];

                for (const member of data || []) {
                    members.push({
                        ...member,
                        profile: await getProfile(member.user_id)
                    });
                }

                res.json({
                    members
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to load members."
                });
            }
        }
    );

    // ========================================================
    // CHANGE MEMBER ROLE
    // ========================================================

    router.put(
        "/houses/:houseId/members/:userId/role",
        requireLogin,
        requireHouseMember,
        requireOwner,
        async (req, res) => {
            try {
                const role = req.body.role;

                if (!["admin", "member"].includes(role)) {
                    return res.status(400).json({
                        error: "Invalid role."
                    });
                }

                if (
                    String(req.params.userId) ===
                    String(req.houseUserId)
                ) {
                    return res.status(400).json({
                        error: "You cannot change your own owner role."
                    });
                }

                const { data, error } = await supabase
                    .from("house_members")
                    .update({
                        role
                    })
                    .eq("house_id", req.params.houseId)
                    .eq("user_id", req.params.userId)
                    .select()
                    .single();

                if (error) throw error;

                res.json({
                    membership: data
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to change member role."
                });
            }
        }
    );

    // ========================================================
    // REMOVE MEMBER
    // ========================================================

    router.delete(
        "/houses/:houseId/members/:userId",
        requireLogin,
        requireHouseMember,
        async (req, res) => {
            try {
                const target = await getMembership(
                    req.params.houseId,
                    req.params.userId
                );

                if (!target) {
                    return res.status(404).json({
                        error: "Member not found."
                    });
                }

                if (target.role === "owner") {
                    return res.status(400).json({
                        error: "The owner cannot be removed."
                    });
                }

                if (
                    req.houseMembership.role === "member"
                ) {
                    return res.status(403).json({
                        error: "You do not have permission."
                    });
                }

                if (
                    req.houseMembership.role === "admin" &&
                    target.role === "admin"
                ) {
                    return res.status(403).json({
                        error: "Admins cannot remove other admins."
                    });
                }

                const { error } = await supabase
                    .from("house_members")
                    .delete()
                    .eq("house_id", req.params.houseId)
                    .eq("user_id", req.params.userId);

                if (error) throw error;

                res.json({
                    success: true
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to remove member."
                });
            }
        }
    );

    // ========================================================
    // LEAVE HOUSE
    // ========================================================

    router.post(
        "/houses/:houseId/leave",
        requireLogin,
        requireHouseMember,
        async (req, res) => {
            try {
                if (req.houseMembership.role === "owner") {
                    return res.status(400).json({
                        error: "The owner cannot leave. Delete the house instead."
                    });
                }

                const { error } = await supabase
                    .from("house_members")
                    .delete()
                    .eq("house_id", req.params.houseId)
                    .eq("user_id", req.houseUserId);

                if (error) throw error;

                res.json({
                    success: true
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to leave house."
                });
            }
        }
    );

    // ========================================================
    // ROOMS
    // ========================================================

    router.get(
        "/houses/:houseId/rooms",
        requireLogin,
        requireHouseMember,
        async (req, res) => {
            try {
                const { data, error } = await supabase
                    .from("house_rooms")
                    .select("*")
                    .eq("house_id", req.params.houseId)
                    .order("position", {
                        ascending: true
                    });

                if (error) throw error;

                res.json({
                    rooms: data || []
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to load rooms."
                });
            }
        }
    );

    router.post(
        "/houses/:houseId/rooms",
        requireLogin,
        requireHouseMember,
        requireAdmin,
        async (req, res) => {
            try {
                const name = String(req.body.name || "").trim();
                const description = String(
                    req.body.description || ""
                ).trim();

                const roomType = [
                    "text",
                    "voice",
                    "media",
                    "announcement"
                ].includes(req.body.room_type)
                    ? req.body.room_type
                    : "text";

                if (!name) {
                    return res.status(400).json({
                        error: "Room name is required."
                    });
                }

                const { data: positionData } = await supabase
                    .from("house_rooms")
                    .select("position")
                    .eq("house_id", req.params.houseId)
                    .order("position", {
                        ascending: false
                    })
                    .limit(1);

                const position =
                    positionData?.length
                        ? positionData[0].position + 1
                        : 0;

                const { data, error } = await supabase
                    .from("house_rooms")
                    .insert({
                        house_id: req.params.houseId,
                        name,
                        description,
                        room_type: roomType,
                        position
                    })
                    .select()
                    .single();

                if (error) throw error;

                res.status(201).json({
                    room: data
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to create room."
                });
            }
        }
    );

    router.put(
        "/houses/:houseId/rooms/:roomId",
        requireLogin,
        requireHouseMember,
        requireAdmin,
        async (req, res) => {
            try {
                const room = await roomBelongsToHouse(
                    req.params.roomId,
                    req.params.houseId
                );

                if (!room) {
                    return res.status(404).json({
                        error: "Room not found."
                    });
                }

                const updates = {};

                if (req.body.name !== undefined) {
                    updates.name = String(
                        req.body.name
                    ).trim();
                }

                if (req.body.description !== undefined) {
                    updates.description = String(
                        req.body.description
                    ).trim();
                }

                if (
                    req.body.room_type &&
                    [
                        "text",
                        "voice",
                        "media",
                        "announcement"
                    ].includes(req.body.room_type)
                ) {
                    updates.room_type = req.body.room_type;
                }

                if (req.body.position !== undefined) {
                    updates.position =
                        Number(req.body.position) || 0;
                }

                const { data, error } = await supabase
                    .from("house_rooms")
                    .update(updates)
                    .eq("id", room.id)
                    .select()
                    .single();

                if (error) throw error;

                res.json({
                    room: data
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to update room."
                });
            }
        }
    );

    router.delete(
        "/houses/:houseId/rooms/:roomId",
        requireLogin,
        requireHouseMember,
        requireAdmin,
        async (req, res) => {
            try {
                const room = await roomBelongsToHouse(
                    req.params.roomId,
                    req.params.houseId
                );

                if (!room) {
                    return res.status(404).json({
                        error: "Room not found."
                    });
                }

                const { error } = await supabase
                    .from("house_rooms")
                    .delete()
                    .eq("id", room.id);

                if (error) throw error;

                res.json({
                    success: true
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to delete room."
                });
            }
        }
    );

    // ========================================================
    // MESSAGES
    // ========================================================

    router.get(
        "/houses/:houseId/rooms/:roomId/messages",
        requireLogin,
        requireHouseMember,
        async (req, res) => {
            try {
                const room = await roomBelongsToHouse(
                    req.params.roomId,
                    req.params.houseId
                );

                if (!room) {
                    return res.status(404).json({
                        error: "Room not found."
                    });
                }

                const limit = Math.min(
                    Math.max(Number(req.query.limit) || 100, 1),
                    200
                );

                const { data, error } = await supabase
                    .from("house_messages")
                    .select("*")
                    .eq("room_id", room.id)
                    .order("id", {
                        ascending: false
                    })
                    .limit(limit);

                if (error) throw error;

                const messages = [];

                for (const message of (data || []).reverse()) {
                    const profile = await getProfile(
                        message.user_id
                    );

                    const { data: media } = await supabase
                        .from("house_message_media")
                        .select("*")
                        .eq("message_id", message.id);

                    messages.push({
                        ...message,
                        profile,
                        media: media || []
                    });
                }

                res.json({
                    messages
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to load messages."
                });
            }
        }
    );

    router.post(
        "/houses/:houseId/rooms/:roomId/messages",
        requireLogin,
        requireHouseMember,
        async (req, res) => {
            try {
                const room = await roomBelongsToHouse(
                    req.params.roomId,
                    req.params.houseId
                );

                if (!room) {
                    return res.status(404).json({
                        error: "Room not found."
                    });
                }

                const content = String(
                    req.body.content || ""
                ).trim();

                if (!content) {
                    return res.status(400).json({
                        error: "Message cannot be empty."
                    });
                }

                const { data, error } = await supabase
                    .from("house_messages")
                    .insert({
                        room_id: room.id,
                        user_id: req.houseUserId,
                        content
                    })
                    .select()
                    .single();

                if (error) throw error;

                res.status(201).json({
                    message: {
                        ...data,
                        profile: await getProfile(
                            req.houseUserId
                        ),
                        media: []
                    }
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to send message."
                });
            }
        }
    );

    // ========================================================
    // INVITATIONS
    // ========================================================

    router.get(
        "/houses/invitations",
        requireLogin,
        async (req, res) => {
            try {
                const { data, error } = await supabase
                    .from("house_invitations")
                    .select("*")
                    .eq("invitee_id", req.houseUserId)
                    .eq("status", "pending")
                    .order("created_at", {
                        ascending: false
                    });

                if (error) throw error;

                const invitations = [];

                for (const invite of data || []) {
                    const house = await getHouse(
                        invite.house_id
                    );

                    const inviter = await getProfile(
                        invite.inviter_id
                    );

                    invitations.push({
                        ...invite,
                        house,
                        inviter
                    });
                }

                res.json({
                    invitations
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to load invitations."
                });
            }
        }
    );

    router.post(
        "/houses/:houseId/invitations",
        requireLogin,
        requireHouseMember,
        requireAdmin,
        async (req, res) => {
            try {
                const username = String(
                    req.body.username || ""
                ).trim();

                if (!username) {
                    return res.status(400).json({
                        error: "Username is required."
                    });
                }

                const { data: profile, error: profileError } =
                    await supabase
                        .from("profiles")
                        .select("id, username, display_name, avatar")
                        .eq("username", username)
                        .maybeSingle();

                if (profileError) throw profileError;

                if (!profile) {
                    return res.status(404).json({
                        error: "User not found."
                    });
                }

                if (
                    String(profile.id) ===
                    String(req.houseUserId)
                ) {
                    return res.status(400).json({
                        error: "You cannot invite yourself."
                    });
                }

                const existing = await getMembership(
                    req.params.houseId,
                    profile.id
                );

                if (existing) {
                    return res.status(400).json({
                        error: "That user is already a member."
                    });
                }

                const { data, error } = await supabase
                    .from("house_invitations")
                    .upsert(
                        {
                            house_id: req.params.houseId,
                            inviter_id: req.houseUserId,
                            invitee_id: profile.id,
                            status: "pending",
                            responded_at: null
                        },
                        {
                            onConflict:
                                "house_id,invitee_id"
                        }
                    )
                    .select()
                    .single();

                if (error) throw error;

                res.status(201).json({
                    invitation: data
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to send invitation."
                });
            }
        }
    );

    router.post(
        "/houses/invitations/:id/respond",
        requireLogin,
        async (req, res) => {
            try {
                const action = req.body.action;

                if (!["accept", "decline"].includes(action)) {
                    return res.status(400).json({
                        error: "Invalid invitation action."
                    });
                }

                const { data: invitation, error } =
                    await supabase
                        .from("house_invitations")
                        .select("*")
                        .eq("id", req.params.id)
                        .eq("invitee_id", req.houseUserId)
                        .eq("status", "pending")
                        .maybeSingle();

                if (error) throw error;

                if (!invitation) {
                    return res.status(404).json({
                        error: "Invitation not found."
                    });
                }

                if (action === "decline") {
                    await supabase
                        .from("house_invitations")
                        .update({
                            status: "declined",
                            responded_at: new Date().toISOString()
                        })
                        .eq("id", invitation.id);

                    return res.json({
                        success: true
                    });
                }

                const existing = await getMembership(
                    invitation.house_id,
                    req.houseUserId
                );

                if (!existing) {
                    const { error: memberError } =
                        await supabase
                            .from("house_members")
                            .insert({
                                house_id: invitation.house_id,
                                user_id: req.houseUserId,
                                role: "member"
                            });

                    if (memberError) throw memberError;
                }

                const { error: inviteError } =
                    await supabase
                        .from("house_invitations")
                        .update({
                            status: "accepted",
                            responded_at:
                                new Date().toISOString()
                        })
                        .eq("id", invitation.id);

                if (inviteError) throw inviteError;

                res.json({
                    success: true,
                    house_id: invitation.house_id
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to respond to invitation."
                });
            }
        }
    );

    // ========================================================
    // CALLS
    // ========================================================

    router.post(
        "/houses/:houseId/rooms/:roomId/calls",
        requireLogin,
        requireHouseMember,
        async (req, res) => {
            try {
                const room = await roomBelongsToHouse(
                    req.params.roomId,
                    req.params.houseId
                );

                if (!room) {
                    return res.status(404).json({
                        error: "Room not found."
                    });
                }

                const callType =
                    req.body.call_type === "video"
                        ? "video"
                        : "voice";

                const { data: existing } = await supabase
                    .from("house_calls")
                    .select("*")
                    .eq("room_id", room.id)
                    .eq("active", true)
                    .maybeSingle();

                if (existing) {
                    return res.json({
                        call: existing
                    });
                }

                const { data, error } = await supabase
                    .from("house_calls")
                    .insert({
                        room_id: room.id,
                        started_by: req.houseUserId,
                        call_type: callType,
                        active: true
                    })
                    .select()
                    .single();

                if (error) throw error;

                await supabase
                    .from("house_call_participants")
                    .upsert(
                        {
                            call_id: data.id,
                            user_id: req.houseUserId,
                            left_at: null
                        },
                        {
                            onConflict:
                                "call_id,user_id"
                        }
                    );

                res.status(201).json({
                    call: data
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to start call."
                });
            }
        }
    );

    router.get(
        "/houses/:houseId/rooms/:roomId/calls/active",
        requireLogin,
        requireHouseMember,
        async (req, res) => {
            try {
                const room = await roomBelongsToHouse(
                    req.params.roomId,
                    req.params.houseId
                );

                if (!room) {
                    return res.status(404).json({
                        error: "Room not found."
                    });
                }

                const { data, error } = await supabase
                    .from("house_calls")
                    .select("*")
                    .eq("room_id", room.id)
                    .eq("active", true)
                    .maybeSingle();

                if (error) throw error;

                res.json({
                    call: data || null
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to check active call."
                });
            }
        }
    );

    router.post(
        "/houses/calls/:callId/join",
        requireLogin,
        async (req, res) => {
            try {
                const { data: call, error } = await supabase
                    .from("house_calls")
                    .select("*")
                    .eq("id", req.params.callId)
                    .eq("active", true)
                    .maybeSingle();

                if (error) throw error;

                if (!call) {
                    return res.status(404).json({
                        error: "Call not found."
                    });
                }

                const room = await getRoom(call.room_id);

                const membership = await getMembership(
                    room.house_id,
                    req.houseUserId
                );

                if (!membership) {
                    return res.status(403).json({
                        error: "You are not a house member."
                    });
                }

                await supabase
                    .from("house_call_participants")
                    .upsert(
                        {
                            call_id: call.id,
                            user_id: req.houseUserId,
                            left_at: null
                        },
                        {
                            onConflict:
                                "call_id,user_id"
                        }
                    );

                res.json({
                    call
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to join call."
                });
            }
        }
    );

    router.post(
        "/houses/calls/:callId/leave",
        requireLogin,
        async (req, res) => {
            try {
                const { error } = await supabase
                    .from("house_call_participants")
                    .update({
                        left_at: new Date().toISOString()
                    })
                    .eq("call_id", req.params.callId)
                    .eq("user_id", req.houseUserId);

                if (error) throw error;

                res.json({
                    success: true
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to leave call."
                });
            }
        }
    );

    router.post(
        "/houses/calls/:callId/end",
        requireLogin,
        async (req, res) => {
            try {
                const { data: call, error } = await supabase
                    .from("house_calls")
                    .select("*")
                    .eq("id", req.params.callId)
                    .maybeSingle();

                if (error) throw error;

                if (!call) {
                    return res.status(404).json({
                        error: "Call not found."
                    });
                }

                if (
                    String(call.started_by) !==
                    String(req.houseUserId)
                ) {
                    const room = await getRoom(call.room_id);

                    const membership = await getMembership(
                        room.house_id,
                        req.houseUserId
                    );

                    if (
                        !membership ||
                        !["owner", "admin"].includes(
                            membership.role
                        )
                    ) {
                        return res.status(403).json({
                            error: "You cannot end this call."
                        });
                    }
                }

                const { error: updateError } =
                    await supabase
                        .from("house_calls")
                        .update({
                            active: false,
                            ended_at:
                                new Date().toISOString()
                        })
                        .eq("id", call.id);

                if (updateError) throw updateError;

                res.json({
                    success: true
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to end call."
                });
            }
        }
    );

    // ========================================================
    // WEBRTC SIGNALING
    // ========================================================

    router.post(
        "/houses/calls/:callId/signals",
        requireLogin,
        async (req, res) => {
            try {
                const { data: call, error } = await supabase
                    .from("house_calls")
                    .select("*")
                    .eq("id", req.params.callId)
                    .eq("active", true)
                    .maybeSingle();

                if (error) throw error;

                if (!call) {
                    return res.status(404).json({
                        error: "Call not found."
                    });
                }

                const room = await getRoom(call.room_id);

                const membership = await getMembership(
                    room.house_id,
                    req.houseUserId
                );

                if (!membership) {
                    return res.status(403).json({
                        error: "You are not a member of this house."
                    });
                }

                const allowedTypes = [
                    "offer",
                    "answer",
                    "ice-candidate"
                ];

                if (
                    !allowedTypes.includes(
                        req.body.signal_type
                    )
                ) {
                    return res.status(400).json({
                        error: "Invalid signal type."
                    });
                }

                const { data, error: signalError } =
                    await supabase
                        .from("house_call_signals")
                        .insert({
                            call_id: call.id,
                            sender_id: req.houseUserId,
                            recipient_id:
                                req.body.recipient_id || null,
                            signal_type:
                                req.body.signal_type,
                            signal_data:
                                req.body.signal_data
                        })
                        .select()
                        .single();

                if (signalError) throw signalError;

                res.status(201).json({
                    signal: data
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to send signal."
                });
            }
        }
    );

    router.get(
        "/houses/calls/:callId/signals",
        requireLogin,
        async (req, res) => {
            try {
                const after = Number(
                    req.query.after || 0
                );

                const { data: call, error } = await supabase
                    .from("house_calls")
                    .select("*")
                    .eq("id", req.params.callId)
                    .maybeSingle();

                if (error) throw error;

                if (!call) {
                    return res.status(404).json({
                        error: "Call not found."
                    });
                }

                const room = await getRoom(call.room_id);

                const membership = await getMembership(
                    room.house_id,
                    req.houseUserId
                );

                if (!membership) {
                    return res.status(403).json({
                        error: "You are not a member."
                    });
                }

                const { data, error: signalError } =
                    await supabase
                        .from("house_call_signals")
                        .select("*")
                        .eq("call_id", call.id)
                        .gt("id", after)
                        .or(
                            `recipient_id.is.null,recipient_id.eq.${req.houseUserId}`
                        )
                        .neq("sender_id", req.houseUserId)
                        .order("id", {
                            ascending: true
                        })
                        .limit(100);

                if (signalError) throw signalError;

                res.json({
                    signals: data || []
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    error: "Failed to load signals."
                });
            }
        }
    );

    return router;
};