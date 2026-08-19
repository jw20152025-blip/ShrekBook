
require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing Supabase environment variables.");
    process.exit(1);
}

if (!SESSION_SECRET) {
    console.error("❌ Missing SESSION_SECRET.");
    process.exit(1);
}

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
);

const DEFAULT_AVATAR = "/default-avatar.png";

// ==================================================
// EXPRESS
// ==================================================

app.set("trust proxy", 1);

app.use(express.json({
    limit: "10mb"
}));

app.use(express.urlencoded({
    extended: true
}));

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 30
    }
}));

app.use(express.static(
    path.join(__dirname, "public")
));

// ==================================================
// HELPERS
// ==================================================

function getAvatar(avatar) {
    if (
        typeof avatar === "string" &&
        avatar.trim() !== ""
    ) {
        return avatar;
    }

    return DEFAULT_AVATAR;
}

function normalizeEmail(email) {
    return String(email || "")
        .trim()
        .toLowerCase();
}

// ==================================================
// LOGIN MIDDLEWARE
// ==================================================

function requireLogin(req, res, next) {

    if (!req.session.user) {
        return res.status(401).json({
            error: "You must be logged in."
        });
    }

    next();
}

//
// ==================================================
// SHREKBOOK ADMIN / STAFF SYSTEM
// ==================================================
// Uses profiles.role as the SINGLE source of truth.
//
// Roles:
// peasant
// moderator
// senior_moderator
// administrator
// owner
//
// IMPORTANT:
// Put this entire block BEFORE your final:
//
// app.use("/api", (req, res) => { ... });
//
// ==================================================


// ==================================================
// ADMIN ROLE DEFINITIONS
// ==================================================

const ADMIN_ROLE_POWER = {
    peasant: 1,
    moderator: 2,
    senior_moderator: 3,
    administrator: 4,
    owner: 5
};


// ==================================================
// ADMIN ROLE CHECK
// ==================================================

function isAdminStaffRole(role) {

    return (
        role === "owner" ||
        role === "administrator" ||
        role === "senior_moderator" ||
        role === "moderator"
    );

}


// ==================================================
// GET CURRENT STAFF MEMBER
// ==================================================

async function getAdminUser(req) {

    if (
        !req.session ||
        !req.session.user ||
        !req.session.user.id
    ) {
        return null;
    }


    const userId =
        req.session.user.id;


    const {
        data: profile,
        error
    } =
        await supabase
            .from("profiles")
            .select(`
                id,
                username,
                display_name,
                avatar,
                role
            `)
            .eq(
                "id",
                userId
            )
            .maybeSingle();


    if (error) {

        console.error(
            "GET ADMIN USER ERROR:",
            error
        );

        return null;

    }


    return profile || null;

}


// ==================================================
// REQUIRE STAFF
// ==================================================

async function requireAdminStaff(
    req,
    res,
    next
) {

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


        const profile =
            await getAdminUser(req);


        if (!profile) {

            return res.status(403).json({
                error:
                    "Staff profile not found."
            });

        }


        if (
            !isAdminStaffRole(
                profile.role
            )
        ) {

            return res.status(403).json({
                error:
                    "Staff access required."
            });

        }


        req.adminProfile =
            profile;


        next();

    }

    catch (error) {

        console.error(
            "REQUIRE ADMIN ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Could not verify staff access."
        });

    }

}


// ==================================================
// REQUIRE ADMINISTRATOR / OWNER
// ==================================================

async function requireAdministrator(
    req,
    res,
    next
) {

    try {

        if (
            !req.adminProfile
        ) {

            return res.status(403).json({
                error:
                    "Staff access required."
            });

        }


        const power =
            ADMIN_ROLE_POWER[
                req.adminProfile.role
            ] || 0;


        if (power < 4) {

            return res.status(403).json({
                error:
                    "Administrator access required."
            });

        }


        next();

    }

    catch (error) {

        console.error(
            "REQUIRE ADMINISTRATOR ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Permission check failed."
        });

    }

}


