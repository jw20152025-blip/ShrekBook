
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

// ==================================================
// STAFF ROLE SYSTEM
// ==================================================

const STAFF_ROLES = [
    "owner",
    "administrator",
    "senior_moderator",
    "moderator"
];

async function getUserRole(userId) {

    if (!userId) {
        return "peasant";
    }

    const {
        data,
        error
    } = await supabase
        .from("admins")
        .select("user_id, role")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        console.error(
            "GET USER ROLE ERROR:",
            error
        );

        throw error;
    }

    if (!data) {
        return "peasant";
    }

    return data.role || "administrator";
}

// ==================================================
// ADMIN / BAN HELPERS
// ==================================================

async function isAdmin(userId) {

    if (!userId) {
        return false;
    }

    const {
        data,
        error
    } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        console.error(
            "ADMIN CHECK ERROR:",
            error
        );

        return false;
    }

    return !!data;
}

async function getActiveBanByUserId(userId) {

    if (!userId) {
        return null;
    }

    const {
        data,
        error
    } = await supabase
        .from("bans")
        .select(`
            id,
            user_id,
            email,
            reason,
            banned_at,
            banned_by,
            active
        `)
        .eq("user_id", userId)
        .eq("active", true)
        .order("banned_at", {
            ascending: false
        })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error(
            "BAN USER CHECK ERROR:",
            error
        );

        return null;
    }

    return data;
}

async function getActiveBanByEmail(email) {

    const normalized =
        normalizeEmail(email);

    if (!normalized) {
        return null;
    }

    const {
        data,
        error
    } = await supabase
        .from("bans")
        .select(`
            id,
            user_id,
            email,
            reason,
            banned_at,
            banned_by,
            active
        `)
        .eq("email", normalized)
        .eq("active", true)
        .order("banned_at", {
            ascending: false
        })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error(
            "BAN EMAIL CHECK ERROR:",
            error
        );

        return null;
    }

    return data;
}

async function getActiveBan(userId, email) {

    const userBan =
        await getActiveBanByUserId(userId);

    if (userBan) {
        return userBan;
    }

    return await getActiveBanByEmail(email);
}

// ==================================================
// KICK HELPERS
// ==================================================

async function getActiveKickByUserId(userId) {

    if (!userId) {
        return null;
    }

    const {
        data,
        error
    } = await supabase
        .from("kicks")
        .select(`
            id,
            user_id,
            reason,
            kicked_at,
            kicked_by,
            active
        `)
        .eq("user_id", userId)
        .eq("active", true)
        .order("kicked_at", {
            ascending: false
        })
        .limit(1)
        .maybeSingle();

    if (error) {

        // If the table does not exist yet,
        // do not destroy the entire website.
        if (
            error.code === "42P01" ||
            error.message?.toLowerCase().includes(
                "relation"
            )
        ) {
            return null;
        }

        console.error(
            "KICK CHECK ERROR:",
            error
        );

        return null;
    }

    return data;
}

// ==================================================
// STAFF REVOCATION HELPERS
// ==================================================

async function getActiveRevocationByUserId(userId) {

    if (!userId) {
        return null;
    }

    const {
        data,
        error
    } = await supabase
        .from("staff_revocations")
        .select(`
            id,
            user_id,
            reason,
            revoked_at,
            revoked_by,
            active
        `)
        .eq("user_id", userId)
        .eq("active", true)
        .order("revoked_at", {
            ascending: false
        })
        .limit(1)
        .maybeSingle();

    if (error) {

        if (
            error.code === "42P01" ||
            error.message?.toLowerCase().includes(
                "relation"
            )
        ) {
            return null;
        }

        console.error(
            "REVOCATION CHECK ERROR:",
            error
        );

        return null;
    }

    return data;
}

// ==================================================
// REQUIRE STAFF
// ==================================================

async function requireStaff(
    req,
    res,
    next
) {

    try {

        if (!req.session.user) {
            return res.status(401).json({
                error:
                    "You must be logged in."
            });
        }

        const role =
            await getUserRole(
                req.session.user.id
            );

        if (
            !STAFF_ROLES.includes(role)
        ) {
            return res.status(403).json({
                error:
                    "Staff access required."
            });
        }

        req.staffRole = role;

        next();

    } catch (error) {

        console.error(
            "REQUIRE STAFF ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Could not verify staff permissions."
        });
    }
}

// ==================================================
// REQUIRE ADMIN
// ==================================================

async function requireAdmin(
    req,
    res,
    next
) {

    try {

        if (!req.session.user) {
            return res.status(401).json({
                error:
                    "You must be logged in."
            });
        }

        const userId =
            req.session.user.id;

        // OWNER ALWAYS HAS STAFF ACCESS
        if (
            process.env.OWNER_ID &&
            userId === process.env.OWNER_ID
        ) {
            req.staffRole = "owner";
            return next();
        }

        const role =
            await getUserRole(
                userId
            );

        if (
            !STAFF_ROLES.includes(role)
        ) {
            return res.status(403).json({
                error:
                    "Staff access required."
            });
        }

        req.staffRole = role;

        next();

    } catch (error) {

        console.error(
            "REQUIRE ADMIN ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Could not verify staff permissions."
        });
    }
}

// ==================================================
// REQUIRE OWNER
// ==================================================

async function requireOwner(
    req,
    res,
    next
) {

    try {

        if (!req.session.user) {
            return res.status(401).json({
                error:
                    "You must be logged in."
            });
        }

        const userId =
            req.session.user.id;

        if (
            process.env.OWNER_ID &&
            userId === process.env.OWNER_ID
        ) {
            req.staffRole = "owner";
            return next();
        }

        const role =
            await getUserRole(
                userId
            );

        if (
            role !== "owner"
        ) {
            return res.status(403).json({
                error:
                    "Owner access required."
            });
        }

        req.staffRole = role;

        next();

    } catch (error) {

        console.error(
            "REQUIRE OWNER ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Could not verify owner permissions."
        });
    }
}

// ==================================================
// GLOBAL BAN CHECK
// ==================================================

app.use(
    "/api",
    async (req, res, next) => {

        const publicRoutes = [
            "/login",
            "/signup",
            "/health",
            "/test"
        ];

        if (
            publicRoutes.includes(
                req.path
            )
        ) {
            return next();
        }

        if (!req.session.user) {
            return next();
        }

        try {

            const ban =
                await getActiveBan(
                    req.session.user.id,
                    req.session.user.email
                );

            if (ban) {

                req.session.destroy(() => {});

                return res.status(403).json({
                    error:
                        "Your account has been banned.",
                    reason:
                        ban.reason ||
                        "No reason provided."
                });
            }

            next();

        } catch (error) {

            console.error(
                "GLOBAL BAN CHECK ERROR:",
                error
            );

            next();
        }
    }
);

// ==================================================
// REACTION COUNTS
// ==================================================

async function getReactionCounts(userId) {

    const counts = {
        gyatt: 0,
        cat: 0,
        ogred: 0
    };

    const {
        data: reactions,
        error
    } = await supabase
        .from("reactions")
        .select("type")
        .eq(
            "to_user_id",
            userId
        );

    if (error) {
        throw error;
    }

    for (
        const reaction of
        reactions || []
    ) {

        if (
            reaction.type ===
            "gyatt"
        ) {
            counts.gyatt++;
        }

        if (
            reaction.type ===
            "cat"
        ) {
            counts.cat++;
        }

        if (
            reaction.type ===
            "ogred"
        ) {
            counts.ogred++;
        }
    }

    return counts;
}

// ==================================================
// TEST
// ==================================================

app.get(
    "/api/test",
    (req, res) => {

        res.json({
            success: true,
            message:
                "ShrekBook server is alive 🧌"
        });

    }
);

app.get(
    "/api/health",
    (req, res) => {

        res.json({
            ok: true,
            loggedIn:
                !!req.session.user
        });

    }
);

