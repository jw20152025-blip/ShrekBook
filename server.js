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

async function requireAdmin(req, res, next) {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                error: "You must be logged in."
            });
        }

        const userId = req.session.user.id;

        // 👑 OWNER ALWAYS HAS STAFF ACCESS
        if (
            process.env.OWNER_ID &&
            userId === process.env.OWNER_ID
        ) {
            return next();
        }

        // Check administrator table
        const { data: admin, error: adminError } = await supabase
            .from("admins")
            .select("user_id")
            .eq("user_id", userId)
            .maybeSingle();

        if (adminError) {
            console.error("STAFF ADMIN CHECK ERROR:", adminError);
        }

        if (admin) {
            return next();
        }

        // Check staff/moderator table
        const { data: staff, error: staffError } = await supabase
            .from("staff")
            .select("user_id, role")
            .eq("user_id", userId)
            .maybeSingle();

        if (staffError) {
            console.error("STAFF CHECK ERROR:", staffError);
        }

        if (staff) {
            return next();
        }

        return res.status(403).json({
            error: "Staff access required."
        });

    } catch (error) {
        console.error("REQUIRE STAFF ERROR:", error);

        return res.status(500).json({
            error: "Server error."
        });
    }
}

// ==================================================
// BAN CHECK FOR API REQUESTS
// ==================================================
//
// This makes sure a banned user cannot simply remain
// logged in and continue using the API.
//
// Login/signup/me/health are handled separately.

app.use("/api", async (req, res, next) => {

    const publicRoutes = [
        "/login",
        "/signup",
        "/health",
        "/test"
    ];

    if (publicRoutes.includes(req.path)) {
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
                error: "Your account has been banned.",
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
});

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
        .eq("to_user_id", userId);

    if (error) {
        throw error;
    }

    for (const reaction of reactions || []) {

        if (reaction.type === "gyatt") {
            counts.gyatt++;
        }

        if (reaction.type === "cat") {
            counts.cat++;
        }

        if (reaction.type === "ogred") {
            counts.ogred++;
        }
    }

    return counts;
}
// ==================================================
// CHANGE USER ROLE
// ==================================================