// ==================================================
// CHECK STAFF STATUS
// ==================================================

app.get(
    "/api/admin/me",
    requireLogin,
    async (req, res) => {

        try {

            const profile =
                await getAdminUser(req);


            if (!profile) {

                return res.json({
                    isStaff: false
                });

            }


            const isStaff =
                isAdminStaffRole(
                    profile.role
                );


            res.json({

                isStaff,

                role:
                    profile.role ||
                    "peasant",

                user: {

                    id:
                        profile.id,

                    username:
                        profile.username,

                    display_name:
                        profile.display_name,

                    avatar:
                        profile.avatar

                }

            });

        }

        catch (error) {

            console.error(
                "ADMIN ME ERROR:",
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
// GET USERS
// ==================================================

app.get(
    "/api/admin/users",
    requireLogin,
    requireAdminStaff,
    async (req, res) => {

        try {

            const search =
                String(
                    req.query.search ||
                    ""
                )
                .trim()
                .toLowerCase();


            let query =
                supabase
                    .from("profiles")
                    .select(`
                        id,
                        username,
                        display_name,
                        avatar,
                        role,
                        last_seen
                    `)
                    .order(
                        "username",
                        {
                            ascending:
                                true
                        }
                    )
                    .limit(500);


            if (search) {

                query =
                    query.or(
                        `username.ilike.%${search}%,display_name.ilike.%${search}%`
                    );

            }


            const {
                data: users,
                error
            } =
                await query;


            if (error) {

                console.error(
                    "ADMIN USERS ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.json(
                users || []
            );

        }

        catch (error) {

            console.error(
                "ADMIN USERS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not load users."
            });

        }

    }
);


// ==================================================
// CHANGE ROLE
// ==================================================

app.post(
    "/api/admin/role",
    requireLogin,
    requireAdminStaff,
    async (req, res) => {

        try {

            const actor =
                req.adminProfile;


            const {
                user_id,
                role
            } =
                req.body;


            const allowedRoles = [
                "peasant",
                "moderator",
                "senior_moderator",
                "administrator"
            ];


            if (!user_id) {

                return res.status(400).json({
                    error:
                        "Missing user_id."
                });

            }


            if (
                !allowedRoles.includes(
                    role
                )
            ) {

                return res.status(400).json({
                    error:
                        "Invalid role."
                });

            }


            const actorPower =
                ADMIN_ROLE_POWER[
                    actor.role
                ] || 0;


            if (actorPower < 4) {

                return res.status(403).json({
                    error:
                        "Administrator access required."
                });

            }


            // ------------------------------------------
            // Get target
            // ------------------------------------------

            const {
                data: target,
                error: targetError
            } =
                await supabase
                    .from("profiles")
                    .select(`
                        id,
                        username,
                        display_name,
                        role
                    `)
                    .eq(
                        "id",
                        user_id
                    )
                    .maybeSingle();


            if (
                targetError ||
                !target
            ) {

                return res.status(404).json({
                    error:
                        "User not found."
                });

            }


            // ------------------------------------------
            // Owner protection
            // ------------------------------------------

            if (
                target.role ===
                "owner"
            ) {

                return res.status(403).json({
                    error:
                        "The owner is protected."
                });

            }


            // ------------------------------------------
            // Do not modify yourself
            // ------------------------------------------

            if (
                target.id ===
                actor.id
            ) {

                return res.status(403).json({
                    error:
                        "You cannot change your own role."
                });

            }


            // ------------------------------------------
            // Cannot modify someone with equal/higher
            // power
            // ------------------------------------------

            const targetPower =
                ADMIN_ROLE_POWER[
                    target.role
                ] || 0;


            if (
                targetPower >=
                actorPower
            ) {

                return res.status(403).json({
                    error:
                        "You cannot modify a staff member with equal or higher power."
                });

            }


            // ------------------------------------------
            // Actually update profiles.role
            // ------------------------------------------

            const {
                data: updated,
                error: updateError
            } =
                await supabase
                    .from("profiles")
                    .update({
                        role
                    })
                    .eq(
                        "id",
                        user_id
                    )
                    .select(`
                        id,
                        username,
                        display_name,
                        avatar,
                        role
                    `)
                    .single();


            if (updateError) {

                console.error(
                    "ROLE UPDATE ERROR:",
                    updateError
                );

                return res.status(500).json({
                    error:
                        updateError.message
                });

            }


            console.log(
                `ROLE CHANGE: ${target.username} -> ${role}`
            );


            res.json({

                success: true,

                user:
                    updated

            });

        }

        catch (error) {

            console.error(
                "ROLE API ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not change role."
            });

        }

    }
);


// ==================================================
// GET ADMINISTRATORS
// ==================================================

app.get(
    "/api/admin/admins",
    requireLogin,
    requireAdminStaff,
    async (req, res) => {

        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("profiles")
                    .select(`
                        id,
                        username,
                        display_name,
                        avatar,
                        role
                    `)
                    .in(
                        "role",
                        [
                            "administrator",
                            "owner"
                        ]
                    )
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


            res.json({
                admins:
                    data || []
            });

        }

        catch (error) {

            console.error(
                "ADMIN LIST ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not load administrators."
            });

        }

    }
);


// ==================================================
// ADD ADMINISTRATOR
// ==================================================
// This now simply changes profiles.role.
// There is NO separate admin table.

app.post(
    "/api/admin/admins",
    requireLogin,
    requireAdminStaff,
    async (req, res) => {

        try {

            const {
                user_id
            } =
                req.body;


            if (!user_id) {

                return res.status(400).json({
                    error:
                        "Missing user_id."
                });

            }


            const actor =
                req.adminProfile;


            if (
                actor.role !==
                "owner" &&
                actor.role !==
                "administrator"
            ) {

                return res.status(403).json({
                    error:
                        "Administrator access required."
                });

            }


            const {
                data: target
            } =
                await supabase
                    .from("profiles")
                    .select(
                        "id, role"
                    )
                    .eq(
                        "id",
                        user_id
                    )
                    .maybeSingle();


            if (!target) {

                return res.status(404).json({
                    error:
                        "User not found."
                });

            }


            if (
                target.role ===
                "owner"
            ) {

                return res.status(403).json({
                    error:
                        "Owner cannot be modified."
                });

            }


            const {
                data,
                error
            } =
                await supabase
                    .from("profiles")
                    .update({
                        role:
                            "administrator"
                    })
                    .eq(
                        "id",
                        user_id
                    )
                    .select(`
                        id,
                        username,
                        display_name,
                        avatar,
                        role
                    `)
                    .single();


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.json({

                success: true,

                user:
                    data

            });

        }

        catch (error) {

            console.error(
                "ADD ADMIN ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not add administrator."
            });

        }

    }
);