// ==================================================
// SIGNUP
// ==================================================

app.post(
    "/api/signup",
    async (req, res) => {

        try {

            const username =
                String(
                    req.body.username ||
                    ""
                ).trim();

            const display_name =
                String(
                    req.body.display_name ||
                    username
                ).trim();

            const email =
                normalizeEmail(
                    req.body.email
                );

            const password =
                String(
                    req.body.password ||
                    ""
                );

            if (
                !username ||
                !email ||
                !password
            ) {
                return res.status(400).json({
                    error:
                        "Username, email, and password are required."
                });
            }

            const emailBan =
                await getActiveBanByEmail(
                    email
                );

            if (emailBan) {
                return res.status(403).json({
                    error:
                        "This email address is banned from ShrekBook."
                });
            }

            const {
                data: existing,
                error: usernameError
            } = await supabase
                .from("profiles")
                .select("id")
                .eq(
                    "username",
                    username
                )
                .maybeSingle();

            if (usernameError) {
                return res.status(500).json({
                    error:
                        usernameError.message
                });
            }

            if (existing) {
                return res.status(400).json({
                    error:
                        "That username is already taken."
                });
            }

            const {
                data: authData,
                error: authError
            } =
                await supabase.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true
                });

            if (authError) {
                return res.status(400).json({
                    error:
                        authError.message
                });
            }

            const userId =
                authData.user.id;

            const {
                data: profile,
                error: profileError
            } = await supabase
                .from("profiles")
                .insert({
                    id: userId,
                    username,
                    display_name:
                        display_name ||
                        username,
                    avatar: null,
                    bio: "",
                    last_seen:
                        new Date().toISOString()
                })
                .select()
                .single();

            if (profileError) {

                await supabase.auth.admin
                    .deleteUser(
                        userId
                    );

                return res.status(500).json({
                    error:
                        profileError.message
                });
            }

            res.status(201).json({

                success: true,

                user: {
                    ...profile,

                    avatar:
                        getAvatar(
                            profile.avatar
                        )
                }

            });

        } catch (error) {

            console.error(
                "SIGNUP ERROR:",
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
// LOGIN
// ==================================================

app.post(
    "/api/login",
    async (req, res) => {

        try {

            const email =
                normalizeEmail(
                    req.body.email
                );

            const password =
                String(
                    req.body.password ||
                    ""
                );

            if (
                !email ||
                !password
            ) {
                return res.status(400).json({
                    error:
                        "Email and password are required."
                });
            }

            const emailBan =
                await getActiveBanByEmail(
                    email
                );

            if (emailBan) {
                return res.status(403).json({
                    error:
                        "This email address is banned from ShrekBook.",
                    reason:
                        emailBan.reason ||
                        "No reason provided."
                });
            }

            const {
                data: authData,
                error: authError
            } =
                await supabase.auth.signInWithPassword({
                    email,
                    password
                });

            if (authError) {
                return res.status(401).json({
                    error:
                        authError.message
                });
            }

            const authUser =
                authData.user;

            const userBan =
                await getActiveBanByUserId(
                    authUser.id
                );

            if (userBan) {
                return res.status(403).json({
                    error:
                        "Your account has been banned.",
                    reason:
                        userBan.reason ||
                        "No reason provided."
                });
            }

            let {
                data: profile,
                error: profileError
            } =
                await supabase
                    .from("profiles")
                    .select("*")
                    .eq(
                        "id",
                        authUser.id
                    )
                    .maybeSingle();

            if (profileError) {
                return res.status(500).json({
                    error:
                        profileError.message
                });
            }

            if (!profile) {

                let username =
                    (
                        authUser.email ||
                        "user"
                    )
                        .split("@")[0]
                        .toLowerCase()
                        .replace(
                            /[^a-z0-9_]/g,
                            ""
                        )
                        .slice(0, 20);

                if (!username) {
                    username = "user";
                }

                const original =
                    username;

                let number = 1;

                while (true) {

                    const {
                        data: taken
                    } =
                        await supabase
                            .from("profiles")
                            .select("id")
                            .eq(
                                "username",
                                username
                            )
                            .maybeSingle();

                    if (!taken) {
                        break;
                    }

                    username =
                        `${original}${number}`;

                    number++;
                }

                const {
                    data: created,
                    error: createError
                } =
                    await supabase
                        .from("profiles")
                        .insert({
                            id:
                                authUser.id,

                            username,

                            display_name:
                                username,

                            avatar:
                                null,

                            bio:
                                ""
                        })
                        .select()
                        .single();

                if (createError) {
                    return res.status(500).json({
                        error:
                            createError.message
                    });
                }

                profile = created;
            }

            req.session.user = {

                id:
                    profile.id,

                username:
                    profile.username,

                display_name:
                    profile.display_name,

                email:
                    email

            };

            req.session.save(
                error => {

                    if (error) {

                        console.error(
                            "SESSION SAVE ERROR:",
                            error
                        );

                        return res.status(500).json({
                            error:
                                "Could not save login session."
                        });
                    }

                    res.json({

                        success:
                            true,

                        user: {

                            ...profile,

                            avatar:
                                getAvatar(
                                    profile.avatar
                                )

                        }

                    });

                }
            );

        } catch (error) {

            console.error(
                "LOGIN ERROR:",
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
// LOGOUT
// ==================================================

app.post(
    "/api/logout",
    (req, res) => {

        req.session.destroy(
            error => {

                if (error) {
                    return res.status(500).json({
                        error:
                            "Logout failed."
                    });
                }

                res.clearCookie(
                    "connect.sid"
                );

                res.json({
                    success: true
                });
            }
        );
    }
);

// ==================================================
// CURRENT USER
// ==================================================

app.get(
    "/api/me",
    async (req, res) => {

        try {

            if (!req.session.user) {
                return res.json({
                    loggedIn: false
                });
            }

            const {
                data,
                error
            } = await supabase
                .from("profiles")
                .select("*")
                .eq(
                    "id",
                    req.session.user.id
                )
                .single();

            if (error || !data) {
                return res.json({
                    loggedIn: false
                });
            }

            const reactions =
                await getReactionCounts(
                    data.id
                );

            const role =
                await getUserRole(
                    data.id
                );

            res.json({

                loggedIn: true,

                isAdmin:
                    STAFF_ROLES.includes(
                        role
                    ),

                isStaff:
                    STAFF_ROLES.includes(
                        role
                    ),

                role,

                user: {

                    ...data,

                    avatar:
                        getAvatar(
                            data.avatar
                        ),

                    gyatt:
                        reactions.gyatt,

                    cat:
                        reactions.cat,

                    ogred:
                        reactions.ogred

                }

            });

        } catch (error) {

            console.error(
                "ME ERROR:",
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
// ADMIN CHECK
// ==================================================

app.get(
    "/api/admin/check",
    async (req, res) => {

        try {

            if (!req.session.user) {
                return res.status(401).json({
                    isAdmin: false,
                    isStaff: false,
                    error:
                        "Not logged in."
                });
            }

            const role =
                await getUserRole(
                    req.session.user.id
                );

            const staff =
                STAFF_ROLES.includes(
                    role
                );

            return res.json({

                isAdmin:
                    staff,

                isStaff:
                    staff,

                role

            });

        } catch (error) {

            console.error(
                "ADMIN CHECK ERROR:",
                error
            );

            return res.status(500).json({
                isAdmin: false,
                isStaff: false,
                error:
                    "Could not check administrator status."
            });
        }
    }
);

// ==================================================
// ADMIN ME
// ==================================================

app.get(
    "/api/admin/me",
    requireLogin,
    async (req, res) => {

        try {

            const userId =
                req.session.user.id;

            const role =
                await getUserRole(
                    userId
                );

            const isStaff =
                STAFF_ROLES.includes(
                    role
                );

            res.json({

                success: true,

                isAdmin:
                    isStaff,

                isStaff:
                    isStaff,

                userId,

                role

            });

        } catch (error) {

            console.error(
                "STAFF STATUS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not determine staff role."
            });
        }
    }
);

// ==================================================
// USERS
// ==================================================

app.get(
    "/api/users",
    async (req, res) => {

        try {

            const {
                data: users,
                error: usersError
            } = await supabase
                .from("profiles")
                .select(`
                    id,
                    username,
                    display_name,
                    avatar,
                    bio,
                    created_at,
                    last_seen
                `)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );

            if (usersError) {
                return res.status(500).json({
                    error:
                        usersError.message
                });
            }

            const {
                data: reactions,
                error: reactionsError
            } = await supabase
                .from("reactions")
                .select(`
                    to_user_id,
                    type
                `);

            if (reactionsError) {
                return res.status(500).json({
                    error:
                        reactionsError.message
                });
            }

            const reactionCounts = {};

            for (
                const reaction of
                reactions || []
            ) {

                const userId =
                    reaction.to_user_id;

                if (
                    !reactionCounts[userId]
                ) {
                    reactionCounts[userId] = {
                        gyatt: 0,
                        cat: 0,
                        ogred: 0
                    };
                }

                if (
                    reaction.type ===
                    "gyatt"
                ) {
                    reactionCounts[userId].gyatt++;
                }

                if (
                    reaction.type ===
                    "cat"
                ) {
                    reactionCounts[userId].cat++;
                }

                if (
                    reaction.type ===
                    "ogred"
                ) {
                    reactionCounts[userId].ogred++;
                }
            }

            const result =
                (users || []).map(
                    user => {

                        const lastSeen =
                            user.last_seen
                                ? new Date(
                                    user.last_seen
                                ).getTime()
                                : 0;

                        const online =
                            lastSeen > 0 &&
                            Date.now() -
                                lastSeen <
                            60 * 1000;

                        return {

                            ...user,

                            avatar:
                                getAvatar(
                                    user.avatar
                                ),

                            online,

                            gyatt:
                                reactionCounts[
                                    user.id
                                ]?.gyatt ||
                                0,

                            cat:
                                reactionCounts[
                                    user.id
                                ]?.cat ||
                                0,

                            ogred:
                                reactionCounts[
                                    user.id
                                ]?.ogred ||
                                0
                        };
                    }
                );

            res.json(result);

        } catch (error) {

            console.error(
                "USERS ERROR:",
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
// ONE USER
// ==================================================

app.get(
    "/api/users/:id",
    async (req, res) => {

        try {

            const id =
                req.params.id;

            if (!id) {
                return res.status(400).json({
                    error:
                        "No profile ID was provided."
                });
            }

            const {
                data: profile,
                error: profileError
            } = await supabase
                .from("profiles")
                .select(`
                    id,
                    username,
                    display_name,
                    avatar,
                    bio,
                    created_at
                `)
                .eq(
                    "id",
                    id
                )
                .maybeSingle();

            if (profileError) {
                return res.status(500).json({
                    error:
                        profileError.message
                });
            }

            if (!profile) {
                return res.status(404).json({
                    error:
                        "User not found."
                });
            }

            const {
                data: posts,
                error: postsError
            } = await supabase
                .from("posts")
                .select(`
                    id,
                    user_id,
                    content,
                    image_url,
                    created_at
                `)
                .eq(
                    "user_id",
                    id
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );

            if (postsError) {
                return res.status(500).json({
                    error:
                        postsError.message
                });
            }

            const reactions =
                await getReactionCounts(
                    id
                );

            res.json({

                ...profile,

                avatar:
                    getAvatar(
                        profile.avatar
                    ),

                gyatt:
                    reactions.gyatt,

                cat:
                    reactions.cat,

                ogred:
                    reactions.ogred,

                posts:
                    posts || []

            });

        } catch (error) {

            console.error(
                "ONE USER ERROR:",
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
// UPDATE PROFILE
// ==================================================

app.put(
    "/api/profile",
    requireLogin,
    async (req, res) => {

        try {

            const display_name =
                String(
                    req.body.display_name ||
                    ""
                ).trim();

            const bio =
                String(
                    req.body.bio ||
                    ""
                ).trim();

            if (!display_name) {
                return res.status(400).json({
                    error:
                        "Display name cannot be empty."
                });
            }

            if (
                display_name.length >
                50
            ) {
                return res.status(400).json({
                    error:
                        "Display name is too long."
                });
            }

            if (
                bio.length >
                500
            ) {
                return res.status(400).json({
                    error:
                        "Bio is too long."
                });
            }

            const {
                data,
                error
            } = await supabase
                .from("profiles")
                .update({
                    display_name,
                    bio
                })
                .eq(
                    "id",
                    req.session.user.id
                )
                .select(`
                    id,
                    username,
                    display_name,
                    avatar,
                    bio,
                    created_at
                `)
                .single();

            if (error) {
                return res.status(500).json({
                    error:
                        error.message
                });
            }

            req.session.user.display_name =
                data.display_name;

            req.session.save(
                sessionError => {

                    if (sessionError) {
                        return res.status(500).json({
                            error:
                                "Could not save profile session."
                        });
                    }

                    res.json({

                        success: true,

                        user: {

                            ...data,

                            avatar:
                                getAvatar(
                                    data.avatar
                                )

                        }

                    });
                }
            );

        } catch (error) {

            console.error(
                "UPDATE PROFILE ERROR:",
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
// AVATAR UPLOAD
// ==================================================

app.post(
    "/api/profile/avatar",
    requireLogin,
    async (req, res) => {

        try {

            const {
                fileName,
                fileType,
                fileData
            } = req.body;

            if (
                !fileName ||
                !fileType ||
                !fileData
            ) {
                return res.status(400).json({
                    error:
                        "Missing image data."
                });
            }

            if (
                !fileType.startsWith(
                    "image/"
                )
            ) {
                return res.status(400).json({
                    error:
                        "File must be an image."
                });
            }

            const buffer =
                Buffer.from(
                    fileData,
                    "base64"
                );

            if (
                buffer.length >
                5 * 1024 * 1024
            ) {
                return res.status(400).json({
                    error:
                        "Image must be under 5MB."
                });
            }

            const extension =
                fileName
                    .split(".")
                    .pop()
                    .toLowerCase();

            const allowed = [
                "png",
                "jpg",
                "jpeg",
                "webp",
                "gif"
            ];

            if (
                !allowed.includes(
                    extension
                )
            ) {
                return res.status(400).json({
                    error:
                        "Unsupported image type."
                });
            }

            const filePath =
                `${req.session.user.id}/${Date.now()}.${extension}`;

            const {
                error: uploadError
            } =
                await supabase.storage
                    .from("avatars")
                    .upload(
                        filePath,
                        buffer,
                        {
                            contentType:
                                fileType,
                            upsert: true
                        }
                    );

            if (uploadError) {
                return res.status(500).json({
                    error:
                        uploadError.message
                });
            }

            const {
                data: publicData
            } =
                supabase.storage
                    .from("avatars")
                    .getPublicUrl(
                        filePath
                    );

            const avatarUrl =
                publicData.publicUrl;

            const {
                data: profile,
                error: profileError
            } =
                await supabase
                    .from("profiles")
                    .update({
                        avatar:
                            avatarUrl
                    })
                    .eq(
                        "id",
                        req.session.user.id
                    )
                    .select()
                    .single();

            if (profileError) {
                return res.status(500).json({
                    error:
                        profileError.message
                });
            }

            res.json({

                success: true,

                avatar:
                    avatarUrl,

                user: {

                    ...profile,

                    avatar:
                        avatarUrl

                }

            });

        } catch (error) {

            console.error(
                "AVATAR ERROR:",
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
// IMAGE UPLOAD
// ==================================================

async function uploadImage(
    fileData,
    fileType,
    fileName,
    userId
) {

    if (
        !fileData ||
        !fileType ||
        !fileName
    ) {
        throw new Error(
            "Missing image data."
        );
    }

    if (
        !fileType.startsWith(
            "image/"
        )
    ) {
        throw new Error(
            "File must be an image."
        );
    }

    const buffer =
        Buffer.from(
            fileData,
            "base64"
        );

    if (
        buffer.length >
        5 * 1024 * 1024
    ) {
        throw new Error(
            "Image must be under 5MB."
        );
    }

    const extension =
        fileName
            .split(".")
            .pop()
            .toLowerCase();

    const allowed = [
        "png",
        "jpg",
        "jpeg",
        "webp",
        "gif"
    ];

    if (
        !allowed.includes(
            extension
        )
    ) {
        throw new Error(
            "Unsupported image type."
        );
    }

    const filePath =
        `posts/${userId}/${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}.${extension}`;

    const {
        error: uploadError
    } =
        await supabase.storage
            .from("avatars")
            .upload(
                filePath,
                buffer,
                {
                    contentType:
                        fileType,
                    upsert: false
                }
            );

    if (uploadError) {
        throw new Error(
            uploadError.message
        );
    }

    const {
        data: publicData
    } =
        supabase.storage
            .from("avatars")
            .getPublicUrl(
                filePath
            );

    return publicData.publicUrl;
}

// ==================================================
// POSTS
// ==================================================

app.get(
    "/api/posts",
    async (req, res) => {

        try {

            const {
                data: posts,
                error
            } =
                await supabase
                    .from("posts")
                    .select(`
                        id,
                        user_id,
                        content,
                        image_url,
                        created_at
                    `)
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    )
                    .limit(100);

            if (error) {
                return res.status(500).json({
                    error:
                        error.message
                });
            }

            const result = [];

            for (
                const post of
                posts || []
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
                            post.user_id
                        )
                        .maybeSingle();

                result.push({

                    ...post,

                    username:
                        profile?.username ||
                        "User",

                    display_name:
                        profile?.display_name ||
                        profile?.username ||
                        "User",

                    avatar:
                        getAvatar(
                            profile?.avatar
                        )
                });
            }

            res.json(result);

        } catch (error) {

            console.error(
                "GET POSTS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Server error."
            });
        }
    }
);

app.post(
    "/api/posts",
    requireLogin,
    async (req, res) => {

        try {

            const content =
                String(
                    req.body.content ||
                    ""
                ).trim();

            if (
                content.length >
                5000
            ) {
                return res.status(400).json({
                    error:
                        "Post is too long."
                });
            }

            let imageUrl = null;

            if (
                req.body.image &&
                req.body.image.data &&
                req.body.image.type &&
                req.body.image.name
            ) {

                try {

                    imageUrl =
                        await uploadImage(
                            req.body.image.data,
                            req.body.image.type,
                            req.body.image.name,
                            req.session.user.id
                        );

                } catch (error) {

                    return res.status(400).json({
                        error:
                            error.message
                    });
                }
            }

            if (
                !content &&
                !imageUrl
            ) {
                return res.status(400).json({
                    error:
                        "Post cannot be empty."
                });
            }

            const {
                data,
                error
            } =
                await supabase
                    .from("posts")
                    .insert({
                        user_id:
                            req.session.user.id,
                        content,
                        image_url:
                            imageUrl
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
                "CREATE POST ERROR:",
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
// COMMENTS
// ==================================================

app.get(
    "/api/posts/:postId/comments",
    async (req, res) => {

        try {

            const {
                data: comments,
                error
            } =
                await supabase
                    .from("comments")
                    .select(`
                        id,
                        post_id,
                        user_id,
                        content,
                        image_url,
                        created_at
                    `)
                    .eq(
                        "post_id",
                        req.params.postId
                    )
                    .order(
                        "created_at",
                        {
                            ascending: true
                        }
                    );

            if (error) {
                return res.status(500).json({
                    error:
                        error.message
                });
            }

            const result = [];

            for (
                const comment of
                comments || []
            ) {

                const {
                    data: profile
                } =
                    await supabase
                        .from("profiles")
                        .select(
                            "username, display_name, avatar"
                        )
                        .eq(
                            "id",
                            comment.user_id
                        )
                        .maybeSingle();

                result.push({

                    ...comment,

                    username:
                        profile?.username ||
                        "User",

                    display_name:
                        profile?.display_name ||
                        profile?.username ||
                        "User",

                    avatar:
                        getAvatar(
                            profile?.avatar
                        )
                });
            }

            res.json(result);

        } catch (error) {

            console.error(
                "COMMENTS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Server error."
            });
        }
    }
);

app.post(
    "/api/posts/:postId/comments",
    requireLogin,
    async (req, res) => {

        try {

            const content =
                String(
                    req.body.content ||
                    ""
                ).trim();

            if (
                content.length >
                500
            ) {
                return res.status(400).json({
                    error:
                        "Comment is too long."
                });
            }

            let imageUrl = null;

            if (
                req.body.image &&
                req.body.image.data &&
                req.body.image.type &&
                req.body.image.name
            ) {

                try {

                    imageUrl =
                        await uploadImage(
                            req.body.image.data,
                            req.body.image.type,
                            req.body.image.name,
                            req.session.user.id
                        );

                } catch (error) {

                    return res.status(400).json({
                        error:
                            error.message
                    });
                }
            }

            if (
                !content &&
                !imageUrl
            ) {
                return res.status(400).json({
                    error:
                        "Comment cannot be empty."
                });
            }

            const {
                data,
                error
            } =
                await supabase
                    .from("comments")
                    .insert({
                        post_id:
                            req.params.postId,

                        user_id:
                            req.session.user.id,

                        content,

                        image_url:
                            imageUrl
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
                "COMMENT ERROR:",
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
// REACTIONS
// ==================================================

async function addReaction(
    req,
    res,
    type
) {

    try {

        if (!req.session.user) {
            return res.status(401).json({
                error:
                    "You must be logged in."
            });
        }

        const fromUserId =
            req.session.user.id;

        const toUserId =
            req.params.id;

        if (
            fromUserId ===
            toUserId
        ) {
            return res.status(400).json({
                error:
                    "You cannot react to yourself."
            });
        }

        const {
            data: targetUser,
            error: targetError
        } =
            await supabase
                .from("profiles")
                .select("id")
                .eq(
                    "id",
                    toUserId
                )
                .maybeSingle();

        if (targetError) {
            return res.status(500).json({
                error:
                    targetError.message
            });
        }

        if (!targetUser) {
            return res.status(404).json({
                error:
                    "User not found."
            });
        }

        const {
            error: insertError
        } =
            await supabase
                .from("reactions")
                .insert({
                    from_user_id:
                        fromUserId,

                    to_user_id:
                        toUserId,

                    type
                });

        if (insertError) {

            if (
                insertError.code ===
                "23505"
            ) {

                const names = {
                    gyatt: "Gyatt",
                    cat: "Cat",
                    ogred: "Ogred"
                };

                return res.status(400).json({
                    error:
                        `You already gave this person a ${names[type]}.`
                });
            }

            return res.status(500).json({
                error:
                    insertError.message
            });
        }

        const {
            count,
            error: countError
        } =
            await supabase
                .from("reactions")
                .select(
                    "*",
                    {
                        count:
                            "exact",
                        head:
                            true
                    }
                )
                .eq(
                    "to_user_id",
                    toUserId
                )
                .eq(
                    "type",
                    type
                );

        if (countError) {
            return res.status(500).json({
                error:
                    countError.message
            });
        }

        res.json({

            success: true,

            [type]:
                count || 0

        });

    } catch (error) {

        console.error(
            `${type.toUpperCase()} ERROR:`,
            error
        );

        res.status(500).json({
            error:
                "Server error."
        });
    }
}

app.post(
    "/api/users/:id/gyatt",
    (req, res) =>
        addReaction(
            req,
            res,
            "gyatt"
        )
);

app.post(
    "/api/users/:id/cat",
    (req, res) =>
        addReaction(
            req,
            res,
            "cat"
        )
);

app.post(
    "/api/users/:id/ogred",
    (req, res) =>
        addReaction(
            req,
            res,
            "ogred"
        )
);

// ==================================================
// HEARTBEAT
// ==================================================

app.post(
    "/api/heartbeat",
    requireLogin,
    async (req, res) => {

        try {

            const {
                error
            } =
                await supabase
                    .from("profiles")
                    .update({
                        last_seen:
                            new Date()
                                .toISOString()
                    })
                    .eq(
                        "id",
                        req.session.user.id
                    );

            if (error) {
                return res.status(500).json({
                    error:
                        error.message
                });
            }

            res.json({
                success: true
            });

        } catch (error) {

            console.error(
                "HEARTBEAT ERROR:",
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
// ADMIN STAFF LIST
// ==================================================

app.get(
    "/api/admin/staff",
    requireStaff,
    async (req, res) => {

        try {

            const {
                data: staff,
                error
            } =
                await supabase
                    .from("admins")
                    .select(`
                        user_id,
                        role,
                        created_at
                    `)
                    .order(
                        "created_at",
                        {
                            ascending: true
                        }
                    );

            if (error) {
                return res.status(500).json({
                    error:
                        error.message
                });
            }

            const result = [];

            for (
                const member of
                staff || []
            ) {

                const {
                    data: profile
                } =
                    await supabase
                        .from("profiles")
                        .select(`
                            id,
                            username,
                            display_name,
                            avatar
                        `)
                        .eq(
                            "id",
                            member.user_id
                        )
                        .maybeSingle();

                result.push({

                    user_id:
                        member.user_id,

                    role:
                        member.role,

                    created_at:
                        member.created_at,

                    username:
                        profile?.username ||
                        "Unknown",

                    display_name:
                        profile?.display_name ||
                        profile?.username ||
                        "Unknown",

                    avatar:
                        getAvatar(
                            profile?.avatar
                        )
                });
            }

            res.json({

                success: true,

                staff:
                    result

            });

        } catch (error) {

            console.error(
                "GET STAFF ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });
        }
    }
);

// ==================================================
// CHANGE USER ROLE
// ==================================================

app.post(
    "/api/admin/role",
    requireOwner,
    async (req, res) => {

        try {

            const targetUserId =
                String(
                    req.body.user_id ||
                    ""
                ).trim();

            const newRole =
                String(
                    req.body.role ||
                    ""
                ).trim().toLowerCase();

            const allowedRoles = [
                "owner",
                "administrator",
                "senior_moderator",
                "moderator",
                "peasant"
            ];

            if (!targetUserId) {
                return res.status(400).json({
                    error:
                        "User ID is required."
                });
            }

            if (
                !allowedRoles.includes(
                    newRole
                )
            ) {
                return res.status(400).json({
                    error:
                        "Invalid role."
                });
            }

            const currentUserId =
                req.session.user.id;

            if (
                targetUserId ===
                currentUserId
            ) {
                return res.status(403).json({
                    error:
                        "You cannot change your own role."
                });
            }

            if (
                newRole ===
                "owner"
            ) {
                return res.status(403).json({
                    error:
                        "The Owner role cannot be assigned."
                });
            }

            const {
                data: targetProfile,
                error: profileError
            } =
                await supabase
                    .from("profiles")
                    .select(`
                        id,
                        username,
                        display_name,
                        avatar
                    `)
                    .eq(
                        "id",
                        targetUserId
                    )
                    .maybeSingle();

            if (profileError) {
                return res.status(500).json({
                    error:
                        profileError.message
                });
            }

            if (!targetProfile) {
                return res.status(404).json({
                    error:
                        "User not found."
                });
            }

            const {
                data: existingAdmin,
                error: roleError
            } =
                await supabase
                    .from("admins")
                    .select(`
                        user_id,
                        role
                    `)
                    .eq(
                        "user_id",
                        targetUserId
                    )
                    .maybeSingle();

            if (roleError) {
                return res.status(500).json({
                    error:
                        roleError.message
                });
            }

            const oldRole =
                existingAdmin?.role ||
                "peasant";

            if (
                oldRole ===
                "owner"
            ) {
                return res.status(403).json({
                    error:
                        "The Owner cannot be demoted or modified."
                });
            }

            if (
                newRole ===
                "peasant"
            ) {

                const {
                    error: deleteError
                } =
                    await supabase
                        .from("admins")
                        .delete()
                        .eq(
                            "user_id",
                            targetUserId
                        );

                if (deleteError) {
                    return res.status(500).json({
                        error:
                            deleteError.message
                    });
                }

                return res.json({

                    success: true,

                    message:
                        "User is now a Peasant.",

                    user: {

                        id:
                            targetProfile.id,

                        username:
                            targetProfile.username,

                        display_name:
                            targetProfile.display_name,

                        role:
                            "peasant"

                    }

                });
            }

            const {
                data: updatedAdmin,
                error: upsertError
            } =
                await supabase
                    .from("admins")
                    .upsert(
                        {
                            user_id:
                                targetUserId,

                            role:
                                newRole
                        },
                        {
                            onConflict:
                                "user_id"
                        }
                    )
                    .select(`
                        user_id,
                        role,
                        created_at
                    `)
                    .single();

            if (upsertError) {
                return res.status(500).json({
                    error:
                        upsertError.message
                });
            }

            res.json({

                success: true,

                message:
                    `Role changed from ${oldRole} to ${newRole}.`,

                user: {

                    id:
                        targetProfile.id,

                    username:
                        targetProfile.username,

                    display_name:
                        targetProfile.display_name,

                    role:
                        updatedAdmin.role

                }

            });

        } catch (error) {

            console.error(
                "CHANGE ROLE ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message ||
                    "Server error while changing role."
            });
        }
    }
);

// ==================================================
// MODERATION - USERS
// ==================================================

app.get(
    "/api/admin/users",
    requireStaff,
    async (req, res) => {

        try {

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
                        avatar,
                        email,
                        created_at,
                        last_seen
                    `)
                    .order(
                        "created_at",
                        {
                            ascending:
                                false
                        }
                    );

            if (error) {

                // Some profiles tables don't have
                // an email column.
                if (
                    error.message?.includes(
                        "email"
                    )
                ) {

                    const fallback =
                        await supabase
                            .from("profiles")
                            .select(`
                                id,
                                username,
                                display_name,
                                avatar,
                                created_at,
                                last_seen
                            `)
                            .order(
                                "created_at",
                                {
                                    ascending:
                                        false
                                }
                            );

                    if (fallback.error) {
                        return res.status(500).json({
                            error:
                                fallback.error.message
                        });
                    }

                    return res.json(
                        fallback.data || []
                    );
                }

                return res.status(500).json({
                    error:
                        error.message
                });
            }

            const result = [];

            for (
                const user of
                users || []
            ) {

                const role =
                    await getUserRole(
                        user.id
                    );

                const ban =
                    await getActiveBanByUserId(
                        user.id
                    );

                const kick =
                    await getActiveKickByUserId(
                        user.id
                    );

                result.push({

                    ...user,

                    avatar:
                        getAvatar(
                            user.avatar
                        ),

                    role,

                    banned:
                        !!ban,

                    kicked:
                        !!kick

                });
            }

            res.json(result);

        } catch (error) {

            console.error(
                "ADMIN USERS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });
        }
    }
);

// ==================================================
// BANS
// ==================================================

app.get(
    "/api/admin/bans",
    requireStaff,
    async (req, res) => {

        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("bans")
                    .select(`
                        id,
                        user_id,
                        email,
                        reason,
                        banned_at,
                        banned_by,
                        active
                    `)
                    .order(
                        "banned_at",
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
                success: true,
                bans:
                    data || []
            });

        } catch (error) {

            console.error(
                "GET BANS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });
        }
    }
);

// ==================================================
// BAN USER
// ==================================================

app.post(
    "/api/admin/ban",
    requireStaff,
    async (req, res) => {

        try {

            const userId =
                String(
                    req.body.user_id ||
                    ""
                ).trim();

            const reason =
                String(
                    req.body.reason ||
                    ""
                ).trim();

            if (!userId) {
                return res.status(400).json({
                    error:
                        "User ID is required."
                });
            }

            if (
                userId ===
                req.session.user.id
            ) {
                return res.status(403).json({
                    error:
                        "You cannot ban yourself."
                });
            }

            const targetRole =
                await getUserRole(
                    userId
                );

            if (
                targetRole ===
                "owner"
            ) {
                return res.status(403).json({
                    error:
                        "The Owner cannot be banned."
                });
            }

            const {
                data: target,
                error: targetError
            } =
                await supabase
                    .from("profiles")
                    .select(`
                        id,
                        username
                    `)
                    .eq(
                        "id",
                        userId
                    )
                    .maybeSingle();

            if (targetError) {
                return res.status(500).json({
                    error:
                        targetError.message
                });
            }

            if (!target) {
                return res.status(404).json({
                    error:
                        "User not found."
                });
            }

            const {
                data: authUser
            } =
                await supabase.auth.admin.getUserById(
                    userId
                );

            const email =
                normalizeEmail(
                    authUser?.user?.email
                );

            const {
                error
            } =
                await supabase
                    .from("bans")
                    .insert({
                        user_id:
                            userId,

                        email:
                            email || null,

                        reason:
                            reason ||
                            "No reason provided.",

                        banned_at:
                            new Date()
                                .toISOString(),

                        banned_by:
                            req.session.user.id,

                        active:
                            true
                    });

            if (error) {
                return res.status(500).json({
                    error:
                        error.message
                });
            }

            res.json({
                success: true,
                message:
                    "User banned successfully."
            });

        } catch (error) {

            console.error(
                "BAN USER ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });
        }
    }
);

// ==================================================
// UNBAN USER
// ==================================================

app.post(
    "/api/admin/unban",
    requireStaff,
    async (req, res) => {

        try {

            const userId =
                String(
                    req.body.user_id ||
                    ""
                ).trim();

            if (!userId) {
                return res.status(400).json({
                    error:
                        "User ID is required."
                });
            }

            const {
                error
            } =
                await supabase
                    .from("bans")
                    .update({
                        active:
                            false
                    })
                    .eq(
                        "user_id",
                        userId
                    )
                    .eq(
                        "active",
                        true
                    );

            if (error) {
                return res.status(500).json({
                    error:
                        error.message
                });
            }

            res.json({
                success: true,
                message:
                    "User unbanned successfully."
            });

        } catch (error) {

            console.error(
                "UNBAN ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });
        }
    }
);

// ==================================================
// KICKS
// ==================================================

// GET KICKS
app.get(
    "/api/admin/kicks",
    requireStaff,
    async (req, res) => {

        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("kicks")
                    .select(`
                        id,
                        user_id,
                        reason,
                        kicked_at,
                        kicked_by,
                        active
                    `)
                    .order(
                        "kicked_at",
                        {
                            ascending:
                                false
                        }
                    );

            if (error) {

                console.error(
                    "GET KICKS ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });
            }

            res.json({

                success:
                    true,

                kicks:
                    data || []

            });

        } catch (error) {

            console.error(
                "GET KICKS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });
        }
    }
);

// CREATE KICK
app.post(
    "/api/admin/kick",
    requireStaff,
    async (req, res) => {

        try {

            const userId =
                String(
                    req.body.user_id ||
                    ""
                ).trim();

            const reason =
                String(
                    req.body.reason ||
                    ""
                ).trim();

            if (!userId) {
                return res.status(400).json({
                    error:
                        "User ID is required."
                });
            }

            if (
                userId ===
                req.session.user.id
            ) {
                return res.status(403).json({
                    error:
                        "You cannot kick yourself."
                });
            }

            const targetRole =
                await getUserRole(
                    userId
                );

            if (
                targetRole ===
                "owner"
            ) {
                return res.status(403).json({
                    error:
                        "The Owner cannot be kicked."
                });
            }

            const {
                data: target,
                error: targetError
            } =
                await supabase
                    .from("profiles")
                    .select(`
                        id,
                        username
                    `)
                    .eq(
                        "id",
                        userId
                    )
                    .maybeSingle();

            if (targetError) {
                return res.status(500).json({
                    error:
                        targetError.message
                });
            }

            if (!target) {
                return res.status(404).json({
                    error:
                        "User not found."
                });
            }

            const {
                error
            } =
                await supabase
                    .from("kicks")
                    .insert({

                        user_id:
                            userId,

                        reason:
                            reason ||
                            "No reason provided.",

                        kicked_at:
                            new Date()
                                .toISOString(),

                        kicked_by:
                            req.session.user.id,

                        active:
                            true

                    });

            if (error) {

                console.error(
                    "CREATE KICK ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });
            }

            res.json({

                success:
                    true,

                message:
                    "User kicked successfully."

            });

        } catch (error) {

            console.error(
                "KICK ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });
        }
    }
);

// CLEAR KICK
app.post(
    "/api/admin/kicks/:kickId/clear",
    requireStaff,
    async (req, res) => {

        try {

            const kickId =
                String(
                    req.params.kickId ||
                    ""
                ).trim();

            if (!kickId) {
                return res.status(400).json({
                    error:
                        "Kick ID is required."
                });
            }

            const {
                error
            } =
                await supabase
                    .from("kicks")
                    .update({
                        active:
                            false
                    })
                    .eq(
                        "id",
                        kickId
                    );

            if (error) {
                return res.status(500).json({
                    error:
                        error.message
                });
            }

            res.json({

                success:
                    true,

                message:
                    "Kick cleared."

            });

        } catch (error) {

            console.error(
                "CLEAR KICK ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });
        }
    }
);

// ==================================================
// STAFF REVOCATIONS
// ==================================================

// GET STAFF REVOCATIONS
app.get(
    "/api/admin/revocations",
    requireStaff,
    async (req, res) => {

        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("staff_revocations")
                    .select(`
                        id,
                        user_id,
                        reason,
                        revoked_at,
                        revoked_by,
                        active
                    `)
                    .order(
                        "revoked_at",
                        {
                            ascending:
                                false
                        }
                    );

            if (error) {

                console.error(
                    "GET REVOCATIONS ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });
            }

            res.json({

                success:
                    true,

                revocations:
                    data || []

            });

        } catch (error) {

            console.error(
                "GET REVOCATIONS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });
        }
    }
);

// CREATE STAFF REVOCATION
app.post(
    "/api/admin/revoke-staff",
    requireOwner,
    async (req, res) => {

        try {

            const userId =
                String(
                    req.body.user_id ||
                    ""
                ).trim();

            const reason =
                String(
                    req.body.reason ||
                    ""
                ).trim();

            if (!userId) {
                return res.status(400).json({
                    error:
                        "User ID is required."
                });
            }

            if (
                userId ===
                req.session.user.id
            ) {
                return res.status(403).json({
                    error:
                        "You cannot revoke your own staff powers."
                });
            }

            const targetRole =
                await getUserRole(
                    userId
                );

            if (
                targetRole ===
                "owner"
            ) {
                return res.status(403).json({
                    error:
                        "The Owner's staff powers cannot be revoked."
                });
            }

            if (
                targetRole ===
                "peasant"
            ) {
                return res.status(400).json({
                    error:
                        "This user does not have staff powers."
                });
            }

            const {
                error: revokeError
            } =
                await supabase
                    .from("staff_revocations")
                    .insert({

                        user_id:
                            userId,

                        reason:
                            reason ||
                            "No reason provided.",

                        revoked_at:
                            new Date()
                                .toISOString(),

                        revoked_by:
                            req.session.user.id,

                        active:
                            true

                    });

            if (revokeError) {

                console.error(
                    "REVOCATION INSERT ERROR:",
                    revokeError
                );

                return res.status(500).json({
                    error:
                        revokeError.message
                });
            }

            // Remove staff permissions.
            const {
                error: roleDeleteError
            } =
                await supabase
                    .from("admins")
                    .delete()
                    .eq(
                        "user_id",
                        userId
                    );

            if (roleDeleteError) {

                console.error(
                    "REVOCATION ROLE DELETE ERROR:",
                    roleDeleteError
                );

                return res.status(500).json({
                    error:
                        roleDeleteError.message
                });
            }

            res.json({

                success:
                    true,

                message:
                    "Staff powers revoked. The account remains active."

            });

        } catch (error) {

            console.error(
                "REVOKE STAFF ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });
        }
    }
);

// ==================================================
// CLEAR STAFF REVOCATION
// ==================================================

app.post(
    "/api/admin/revocations/:revocationId/clear",
    requireOwner,
    async (req, res) => {

        try {

            const revocationId =
                String(
                    req.params.revocationId ||
                    ""
                ).trim();

            if (!revocationId) {
                return res.status(400).json({
                    error:
                        "Revocation ID is required."
                });
            }

            const {
                error
            } =
                await supabase
                    .from("staff_revocations")
                    .update({
                        active:
                            false
                    })
                    .eq(
                        "id",
                        revocationId
                    );

            if (error) {
                return res.status(500).json({
                    error:
                        error.message
                });
            }

            res.json({

                success:
                    true,

                message:
                    "Staff revocation cleared."

            });

        } catch (error) {

            console.error(
                "CLEAR REVOCATION ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });
        }
    }
);

// ==================================================
// SHREKCHAT - ROOMS
// ==================================================

app.get(
    "/api/chat/rooms",
    requireLogin,
    async (req, res) => {

        try {

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
                    .select(
                        "room_id"
                    )
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
                    .filter(
                        room => {

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
                        }
                    );

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

// ==================================================
// CREATE ROOM
// ==================================================

app.post(
    "/api/chat/rooms",
    requireLogin,
    async (req, res) => {

        try {

            const name =
                String(
                    req.body.name ||
                    ""
                ).trim();

            const isPrivate =
                req.body.is_private ===
                true;

            if (!name) {
                return res.status(400).json({
                    error:
                        "Room name cannot be empty."
                });
            }

            if (
                name.length >
                50
            ) {
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

// ==================================================
// JOIN ROOM
// ==================================================

app.post(
    "/api/chat/rooms/:roomId/join",
    requireLogin,
    async (req, res) => {

        try {

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

            if (
                room.is_private
            ) {

                const {
                    data: membership
                } =
                    await supabase
                        .from("chat_members")
                        .select(
                            "room_id"
                        )
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
                    room.created_by !==
                    userId
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
                success: true
            });

        } catch (error) {

            console.error(
                "JOIN ERROR:",
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
// LEAVE ROOM
// ==================================================

app.post(
    "/api/chat/rooms/:roomId/leave",
    requireLogin,
    async (req, res) => {

        try {

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
                success: true
            });

        } catch (error) {

            console.error(
                "LEAVE ERROR:",
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
// DELETE ROOM
// ==================================================

app.delete(
    "/api/chat/rooms/:roomId",
    requireLogin,
    async (req, res) => {

        try {

            const {
                data: room
            } =
                await supabase
                    .from("chat_rooms")
                    .select(
                        "created_by"
                    )
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
                success: true
            });

        } catch (error) {

            console.error(
                "DELETE ROOM ERROR:",
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
// INVITABLE USERS
// ==================================================

app.get(
    "/api/chat/rooms/:roomId/invite-users",
    requireLogin,
    async (req, res) => {

        try {

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
                    .select(
                        "user_id"
                    )
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

            const result =
                (users || [])
                    .filter(
                        user =>
                            !memberIds.has(
                                user.id
                            )
                    )
                    .map(
                        user => ({

                            ...user,

                            avatar:
                                getAvatar(
                                    user.avatar
                                )

                        })
                    );

            res.json(result);

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

// ==================================================
// INVITE USER
// ==================================================

app.post(
    "/api/chat/rooms/:roomId/invite",
    requireLogin,
    async (req, res) => {

        try {

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
                success: true
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

// ==================================================
// GET MESSAGES
// ==================================================

app.get(
    "/api/chat/rooms/:roomId/messages",
    requireLogin,
    async (req, res) => {

        try {

            const roomId =
                req.params.roomId;

            const userId =
                req.session.user.id;

            const {
                data: membership
            } =
                await supabase
                    .from("chat_members")
                    .select(
                        "room_id"
                    )
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
                const message of
                messages || []
            ) {

                const {
                    data: profile
                } =
                    await supabase
                        .from("profiles")
                        .select(`
                            id,
                            username,
                            display_name,
                            avatar
                        `)
                        .eq(
                            "id",
                            message.user_id
                        )
                        .maybeSingle();

                let reactions = {
                    gyatt: 0,
                    cat: 0,
                    ogred: 0
                };

                try {

                    reactions =
                        await getReactionCounts(
                            message.user_id
                        );

                } catch (reactionError) {

                    console.error(
                        "MESSAGE REACTION ERROR:",
                        reactionError
                    );
                }

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
                        getAvatar(
                            profile?.avatar
                        ),

                    cat:
                        reactions.cat,

                    gyatt:
                        reactions.gyatt,

                    ogred:
                        reactions.ogred
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

// ==================================================
// SEND MESSAGE
// ==================================================

app.post(
    "/api/chat/rooms/:roomId/messages",
    requireLogin,
    async (req, res) => {

        try {

            const roomId =
                req.params.roomId;

            const userId =
                req.session.user.id;

            const {
                data: membership
            } =
                await supabase
                    .from("chat_members")
                    .select(
                        "room_id"
                    )
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
                    req.body.content ||
                    ""
                ).trim();

            if (!content) {
                return res.status(400).json({
                    error:
                        "Message cannot be empty."
                });
            }

            if (
                content.length >
                1000
            ) {
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




// ==================================================
// STAFF CHECK
// GET /api/admin/me
// ==================================================

app.get("/api/admin/me", requireLogin, async (req, res) => {

    try {

        const userId = req.session.user.id;

        const { data: user, error } =
            await supabase
                .from("profiles")
                .select(`
                    id,
                    username,
                    display_name,
                    avatar,
                    role
                `)
                .eq("id", userId)
                .maybeSingle();

        if (error)
            return res.status(500).json({
                error: error.message
            });

        if (!user)
            return res.status(404).json({
                error: "User not found."
            });

        const role = user.role || "peasant";

        const isStaff =
            ["moderator", "senior_moderator", "administrator", "owner"]
                .includes(role);

        if (!isStaff) {
            return res.status(403).json({
                isStaff: false,
                role,
                user
            });
        }

        res.json({
            isStaff: true,
            role,
            user
        });

    } catch (error) {

        console.error("ADMIN ME ERROR:", error);

        res.status(500).json({
            error: "Server error."
        });

    }

});


// ==================================================
// GET USERS
// GET /api/admin/users
// ==================================================

app.get(
    "/api/admin/users",
    requireLogin,
    async (req, res) => {

        try {

            const search =
                String(
                    req.query.search || ""
                ).trim();


            let query =
                supabase
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
                            ascending: true
                        }
                    )
                    .limit(200);


            // ==========================================
            // SEARCH
            // ==========================================

            if (search) {

                query =
                    query.or(
                        `username.ilike.%${search}%,display_name.ilike.%${search}%`
                    );

            }


            const {
                data,
                error
            } = await query;


            if (error) {

                console.error(
                    "USER SEARCH ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            // ==========================================
            // GET ROLES FROM PROFILES
            // ==========================================

            const users =
                data || [];


            res.json(
                users
            );

        } catch (error) {

            console.error(
                "ADMIN USERS ERROR:",
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
// GET BANS
// GET /api/admin/bans
// ==================================================

app.get("/api/admin/bans", requireLogin, async (req, res) => {

    try {

        const { data, error } =
            await supabase
                .from("bans")
                .select("*")
                .order("created_at", {
                    ascending: false
                });

        if (error)
            return res.status(500).json({
                error: error.message
            });

        res.json(data || []);

    } catch (error) {

        console.error("GET BANS ERROR:", error);

        res.status(500).json({
            error: "Server error."
        });

    }

});


// ==================================================
// CREATE BAN
// POST /api/admin/bans
// ==================================================

app.post("/api/admin/bans", requireLogin, async (req, res) => {

    try {

        const email =
            String(req.body.email || "")
                .trim()
                .toLowerCase();

        const reason =
            String(req.body.reason || "")
                .trim();

        if (!email)
            return res.status(400).json({
                error: "Email is required."
            });


        const { data: user, error: userError } =
            await supabase
                .from("profiles")
                .select("id, username, email, role")
                .eq("email", email)
                .maybeSingle();

        if (userError)
            return res.status(500).json({
                error: userError.message
            });

        if (!user)
            return res.status(404).json({
                error: "User not found."
            });


        if (user.role === "owner")
            return res.status(403).json({
                error: "The owner cannot be banned."
            });


        const { data, error } =
            await supabase
                .from("bans")
                .insert({
                    user_id: user.id,
                    email,
                    reason,
                    active: true
                })
                .select()
                .single();

        if (error)
            return res.status(500).json({
                error: error.message
            });

        res.status(201).json(data);

    } catch (error) {

        console.error("BAN ERROR:", error);

        res.status(500).json({
            error: "Server error."
        });

    }

});


// ==================================================
// UNBAN
// POST /api/admin/bans/:id/unban
// ==================================================

app.post(
    "/api/admin/bans/:id/unban",
    requireLogin,
    async (req, res) => {

        try {

            const id = req.params.id;

            const { data, error } =
                await supabase
                    .from("bans")
                    .update({
                        active: false
                    })
                    .eq("id", id)
                    .select()
                    .single();

            if (error)
                return res.status(500).json({
                    error: error.message
                });

            if (!data)
                return res.status(404).json({
                    error: "Ban not found."
                });

            res.json(data);

        } catch (error) {

            console.error("UNBAN ERROR:", error);

            res.status(500).json({
                error: "Server error."
            });

        }

    }
);


// ==================================================
// GET ADMINS
// GET /api/admin/admins
// ==================================================

app.get("/api/admin/admins", requireLogin, async (req, res) => {

    try {

        const { data, error } =
            await supabase
                .from("profiles")
                .select(`
                    id,
                    username,
                    display_name,
                    avatar,
                    role
                `)
                .in("role", [
                    "administrator",
                    "owner"
                ])
                .order("username", {
                    ascending: true
                });

        if (error)
            return res.status(500).json({
                error: error.message
            });

        res.json({
            admins: data || []
        });

    } catch (error) {

        console.error("GET ADMINS ERROR:", error);

        res.status(500).json({
            error: "Server error."
        });

    }

});


// ==================================================
// ADD ADMIN
// POST /api/admin/admins
// ==================================================

app.post("/api/admin/admins", requireLogin, async (req, res) => {

    try {

        const userId =
            String(req.body.user_id || "")
                .trim();

        if (!userId)
            return res.status(400).json({
                error: "User ID is required."
            });


        const { data: target, error: findError } =
            await supabase
                .from("profiles")
                .select("id, username, display_name, role")
                .eq("id", userId)
                .maybeSingle();

        if (findError)
            return res.status(500).json({
                error: findError.message
            });

        if (!target)
            return res.status(404).json({
                error: "User not found."
            });


        if (target.role === "owner")
            return res.status(400).json({
                error: "User is already the owner."
            });


        const { data, error } =
            await supabase
                .from("profiles")
                .update({
                    role: "administrator"
                })
                .eq("id", userId)
                .select()
                .single();

        if (error)
            return res.status(500).json({
                error: error.message
            });

        res.json(data);

    } catch (error) {

        console.error("ADD ADMIN ERROR:", error);

        res.status(500).json({
            error: "Server error."
        });

    }

});


// ==================================================
// GET KICKS
// GET /api/admin/kicks
// ==================================================

app.get("/api/admin/kicks", requireLogin, async (req, res) => {

    try {

        const { data, error } =
            await supabase
                .from("kicks")
                .select("*")
                .order("created_at", {
                    ascending: false
                });

        if (error)
            return res.status(500).json({
                error: error.message
            });

        res.json(data || []);

    } catch (error) {

        console.error("GET KICKS ERROR:", error);

        res.status(500).json({
            error: "Server error."
        });

    }

});


// ==================================================
// GET STAFF REVOKES
// GET /api/admin/revokes
// ==================================================

app.get("/api/admin/revokes", requireLogin, async (req, res) => {

    try {

        const { data, error } =
            await supabase
                .from("staff_revocations")
                .select("*")
                .order("created_at", {
                    ascending: false
                });

        if (error)
            return res.status(500).json({
                error: error.message
            });

        res.json(data || []);

    } catch (error) {

        console.error("GET REVOKES ERROR:", error);

        res.status(500).json({
            error: "Server error."
        });

    }

});


// ==================================================
// CHANGE ROLE
// POST /api/admin/role
// ==================================================

app.post("/api/admin/role", requireLogin, async (req, res) => {

    try {

        const userId =
            String(req.body.user_id || "")
                .trim();

        const role =
            String(req.body.role || "")
                .trim()
                .toLowerCase();


        if (!userId || !role)
            return res.status(400).json({
                error: "User ID and role are required."
            });


        if (
            !Object.prototype.hasOwnProperty.call(
                STAFF_ROLES,
                role
            )
        ) {

            return res.status(400).json({
                error: "Invalid role."
            });

        }


        if (role === "owner") {

            return res.status(403).json({
                error:
                    "Owner cannot be assigned through this panel."
            });

        }


        const { data: target, error: findError } =
            await supabase
                .from("profiles")
                .select(`
                    id,
                    username,
                    display_name,
                    role
                `)
                .eq("id", userId)
                .maybeSingle();


        if (findError)
            return res.status(500).json({
                error: findError.message
            });


        if (!target)
            return res.status(404).json({
                error: "User not found."
            });


        if (target.role === "owner") {

            return res.status(403).json({
                error:
                    "The owner is protected."
            });

        }


        const { data, error } =
            await supabase
                .from("profiles")
                .update({
                    role
                })
                .eq("id", userId)
                .select()
                .single();


        if (error)
            return res.status(500).json({
                error: error.message
            });


        // If staff was removed, record revocation.

        if (
            target.role !== "peasant" &&
            role === "peasant"
        ) {

            await supabase
                .from("staff_revocations")
                .insert({
                    user_id: userId,
                    previous_role: target.role,
                    reason: "Staff role revoked."
                });

        }


        res.json({
            success: true,
            user: data
        });

    } catch (error) {

        console.error("ROLE ERROR:", error);

        res.status(500).json({
            error: "Server error."
        });

    }

});

// ==================================================
// 404 API HANDLER
// ==================================================
//
// This is useful because your frontend expects JSON.
// Instead of Express returning an HTML 404 page,
// API requests now receive JSON.
//
// ==================================================

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({

            error:
                "API endpoint not found.",

            path:
                req.originalUrl

        });

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