app.post(
    "/api/admin/users/:userId/role",
    requireAdmin,
    async (req, res) => {

        try {

            const targetUserId =
                String(
                    req.params.userId || ""
                ).trim();

            const newRole =
                String(
                    req.body.role || ""
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
                    error: "User ID is required."
                });

            }


            if (!allowedRoles.includes(newRole)) {

                return res.status(400).json({
                    error: "Invalid role."
                });

            }


            const currentUserId =
                req.session.user.id;


            // ==========================================
            // OWNER PROTECTION
            // ==========================================

            if (
                targetUserId === currentUserId
            ) {

                return res.status(403).json({
                    error:
                        "You cannot change your own role."
                });

            }


            // ==========================================
            // GET TARGET PROFILE
            // ==========================================

            const {
                data: target,
                error: targetError
            } = await supabase
                .from("profiles")
                .select(
                    "id, username, display_name, role"
                )
                .eq(
                    "id",
                    targetUserId
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


            // ==========================================
            // OWNER CANNOT BE TOUCHED
            // ==========================================

            if (
                target.role === "owner"
            ) {

                return res.status(403).json({
                    error:
                        "The Owner cannot be demoted or modified."
                });

            }


            // ==========================================
            // ONLY OWNER CAN CREATE/REMOVE ADMINS
            // ==========================================

            const currentProfile =
                await supabase
                    .from("profiles")
                    .select("role")
                    .eq(
                        "id",
                        currentUserId
                    )
                    .maybeSingle();


            const currentRole =
                currentProfile.data?.role;


            if (
                newRole === "owner"
            ) {

                return res.status(403).json({
                    error:
                        "The Owner role cannot be assigned."
                });

            }


            if (
                newRole === "administrator" &&
                currentRole !== "owner"
            ) {

                return res.status(403).json({
                    error:
                        "Only the Owner can promote users to Administrator."
                });

            }


            // ==========================================
            // UPDATE ROLE
            // ==========================================

            const {
                data: updated,
                error: updateError
            } = await supabase
                .from("profiles")
                .update({
                    role: newRole
                })
                .eq(
                    "id",
                    targetUserId
                )
                .select(
                    "id, username, display_name, role"
                )
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


            // ==========================================
            // KEEP ADMINS TABLE IN SYNC
            // ==========================================

            if (
                newRole === "administrator"
            ) {

                await supabase
                    .from("admins")
                    .upsert(
                        {
                            user_id:
                                targetUserId
                        },
                        {
                            onConflict:
                                "user_id"
                        }
                    );

            } else {

                await supabase
                    .from("admins")
                    .delete()
                    .eq(
                        "user_id",
                        targetUserId
                    );

            }


            res.json({

                success: true,

                message:
                    `Role changed to ${newRole}.`,

                user:
                    updated

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
// TEST
// ==================================================

app.get("/api/test", (req, res) => {

    res.json({
        success: true,
        message: "ShrekBook server is alive 🧌"
    });

});

app.get("/api/health", (req, res) => {

    res.json({
        ok: true,
        loggedIn: !!req.session.user
    });

});

// ==================================================
// SIGNUP
// ==================================================

app.post("/api/signup", async (req, res) => {

    try {

        const username =
            String(
                req.body.username || ""
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
                req.body.password || ""
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

        // Check banned email BEFORE creating account
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
            .eq("username", username)
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
        } = await supabase.auth.admin.createUser({
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
                    display_name || username,
                avatar: null,
                bio: "",
                last_seen:
                    new Date().toISOString()
            })
            .select()
            .single();

        if (profileError) {

            await supabase.auth.admin
                .deleteUser(userId);

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
            error: "Server error."
        });

    }

});

// ==================================================
// LOGIN
// ==================================================

app.post("/api/login", async (req, res) => {

    try {

        const email =
            normalizeEmail(
                req.body.email
            );

        const password =
            String(
                req.body.password || ""
            );

        if (!email || !password) {

            return res.status(400).json({
                error:
                    "Email and password are required."
            });

        }


        // ==========================================
        // CHECK EMAIL BAN BEFORE LOGIN
        // ==========================================

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


        // ==========================================
        // SUPABASE AUTH LOGIN
        // ==========================================

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


        // ==========================================
        // CHECK USER ID BAN
        // ==========================================

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


        // ==========================================
        // LOAD PROFILE
        // ==========================================

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


        // ==========================================
        // CREATE MISSING PROFILE
        // ==========================================

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

                username =
                    "user";

            }


            const original =
                username;


            let number =
                1;


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

                        username:
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


            profile =
                created;

        }


        // ==========================================
        // CREATE LOGIN SESSION
        // ==========================================

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


        // ==========================================
        // SAVE SESSION
        // ==========================================

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


                // ==================================
                // LOGIN SUCCESS
                // ==================================

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

});
// ==================================================
// LOGOUT
// ==================================================

app.post("/api/logout", (req, res) => {

    req.session.destroy(error => {

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

    });

});

// ==================================================
// CURRENT USER
// ==================================================

app.get("/api/me", async (req, res) => {

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

        const admin =
            await isAdmin(
                data.id
            );

        res.json({

            loggedIn: true,

            isAdmin: admin,

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

});
app.get("/api/admin/check", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({
                isAdmin: false,
                error: "Not logged in."
            });
        }

        const userId =
            req.session.user.id;

        console.log(
            "ADMIN CHECK USER ID:",
            userId
        );

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
                "ADMIN TABLE ERROR:",
                error
            );

            return res.status(500).json({
                isAdmin: false,
                error: error.message
            });

        }

        if (!data) {

            console.log(
                "NOT AN ADMIN:",
                userId
            );

            return res.json({
                isAdmin: false
            });

        }

        console.log(
            "ADMIN CONFIRMED:",
            userId
        );

        return res.json({
            isAdmin: true
        });

    } catch (error) {

        console.error(
            "ADMIN CHECK ERROR:",
            error
        );

        return res.status(500).json({
            isAdmin: false,
            error: "Could not check administrator status."
        });

    }

});
// ==================================================
// USERS
// ==================================================