// ==================================================
// GET BANS
// ==================================================

app.get(
    "/api/admin/bans",
    requireLogin,
    requireAdminStaff,
    async (req, res) => {

        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("bans")
                    .select("*")
                    .order(
                        "created_at",
                        {
                            ascending:
                                false
                        }
                    );


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.json({
                bans:
                    data || []
            });

        }

        catch (error) {

            console.error(
                "LOAD BANS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not load bans."
            });

        }

    }
);


// ==================================================
// CREATE BAN
// ==================================================

app.post(
    "/api/admin/bans",
    requireLogin,
    requireAdminStaff,
    async (req, res) => {

        try {

            const {
                email,
                reason
            } =
                req.body;


            const cleanEmail =
                String(
                    email || ""
                )
                .trim()
                .toLowerCase();


            const cleanReason =
                String(
                    reason || ""
                )
                .trim();


            if (!cleanEmail) {

                return res.status(400).json({
                    error:
                        "Email is required."
                });

            }


            const {
                data: target,
                error: targetError
            } =
                await supabase
                    .from("profiles")
                    .select(
                        "id, username, role"
                    )
                    .eq(
                        "email",
                        cleanEmail
                    )
                    .maybeSingle();


            // Email may not exist in profiles.
            // We still allow the ban record to be created.

            if (
                target &&
                target.role ===
                "owner"
            ) {

                return res.status(403).json({
                    error:
                        "The owner cannot be banned."
                });

            }


            const {
                data,
                error
            } =
                await supabase
                    .from("bans")
                    .insert({

                        user_id:
                            target?.id ||
                            null,

                        email:
                            cleanEmail,

                        reason:
                            cleanReason ||
                            "No reason provided.",

                        active:
                            true

                    })
                    .select()
                    .single();


            if (error) {

                console.error(
                    "BAN INSERT ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.status(201).json({

                success: true,

                ban:
                    data

            });

        }

        catch (error) {

            console.error(
                "BAN ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not ban user."
            });

        }

    }
);