app.get("/api/users", async (req, res) => {

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

            if (!reactionCounts[userId]) {

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

});

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
                .eq("id", id)
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
    async (req, res) => {

        try {

            if (!req.session.user) {
                return res.status(401).json({
                    error:
                        "You must be logged in."
                });
            }

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

            if (display_name.length > 50) {
                return res.status(400).json({
                    error:
                        "Display name is too long."
                });
            }

            if (bio.length > 500) {
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
    async (req, res) => {

        try {

            if (!req.session.user) {
                return res.status(401).json({
                    error:
                        "You must be logged in."
                });
            }

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
            } = await supabase.storage
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
            } = supabase.storage
                .from("avatars")
                .getPublicUrl(
                    filePath
                );

            const avatarUrl =
                publicData.publicUrl;

            const {
                data: profile,
                error: profileError
            } = await supabase
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
    } = await supabase.storage
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
    } = supabase.storage
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
            } = await supabase
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
                } = await supabase
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
    async (req, res) => {

        try {

            if (!req.session.user) {
                return res.status(401).json({
                    error:
                        "You must be logged in."
                });
            }

            const content =
                String(
                    req.body.content ||
                    ""
                ).trim();

            if (content.length > 5000) {
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
            } = await supabase
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
            } = await supabase
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
                } = await supabase
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
    async (req, res) => {

        try {

            if (!req.session.user) {
                return res.status(401).json({
                    error:
                        "You must be logged in."
                });
            }

            const content =
                String(
                    req.body.content ||
                    ""
                ).trim();

            if (content.length > 500) {
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
            } = await supabase
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
        } = await supabase
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
        } = await supabase
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
        } = await supabase
            .from("reactions")
            .select(
                "*",
                {
                    count: "exact",
                    head: true
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
    async (req, res) => {

        await addReaction(
            req,
            res,
            "gyatt"
        );

    }
);

app.post(
    "/api/users/:id/cat",
    async (req, res) => {

        await addReaction(
            req,
            res,
            "cat"
        );

    }
);

app.post(
    "/api/users/:id/ogred",
    async (req, res) => {

        await addReaction(
            req,
            res,
            "ogred"
        );

    }
);

// ==================================================
// SHREKCHAT - ROOMS
// ==================================================

app.get(
    "/api/chat/rooms",
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
            } = await supabase
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
                        ascending: true
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
            } = await supabase
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

// ==================================================
// CREATE ROOM
// ==================================================

app.post(
    "/api/chat/rooms",
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

            if (name.length > 50) {
                return res.status(400).json({
                    error:
                        "Room name is too long."
                });
            }

            const {
                data: room,
                error
            } = await supabase
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
            } = await supabase
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
            } = await supabase
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
                } = await supabase
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
            } = await supabase
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
            } = await supabase
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
            } = await supabase
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
            } = await supabase
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
            } = await supabase
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
            } = await supabase
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
            } = await supabase
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
            } = await supabase
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
            } = await supabase
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
            } = await supabase
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
            } = await supabase
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
            } = await supabase
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
                        ascending: true
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
            } = await supabase
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

            if (content.length > 1000) {
                return res.status(400).json({
                    error:
                        "Message is too long."
                });
            }

            const {
                data,
                error
            } = await supabase
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
// HEARTBEAT
// ==================================================

app.post(
    "/api/heartbeat",
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
            } = await supabase
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

// ============================================================
// SHREKBOOK STAFF / ROLE SYSTEM
// ============================================================
//
// ROLE HIERARCHY:
//
// peasant             = 1  👤 No staff powers
// moderator           = 2  🔨 Kicks / basic moderation
// senior_moderator    = 3  ⚔️ Expanded moderation
// administrator       = 4  🛡️ Staff management / bans / revokes
// owner               = 5  👑 Full control
//
// IMPORTANT:
// Set OWNER_USER_ID in Render Environment Variables to your
// Supabase Auth UUID.
//
// The owner is protected independently of the profiles.role
// column and admins table.
// ============================================================


const ROLE_POWER = {

    peasant:
        1,

    moderator:
        2,

    senior_moderator:
        3,

    administrator:
        4,

    owner:
        5

};


const STAFF_ROLES = [

    "moderator",

    "senior_moderator",

    "administrator",

    "owner"

];


const ROLE_NAMES = {

    peasant:
        "👤 Peasant",

    moderator:
        "🔨 Moderator",

    senior_moderator:
        "⚔️ Senior Moderator",

    administrator:
        "🛡️ Administrator",

    owner:
        "👑 Owner"

};


// ============================================================
// GET ROLE
// ============================================================



async function getUserRole(userId) {

    if (!userId) {
        return "peasant";
    }

    // ========================================================
    // OWNER PROTECTION
    // ========================================================

    // Render OWNER_USER_ID always has owner authority.

    if (
        process.env.OWNER_USER_ID &&
        String(userId).trim() ===
        String(process.env.OWNER_USER_ID).trim()
    ) {
        return "owner";
    }


    // ========================================================
    // READ ROLE FROM admins TABLE
    // ========================================================

    try {

        const {
            data: staff,
            error
        } = await supabase

            .from("admins")

            .select(`
                user_id,
                role
            `)

            .eq(
                "user_id",
                userId
            )

            .maybeSingle();


        if (error) {

            console.error(
                "STAFF ROLE CHECK ERROR:",
                error
            );

            return "peasant";
        }


        if (staff) {

            const role =
                String(
                    staff.role ||
                    ""
                )
                .trim()
                .toLowerCase();


            // Valid role stored in admins.role

            if (
                Object.prototype.hasOwnProperty.call(
                    ROLE_POWER,
                    role
                )
            ) {

                return role;

            }


            // Old admin row with no role.
            // Treat it as administrator for backwards
            // compatibility.

            return "administrator";

        }

    } catch (error) {

        console.error(
            "GET USER ROLE ERROR:",
            error
        );

    }


    // ========================================================
    // NORMAL USERS
    // ========================================================

    return "peasant";
}


// ============================================================
// GET CURRENT STAFF
// ============================================================

async function getCurrentStaff(req) {

    if (
        !req.session ||
        !req.session.user ||
        !req.session.user.id
    ) {

        return null;

    }


    const userId =
        req.session.user.id;


    const role =
        await getUserRole(
            userId
        );


    return {

        id:
            userId,

        role:
            role,

        power:
            ROLE_POWER[role] ||
            ROLE_POWER.peasant

    };

}


// ============================================================
// REQUIRE LOGIN
// ============================================================

function requireLogin(
    req,
    res,
    next
) {

    if (
        !req.session ||
        !req.session.user
    ) {

        return res.status(401).json({

            error:
                "You must be logged in."

        });

    }


    next();

}


// ============================================================
// REQUIRE STAFF
// ============================================================

async function requireStaff(
    req,
    res,
    next
) {

    try {

        const staff =
            await getCurrentStaff(
                req
            );


        if (!staff) {

            return res.status(401).json({

                error:
                    "You must be logged in."

            });

        }


        if (
            !STAFF_ROLES.includes(
                staff.role
            )
        ) {

            return res.status(403).json({

                error:
                    "Staff access required.",

                isStaff:
                    false,

                isAdmin:
                    false,

                role:
                    staff.role

            });

        }


        req.staff =
            staff;


        next();

    } catch (error) {

        console.error(
            "REQUIRE STAFF ERROR:",
            error
        );


        return res.status(500).json({

            error:
                "Could not determine staff role."

        });

    }

}


// ============================================================
// REQUIRE ADMINISTRATOR
// ============================================================