// ==================================================
// UNBAN
// ==================================================

app.post(
    "/api/admin/bans/:id/unban",
    requireLogin,
    requireAdminStaff,
    async (req, res) => {

        try {

            const id =
                req.params.id;


            const {
                data,
                error
            } =
                await supabase
                    .from("bans")
                    .update({
                        active:
                            false
                    })
                    .eq(
                        "id",
                        id
                    )
                    .select()
                    .single();


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.json({

                success: true,

                ban:
                    data

            });

        }

        catch (error) {

            console.error(
                "UNBAN ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not unban user."
            });

        }

    }
);


// ==================================================
// GET KICKS
// ==================================================

app.get(
    "/api/admin/kicks",
    requireLogin,
    requireAdminStaff,
    async (req, res) => {

        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("kicks")
                    .select("*")
                    .order(
                        "created_at",
                        {
                            ascending:
                                false
                        }
                    )
                    .limit(200);


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.json({
                kicks:
                    data || []
            });

        }

        catch (error) {

            console.error(
                "KICKS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not load kicks."
            });

        }

    }
);


// ==================================================
// KICK USER
// ==================================================

app.post(
    "/api/admin/kicks",
    requireLogin,
    requireAdminStaff,
    async (req, res) => {

        try {

            const {
                user_id,
                reason
            } =
                req.body;


            if (!user_id) {

                return res.status(400).json({
                    error:
                        "Missing user_id."
                });

            }


            const actor =
                req.adminProfile;


            // ------------------------------------------
            // Find target
            // ------------------------------------------

            const {
                data: target,
                error: targetError
            } =
                await supabase
                    .from("profiles")
                    .select(`
                        id,
                        username,
                        display_name,
                        role
                    `)
                    .eq(
                        "id",
                        user_id
                    )
                    .maybeSingle();


            if (
                targetError ||
                !target
            ) {

                return res.status(404).json({
                    error:
                        "User not found."
                });

            }


            // ------------------------------------------
            // Owner protection
            // ------------------------------------------

            if (
                target.role ===
                "owner"
            ) {

                return res.status(403).json({
                    error:
                        "The owner cannot be kicked."
                });

            }


            const actorPower =
                ADMIN_ROLE_POWER[
                    actor.role
                ] || 0;


            const targetPower =
                ADMIN_ROLE_POWER[
                    target.role
                ] || 0;


            // Cannot kick equal/higher staff.

            if (
                targetPower >=
                actorPower
            ) {

                return res.status(403).json({
                    error:
                        "You cannot kick a staff member with equal or higher power."
                });

            }


            const cleanReason =
                String(
                    reason || ""
                ).trim();


            // ------------------------------------------
            // Record kick
            // ------------------------------------------

            const {
                data: kick,
                error: kickError
            } =
                await supabase
                    .from("kicks")
                    .insert({

                        user_id:
                            target.id,

                        moderator_id:
                            actor.id,

                        reason:
                            cleanReason ||
                            "No reason provided."

                    })
                    .select()
                    .single();


            if (kickError) {

                console.error(
                    "KICK INSERT ERROR:",
                    kickError
                );

                return res.status(500).json({
                    error:
                        kickError.message
                });

            }


            // ------------------------------------------
            // Destroy target session if your session
            // system stores sessions in a way that
            // allows it.
            //
            // The database record is the official kick
            // record. The target will be kicked out on
            // their next request if your auth/session
            // system checks kicks.
            // ------------------------------------------

            res.status(201).json({

                success: true,

                message:
                    "User kicked.",

                kick

            });

        }

        catch (error) {

            console.error(
                "KICK ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not kick user."
            });

        }

    }
);