async function requireAdministrator(
    req,
    res,
    next
) {

    try {

        const staff =
            await getCurrentStaff(
                req
            );


        if (!staff) {

            return res.status(401).json({

                error:
                    "You must be logged in."

            });

        }


        if (
            staff.role !==
                "administrator" &&

            staff.role !==
                "owner"
        ) {

            return res.status(403).json({

                error:
                    "Administrator access required.",

                role:
                    staff.role

            });

        }


        req.staff =
            staff;


        next();

    } catch (error) {

        console.error(
            "REQUIRE ADMINISTRATOR ERROR:",
            error
        );


        return res.status(500).json({

            error:
                "Could not determine staff role."

        });

    }

}


// ============================================================
// REQUIRE OWNER
// ============================================================

async function requireOwner(
    req,
    res,
    next
) {

    try {

        const staff =
            await getCurrentStaff(
                req
            );


        if (!staff) {

            return res.status(401).json({

                error:
                    "You must be logged in."

            });

        }


        if (
            staff.role !==
            "owner"
        ) {

            return res.status(403).json({

                error:
                    "Owner access required.",

                role:
                    staff.role

            });

        }


        req.staff =
            staff;


        next();

    } catch (error) {

        console.error(
            "REQUIRE OWNER ERROR:",
            error
        );


        return res.status(500).json({

            error:
                "Could not determine owner status."

        });

    }

}


// ============================================================
// BACKWARDS-COMPATIBLE isAdmin()
// ============================================================

async function isAdmin(
    userId
) {

    if (!userId) {

        return false;

    }


    const role =
        await getUserRole(
            userId
        );


    return (

        role ===
            "administrator" ||

        role ===
            "owner"

    );

}


// ============================================================
// ONE /api/admin/me ROUTE
// ============================================================
//
// DELETE ALL OTHER /api/admin/me ROUTES.
// ============================================================

app.get(

    "/api/admin/me",

    requireLogin,

    async (
        req,
        res
    ) => {

        try {

            const staff =
                await getCurrentStaff(
                    req
                );


            if (!staff) {

                return res.status(401).json({

                    error:
                        "You must be logged in."

                });

            }


            const isStaff =

                STAFF_ROLES.includes(
                    staff.role
                );


            const isAdmin =

                staff.role ===
                    "administrator" ||

                staff.role ===
                    "owner";


            res.json({

                success:
                    true,

                isStaff:
                    isStaff,

                isAdmin:
                    isAdmin,

                role:
                    staff.role,

                power:
                    staff.power,

                user: {

                    id:
                        staff.id

                }

            });

        } catch (error) {

            console.error(
                "STAFF STATUS ERROR:",
                error
            );


            res.status(500).json({

                error:
                    "Could not check staff status."

            });

        }

    }

);


// ============================================================
// GET STAFF USERS
// ============================================================