// ==================================================
// STAFF REVOCATIONS
// ==================================================
// You said you DON'T currently have:
//
// public.staff_revocations
//
// Therefore this endpoint intentionally does NOT query
// that table. It returns an empty list instead of
// destroying the entire admin panel with a 500.
//
// Once you create the table, this can be changed.

app.get(
    "/api/admin/revokes",
    requireLogin,
    requireAdminStaff,
    async (req, res) => {

        try {

            res.json({
                revokes: []
            });

        }

        catch (error) {

            console.error(
                "REVOKES ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not load revocations."
            });

        }

    }
);


// ==================================================
// REVOKE STAFF
// ==================================================
// This removes staff powers by setting:
//
// profiles.role = "peasant"
//
// It does NOT require staff_revocations to exist.

app.post(
    "/api/admin/revoke",
    requireLogin,
    requireAdminStaff,
    async (req, res) => {

        try {

            const {
                user_id,
                reason
            } =
                req.body;


            if (!user_id) {

                return res.status(400).json({
                    error:
                        "Missing user_id."
                });

            }


            const actor =
                req.adminProfile;


            const {
                data: target,
                error: targetError
            } =
                await supabase
                    .from("profiles")
                    .select(`
                        id,
                        username,
                        display_name,
                        role
                    `)
                    .eq(
                        "id",
                        user_id
                    )
                    .maybeSingle();


            if (
                targetError ||
                !target
            ) {

                return res.status(404).json({
                    error:
                        "User not found."
                });

            }


            if (
                target.role ===
                "owner"
            ) {

                return res.status(403).json({
                    error:
                        "The owner cannot be revoked."
                });

            }


            const actorPower =
                ADMIN_ROLE_POWER[
                    actor.role
                ] || 0;


            const targetPower =
                ADMIN_ROLE_POWER[
                    target.role
                ] || 0;


            if (
                targetPower >=
                actorPower
            ) {

                return res.status(403).json({
                    error:
                        "You cannot revoke someone with equal or higher power."
                });

            }


            const previousRole =
                target.role;


            const {
                data: updated,
                error: updateError
            } =
                await supabase
                    .from("profiles")
                    .update({
                        role:
                            "peasant"
                    })
                    .eq(
                        "id",
                        user_id
                    )
                    .select(`
                        id,
                        username,
                        display_name,
                        role
                    `)
                    .single();


            if (updateError) {

                return res.status(500).json({
                    error:
                        updateError.message
                });

            }


            console.log(
                `STAFF REVOKED: ${target.username} (${previousRole})`
            );


            res.json({

                success: true,

                previous_role:
                    previousRole,

                user:
                    updated,

                reason:
                    String(
                        reason || ""
                    ).trim()

            });

        }

        catch (error) {

            console.error(
                "REVOKE ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not revoke staff."
            });

        }

    }
);
// ==================================================
// START
// ==================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🧌 ShrekBook running on port ${PORT}`
        );

    }
);