app.get(

    "/api/admin/users",

    requireStaff,

    async (
        req,
        res
    ) => {

        try {

            const search =

                String(
                    req.query.search ||
                    ""
                )
                .trim();


            let query =

                supabase

                    .from("profiles")

                    .select(`

                        id,

                        username,

                        display_name,

                        avatar,

                        role,

                        created_at

                    `)

                    .order(
                        "created_at",
                        {
                            ascending:
                                false
                        }
                    )

                    .limit(100);


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

                return res.status(500).json({

                    error:
                        error.message

                });

            }


            const users =
                (data || []).map(
                    user => ({

                        ...user,

                        role:
                            user.role ||
                            "peasant"

                    })
                );


            res.json({

                success:
                    true,

                users:
                    users

            });

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


// ============================================================
// CHANGE USER ROLE
// ============================================================

app.post(

    "/api/admin/role",

    requireAdministrator,

    async (
        req,
        res
    ) => {

        try {

            const userId =

                String(
                    req.body.user_id ||
                    ""
                )
                .trim();


            const newRole =

                String(
                    req.body.role ||
                    ""
                )
                .trim()
                .toLowerCase();


            if (!userId) {

                return res.status(400).json({

                    error:
                        "User ID is required."

                });

            }


            if (
                !Object.prototype.hasOwnProperty.call(
                    ROLE_POWER,
                    newRole
                )
            ) {

                return res.status(400).json({

                    error:
                        "Invalid role."

                });

            }


            // ==================================================
            // OWNER CAN NEVER BE CHANGED
            // ==================================================

            const targetIsOwner =

                process.env.OWNER_USER_ID &&

                String(userId) ===
                    String(
                        process.env.OWNER_USER_ID
                    ).trim();


            if (targetIsOwner) {

                return res.status(403).json({

                    error:
                        "The owner cannot be modified."

                });

            }


            // ==================================================
            // OWNER CANNOT BE ASSIGNED
            // ==================================================

            if (
                newRole ===
                "owner"
            ) {

                return res.status(403).json({

                    error:
                        "Owner cannot be assigned through the staff panel."

                });

            }


            // ==================================================
            // GET TARGET
            // ==================================================

            const {

                data: target,

                error: targetError

            } = await supabase

                .from("profiles")

                .select(
                    "id, username, display_name, role"
                )

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


            const oldRole =

                target.role ||
                "peasant";


            // ==================================================
            // POWER PROTECTION
            // ==================================================

            const targetPower =
                ROLE_POWER[
                    oldRole
                ] || 1;


            const actorPower =
                req.staff.power;


            // Nobody can modify someone equal/higher than them
            // except the owner.

            if (
                req.staff.role !==
                    "owner" &&

                targetPower >=
                    actorPower
            ) {

                return res.status(403).json({

                    error:
                        "You cannot modify a staff member of equal or higher rank."

                });

            }


            // ==================================================
            // UPDATE ROLE
            // ==================================================

            const {

                data: updated,

                error: updateError

            } = await supabase

                .from("profiles")

                .update({

                    role:
                        newRole

                })

                .eq(
                    "id",
                    userId
                )

                .select(
                    "id, username, display_name, role"
                )

                .single();


            if (updateError) {

                return res.status(500).json({

                    error:
                        updateError.message

                });

            }


            res.json({

                success:
                    true,

                previous_role:
                    oldRole,

                role:
                    newRole,

                user:
                    updated

            });

        } catch (error) {

            console.error(
                "CHANGE ROLE ERROR:",
                error
            );


            res.status(500).json({

                error:
                    "Server error while changing role."

            });

        }

    }

);


// ============================================================
// GET ADMINS / STAFF
// ============================================================

app.get(

    "/api/admin/admins",

    requireStaff,

    async (
        req,
        res
    ) => {

        try {

            const {

                data,
                error

            } = await supabase

                .from("profiles")

                .select(`

                    id,

                    username,

                    display_name,

                    avatar,

                    role,

                    created_at

                `)

                .in(
                    "role",
                    STAFF_ROLES
                )

                .order(
                    "role",
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

                success:
                    true,

                admins:
                    data || []

            });

        } catch (error) {

            console.error(
                "GET STAFF ERROR:",
                error
            );


            res.status(500).json({

                error:
                    "Server error."

            });

        }

    }

);


// ============================================================
// ADD ADMIN — LEGACY COMPATIBILITY
// ============================================================

app.post(

    "/api/admin/admins",

    requireOwner,

    async (
        req,
        res
    ) => {

        try {

            const userId =

                String(
                    req.body.user_id ||
                    ""
                )
                .trim();


            if (!userId) {

                return res.status(400).json({

                    error:
                        "User ID is required."

                });

            }


            if (
                process.env.OWNER_USER_ID &&
                String(userId) ===
                    String(
                        process.env.OWNER_USER_ID
                    ).trim()
            ) {

                return res.status(400).json({

                    error:
                        "That user is already the owner."

                });

            }


            const {

                data: profile,

                error: profileError

            } = await supabase

                .from("profiles")

                .select("id, role")

                .eq(
                    "id",
                    userId
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

                data,
                error

            } = await supabase

                .from("profiles")

                .update({

                    role:
                        "administrator"

                })

                .eq(
                    "id",
                    userId
                )

                .select()
                .single();


            if (error) {

                return res.status(500).json({

                    error:
                        error.message

                });

            }


            res.status(201).json({

                success:
                    true,

                admin:
                    data

            });

        } catch (error) {

            console.error(
                "ADD ADMIN ERROR:",
                error
            );


            res.status(500).json({

                error:
                    "Server error."

            });

        }

    }

);


// ============================================================
// REMOVE ADMIN — LEGACY COMPATIBILITY
// ============================================================

app.delete(

    "/api/admin/admins/:userId",

    requireOwner,

    async (
        req,
        res
    ) => {

        try {

            const userId =
                req.params.userId;


            if (
                process.env.OWNER_USER_ID &&

                String(userId) ===
                    String(
                        process.env.OWNER_USER_ID
                    ).trim()
            ) {

                return res.status(403).json({

                    error:
                        "The owner cannot be removed."

                });

            }


            const {

                data,
                error

            } = await supabase

                .from("profiles")

                .update({

                    role:
                        "peasant"

                })

                .eq(
                    "id",
                    userId
                )

                .select()
                .maybeSingle();


            if (error) {

                return res.status(500).json({

                    error:
                        error.message

                });

            }


            if (!data) {

                return res.status(404).json({

                    error:
                        "User not found."

                });

            }


            // Also remove old admins-table entry.

            await supabase

                .from("admins")

                .delete()

                .eq(
                    "user_id",
                    userId
                );


            res.json({

                success:
                    true

            });

        } catch (error) {

            console.error(
                "REMOVE ADMIN ERROR:",
                error
            );


            res.status(500).json({

                error:
                    "Server error."

            });

        }

    }

);


// ============================================================
// GET BANS
// ============================================================

app.get(

    "/api/admin/bans",

    requireAdministrator,

    async (
        req,
        res
    ) => {

        try {

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

                success:
                    true,

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
                    "Server error."

            });

        }

    }

);


// ============================================================
// BAN USER
// ============================================================

app.post(

    "/api/admin/bans",

    requireAdministrator,

    async (
        req,
        res
    ) => {

        try {

            let email =

                String(
                    req.body.email ||
                    ""
                )
                .trim()
                .toLowerCase();


            const reason =

                String(
                    req.body.reason ||
                    ""
                )
                .trim() ||
                "No reason provided.";


            let userId =

                String(
                    req.body.user_id ||
                    ""
                )
                .trim();


            if (!email && !userId) {

                return res.status(400).json({

                    error:
                        "Provide an email or user ID."

                });

            }


            // ==================================================
            // FIND USER BY ID
            // ==================================================

            if (userId) {

                const {

                    data: authResult,

                    error

                } = await supabase
                    .auth
                    .admin
                    .getUserById(
                        userId
                    );


                if (
                    error ||
                    !authResult?.user
                ) {

                    return res.status(404).json({

                        error:
                            "User not found."

                    });

                }


                if (!email) {

                    email =

                        String(
                            authResult.user.email ||
                            ""
                        )
                        .trim()
                        .toLowerCase();

                }

            }


            // ==================================================
            // FIND USER BY EMAIL
            // ==================================================

            if (
                email &&
                !userId
            ) {

                const {

                    data: usersData,

                    error

                } = await supabase
                    .auth
                    .admin
                    .listUsers({

                        page:
                            1,

                        perPage:
                            1000

                    });


                if (error) {

                    return res.status(500).json({

                        error:
                            error.message

                    });

                }


                const target =

                    (
                        usersData?.users ||
                        []
                    )
                    .find(
                        user =>
                            String(
                                user.email ||
                                ""
                            )
                            .trim()
                            .toLowerCase()
                            === email
                    );


                if (target) {

                    userId =
                        target.id;

                }

            }


            // ==================================================
            // CANNOT BAN OWNER
            // ==================================================

            if (
                userId &&
                process.env.OWNER_USER_ID &&
                String(userId) ===
                    String(
                        process.env.OWNER_USER_ID
                    ).trim()
            ) {

                return res.status(403).json({

                    error:
                        "The owner cannot be banned."

                });

            }


            // ==================================================
            // CANNOT BAN YOURSELF
            // ==================================================

            if (
                userId &&
                userId ===
                    req.session.user.id
            ) {

                return res.status(400).json({

                    error:
                        "You cannot ban yourself."

                });

            }


            // ==================================================
            // CHECK EXISTING BAN
            // ==================================================

            let existingQuery =
                supabase
                    .from("bans")
                    .select("id")
                    .eq(
                        "active",
                        true
                    );


            if (userId) {

                existingQuery =
                    existingQuery.eq(
                        "user_id",
                        userId
                    );

            } else {

                existingQuery =
                    existingQuery.eq(
                        "email",
                        email
                    );

            }


            const {

                data: existing

            } = await existingQuery
                .maybeSingle();


            if (existing) {

                return res.status(409).json({

                    error:
                        "That user is already banned."

                });

            }


            // ==================================================
            // INSERT BAN
            // ==================================================

            const {

                data: ban,

                error: banError

            } = await supabase

                .from("bans")

                .insert({

                    user_id:
                        userId ||
                        null,

                    email:
                        email ||
                        null,

                    reason:
                        reason,

                    banned_by:
                        req.session.user.id,

                    active:
                        true

                })

                .select()
                .single();


            if (banError) {

                return res.status(500).json({

                    error:
                        banError.message

                });

            }


            // ==================================================
            // REVOKE SUPABASE AUTH SESSION
            // ==================================================

            if (userId) {

                try {

                    await supabase
                        .auth
                        .admin
                        .updateUserById(

                            userId,

                            {
                                ban_duration:
                                    "876000h"
                            }

                        );

                } catch (authError) {

                    console.error(
                        "AUTH BAN ERROR:",
                        authError
                    );

                }


                // Keep profile synchronized.

                try {

                    await supabase

                        .from("profiles")

                        .update({

                            is_revoked:
                                true

                        })

                        .eq(
                            "id",
                            userId
                        );

                } catch (
                    profileError
                ) {

                    console.error(
                        "PROFILE BAN SYNC ERROR:",
                        profileError
                    );

                }

            }


            res.status(201).json({

                success:
                    true,

                ban:
                    ban

            });

        } catch (error) {

            console.error(
                "BAN ERROR:",
                error
            );


            res.status(500).json({

                error:
                    error.message ||
                    "Server error."

            });

        }

    }

);


// ============================================================
// UNBAN
// ============================================================

app.post(

    "/api/admin/bans/:banId/unban",

    requireAdministrator,

    async (
        req,
        res
    ) => {

        try {

            const banId =
                req.params.banId;


            const {

                data: ban,

                error: findError

            } = await supabase

                .from("bans")

                .select("*")

                .eq(
                    "id",
                    banId
                )

                .maybeSingle();


            if (findError) {

                return res.status(500).json({

                    error:
                        findError.message

                });

            }


            if (!ban) {

                return res.status(404).json({

                    error:
                        "Ban not found."

                });

            }


            const {

                data: updated,

                error: updateError

            } = await supabase

                .from("bans")

                .update({

                    active:
                        false

                })

                .eq(
                    "id",
                    banId
                )

                .select()
                .maybeSingle();


            if (updateError) {

                return res.status(500).json({

                    error:
                        updateError.message

                });

            }


            // Restore Auth access.

            if (ban.user_id) {

                try {

                    await supabase

                        .auth
                        .admin
                        .updateUserById(

                            ban.user_id,

                            {
                                ban_duration:
                                    "none"
                            }

                        );

                } catch (error) {

                    console.error(
                        "AUTH UNBAN ERROR:",
                        error
                    );

                }


                try {

                    await supabase

                        .from("profiles")

                        .update({

                            is_revoked:
                                false

                        })

                        .eq(
                            "id",
                            ban.user_id
                        );

                } catch (error) {

                    console.error(
                        "PROFILE UNBAN ERROR:",
                        error
                    );

                }

            }


            res.json({

                success:
                    true,

                ban:
                    updated

            });

        } catch (error) {

            console.error(
                "UNBAN ERROR:",
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