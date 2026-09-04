
require("dotenv").config();
const multer = require("multer");

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 50 * 1024 * 1024
    }
});
// ==================================================
// GLOBAL / SPECIFIC MESSAGES
// ==================================================

let globalMessage = null;

const specificMessages = new Map();

// Tracks when each logged-in session started
const messageSessionTimes = new Map();
const express = require("express");
const path = require("path");
const http = require("http");

const session = require("express-session");

const { createClient } = require("@supabase/supabase-js");

const { InferenceClient } = require("@huggingface/inference");

const hf = new InferenceClient(
    process.env.HF_TOKEN
);
const app = express();

const PORT =
    process.env.PORT || 3000;


// ==================================================
// ENVIRONMENT VARIABLES
// ==================================================

const SUPABASE_URL =
    process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

const SESSION_SECRET =
    process.env.SESSION_SECRET;


// ==================================================
// CHECK ENVIRONMENT
// ==================================================

if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
) {

    console.error(
        "❌ Missing Supabase environment variables."
    );

    process.exit(1);

}


if (!SESSION_SECRET) {

    console.error(
        "❌ Missing SESSION_SECRET."
    );

    process.exit(1);

}

/* ============================================================
   MODERATION WEBSOCKET SERVER
============================================================ */



// ==================================================
// SUPABASE
// ==================================================

const supabase =
    createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY
    );


// ==================================================
// SESSION STORE
// ==================================================

const sessionStore =
    new session.MemoryStore();


// ==================================================
// EXPRESS SESSION
// ==================================================

app.use(
    session({

        secret:
            SESSION_SECRET,

        resave:
            false,

        saveUninitialized:
            false,

        store:
            sessionStore,

        cookie: {

            secure:
                false,

            httpOnly:
                true,

            sameSite:
                "lax"

        }

    })
);

async function awardShrekCoins(
    userId,
    amount,
    reason
) {

    try {

        if (
            !userId ||
            !Number.isInteger(amount) ||
            amount === 0
        ) {

            return false;

        }


        // ------------------------------------------
        // GET CURRENT BALANCE
        // ------------------------------------------

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .select("shrekcoins")
            .eq(
                "id",
                userId
            )
            .single();


        if (
            profileError ||
            !profile
        ) {

            console.error(
                "SHREKCOIN PROFILE ERROR:",
                profileError
            );

            return false;

        }


        const newBalance =
            Math.max(
                0,
                (profile.shrekcoins || 0) +
                amount
            );


        // ------------------------------------------
        // UPDATE BALANCE
        // ------------------------------------------

        const {
            error: updateError
        } = await supabase
            .from("profiles")
            .update({
                shrekcoins:
                    newBalance
            })
            .eq(
                "id",
                userId
            );


        if (updateError) {

            console.error(
                "SHREKCOIN UPDATE ERROR:",
                updateError
            );

            return false;

        }


        // ------------------------------------------
        // RECORD TRANSACTION
        // ------------------------------------------

        const {
            error: transactionError
        } = await supabase
            .from("shrekcoin_transactions")
            .insert({

                user_id:
                    userId,

                amount:
                    amount,

                reason:
                    reason

            });


        if (transactionError) {

            console.error(
                "SHREKCOIN TRANSACTION ERROR:",
                transactionError
            );

        }


        console.log(
            `🪙 ${amount > 0 ? "+" : ""}${amount} ShrekCoins → ${userId} (${reason})`
        );


        return true;

    } catch (error) {

        console.error(
            "SHREKCOIN ERROR:",
            error
        );

        return false;

    }

}

app.get("/api/shreksearch", async (req, res) => {
    try {
        const query = String(req.query.q || "").trim();

        if (!query) {
            return res.status(400).json({
                error: "Missing search query"
            });
        }

        const apiKey = process.env.TAVILY_API_KEY;

        if (!apiKey) {
            console.error("TAVILY_API_KEY is missing");

            return res.status(500).json({
                error: "TAVILY_API_KEY missing"
            });
        }

        console.log("ShrekSearch query:", query);

        const response = await fetch("https://api.tavily.com/search", {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },

            body: JSON.stringify({
                query: query,

                search_depth: "basic",

                max_results: 8,

                include_answer: true
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Tavily error:", data);

            return res.status(500).json({
                error: "Tavily search failed",
                details: data
            });
        }

        const results = (data.results || []).map(result => ({
            title: result.title || "",
            url: result.url || "",
            description: result.content || "",
            content: result.content || ""
        }));

        res.json({
            query: query,

            // THIS is the AI-style answer
            answer: data.answer || "No AI answer was generated.",

            results: results
        });

    } catch (error) {

        console.error("SHREKSEARCH ERROR:", error);

        res.status(500).json({
            error: "Search failed",
            details: error.message
        });
    }
});
// ==================================================
// INSTANT MODERATION WEBSOCKET
// ==================================================

const server =
    http.createServer(app);

/* ==================================================
   ONLINE STATUS
================================================== */
app.get("/api/moderation/status", async (req, res) => {

    try {

        if (!req.session || !req.session.userId) {

            return res.json({
                loggedIn: false,
                banned: false,
                kicked: false
            });

        }

        const userId =
            req.session.userId;

        const { data: user, error } =
            await supabase
                .from("profiles")
                .select("id, banned, kicked")
                .eq("id", userId)
                .single();

        if (error) {

            console.error(
                "Moderation status error:",
                error
            );

            return res.status(500).json({
                error: "Failed to check moderation status"
            });

        }

        res.json({
            loggedIn: true,
            banned: user?.banned === true,
            kicked: user?.kicked === true
        });

    } catch (error) {

        console.error(
            "Moderation status error:",
            error
        );

        res.status(500).json({
            error: "Server error"
        });

    }

});
app.get("/api/online", async (req, res) => {

    try {

        const {
            data: users,
            error
        } = await supabase
            .from("profiles")
            .select(`
                id,
                username,
                display_name,
                avatar,
                last_seen
            `);

        if (error) {

            console.error(
                "ONLINE USERS ERROR:",
                error
            );

            return res.status(500).json({
                error: error.message
            });

        }

        const now = Date.now();

        // User is considered online if
        // their heartbeat was within the last 30 seconds.
        const onlineUsers = (users || [])
            .map(user => {

                const lastSeen =
                    user.last_seen
                        ? new Date(user.last_seen).getTime()
                        : 0;

                const online =
                    lastSeen > 0 &&
                    now - lastSeen < 30000;

                return {
                    id: user.id,
                    username: user.username,
                    display_name: user.display_name,
                    avatar: getAvatar(user.avatar),
                    last_seen: user.last_seen,
                    online
                };

            });

        return res.json({
            success: true,
            users: onlineUsers
        });

    } catch (error) {

        console.error(
            "ONLINE ERROR:",
            error
        );

        return res.status(500).json({
            error: "Failed to load online users."
        });

    }

});
// ==================================================
// DEFAULT AVATAR
// ==================================================

const DEFAULT_AVATAR =
    "/default-avatar.png";



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

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
});

app.use(sessionMiddleware);

app.use(express.static(
    path.join(__dirname, "public")
));
app.get("/sitemap.xml", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "sitemap.xml")
    );
});
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
app.post("/api/admin/ban", async (req, res) => {

    try {

        // ==========================================
        // CHECK LOGIN
        // ==========================================

        if (!req.session.user) {
            return res.status(401).json({
                error: "You must be logged in."
            });
        }


        // ==========================================
        // CHECK PERMISSION
        // ==========================================

        const { data: user, error: userError } =
            await supabase
                .from("profiles")
                .select("role")
                .eq("id", req.session.user.id)
                .maybeSingle();


        if (userError || !user) {

            console.error(
                "BAN PERMISSION CHECK ERROR:",
                userError
            );

            return res.status(403).json({
                error: "Unable to verify permissions."
            });

        }


        const canBan = [
            "administrator",
            "owner"
        ];


        if (!canBan.includes(user.role)) {

            return res.status(403).json({
                error:
                    "You do not have permission to ban users."
            });

        }


        // ==========================================
        // GET TARGET USER
        // ==========================================

        const { userId, reason } = req.body;


        if (!userId) {

            return res.status(400).json({
                error: "User ID is required."
            });

        }


        // ==========================================
        // BAN PROFILE
        // ==========================================

        const { error } =
            await supabase
                .from("profiles")
                .update({
                    banned: true
                })
                .eq("id", userId);


        if (error) {

            console.error(
                "Ban error:",
                error
            );

            return res.status(500).json({
                error:
                    "Failed to ban user."
            });

        }


        // ==========================================
        // LIVE BAN
        // ==========================================

        liveBanUser(userId);


        // ==========================================
        // SUCCESS
        // ==========================================

        return res.json({

            success: true,

            message:
                "User banned successfully."

        });


    } catch (error) {

        console.error(
            "ADMIN BAN ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Server error while banning user."
        });

    }

});
// ==================================================
// ADMIN AUTH
// ==================================================
app.post("/api/admin/kick", async (req, res) => {
    const { userId } = req.body;

    const { error } = await supabase
        .from("profiles")
        .update({
            kicked: true
        })
        .eq("id", userId);

    if (error) {
        console.error("Kick error:", error);

        return res.status(500).json({
            error: "Failed to kick user"
        });
    }

    // 🔥 Tell the user's browser immediately
    liveKickUser(userId);
    setTimeout(() => {
        clearKick(userId);
    }, 1000);
    res.json({
        success: true
    });
});
app.get("/api/admin/auth", requireLogin, async (req, res) => {
    try {

        const userId = req.session.user.id;

        const { data: profile, error } = await supabase
            .from("profiles")
            .select("id, username, display_name, role, is_active")
            .eq("id", userId)
            .maybeSingle();

        if (error) {
            console.error("ADMIN AUTH ERROR:", error);

            return res.status(500).json({
                error: error.message
            });
        }

        if (!profile) {
            return res.status(404).json({
                error: "User profile not found."
            });
        }

        const allowedRoles = [
            "owner",
            "administrator",
            "senior_moderator",
            "junior_moderator"
        ];
        console.log(profile.role);
        if (!allowedRoles.includes(profile.role)) {
            return res.status(403).json({
            
                error: "Admin access required."
            });

        }


        res.json({
            success: true,
            authorized: true,
            user: profile
        });

    } catch (error) {

        console.error("ADMIN AUTH ERROR:", error);

        res.status(500).json({
            error: "Server error."
        });

    }
});
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
function requireLogin(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            error: "You must be logged in."
        });
    }

    next();
}

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


        // ==========================================
        // CHECK INPUT
        // ==========================================

        if (!email || !password) {

            return res.status(400).json({
                error:
                    "Email and password are required."
            });

        }


        // ==========================================
        // CHECK EMAIL BAN
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


        if (!authUser) {

            return res.status(401).json({

                error:
                    "Login failed."

            });

        }


        // ==========================================
        // CHECK USER-ID BAN
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

            console.error(
                "LOGIN PROFILE ERROR:",
                profileError
            );

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


            // Find unused username

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


            // ======================================
            // CREATE PROFILE
            // ======================================

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
                            "",

                        role:
                            "peasant",

                        is_active:
                            true,

                        banned:
                            false,

                        // ==========================
                        // SHREKCOINS
                        // ==========================

                        shrekcoins:
                            10,

                        last_shrekcoin_login:
                            new Date()
                                .toISOString()
                                .slice(0, 10)

                    })
                    .select()
                    .single();


            if (createError) {

                console.error(
                    "CREATE PROFILE ERROR:",
                    createError
                );

                return res.status(500).json({

                    error:
                        createError.message

                });

            }


            profile =
                created;


            console.log(
                `🪙 ${username} received 10 ShrekCoins for their first login.`
            );

        }


        // ==========================================
        // CHECK PROFILE BAN
        // ==========================================

        if (profile.banned === true) {

            return res.status(403).json({

                error:
                    "Your account has been banned from ShrekBook."

            });

        }


        // ==========================================
        // CHECK PROFILE ACTIVE STATUS
        // ==========================================

        if (profile.is_active === false) {

            return res.status(403).json({

                error:
                    "Your ShrekBook account is currently inactive."

            });

        }


        // ==========================================
        // DAILY LOGIN SHREKCOIN
        //
        // First login of each day = +10
        // ==========================================

        const today =
            new Date()
                .toISOString()
                .slice(0, 10);


        let loginCoinsAwarded =
            0;


        if (
            profile.last_shrekcoin_login !==
            today
        ) {

            const currentCoins =
                Number(
                    profile.shrekcoins || 0
                );


            const newCoinTotal =
                currentCoins + 10;


            const {
                data: updatedProfile,
                error: coinError
            } =
                await supabase
                    .from("profiles")
                    .update({

                        shrekcoins:
                            newCoinTotal,

                        last_shrekcoin_login:
                            today

                    })
                    .eq(
                        "id",
                        profile.id
                    )
                    .select()
                    .single();


            if (coinError) {

                console.error(
                    "SHREKCOIN LOGIN ERROR:",
                    coinError
                );

                // Don't prevent login if the
                // coin system happens to fail.
                loginCoinsAwarded = 0;

            } else {

                profile =
                    updatedProfile;

                loginCoinsAwarded =
                    10;


                console.log(
                    `🪙 ${profile.username} received 10 ShrekCoins for logging in today.`
                );

            }

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

                    loginCoinsAwarded:
                        loginCoinsAwarded,

                    shrekcoins:
                        Number(
                            profile.shrekcoins || 0
                        ),

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



app.post("/api/admin/global-message", async (req, res) => {

    try {

        if (
            !req.session ||
            !req.session.user
        ) {

            return res.status(401).json({
                error: "Not logged in"
            });

        }


        const {
            data: profile,
            error
        } = await supabase
            .from("profiles")
            .select("role")
            .eq(
                "id",
                req.session.user.id
            )
            .single();


        if (
            error ||
            !profile
        ) {

            return res.status(403).json({
                error:
                    "Unable to verify permissions."
            });

        }


        // OWNER ONLY
        if (
            profile.role !== "owner"
        ) {

            return res.status(403).json({
                error:
                    "Only the owner can send global messages."
            });

        }


        const {
            message
        } = req.body;


        if (
            !message ||
            !message.trim()
        ) {

            return res.status(400).json({
                error:
                    "Message cannot be empty."
            });

        }


        if (
            message.length > 1000
        ) {

            return res.status(400).json({
                error:
                    "Message is too long."
            });

        }


        globalMessage = {

            id:
                Date.now(),

            message:
                message.trim(),

            createdAt:
                Date.now()

        };


        res.json({
            success: true
        });


    } catch (error) {

        console.error(
            "GLOBAL MESSAGE ERROR:",
            error
        );

        res.status(500).json({
            error:
                "Failed to send global message."
        });

    }

});
// ==================================================
// MARK GLOBAL MESSAGE AS READ
// ==================================================

app.post("/api/global-message/read", async (req, res) => {

    try {

        if (
            !req.session ||
            !req.session.user ||
            !req.session.user.id
        ) {

            return res.status(401).json({
                error:
                    "Not logged in."
            });

        }


        if (
            !globalMessage
        ) {

            return res.json({
                success:
                    true
            });

        }


        globalMessage.readBy.add(
            req.session.user.id
        );


        return res.json({
            success:
                true
        });


    } catch (error) {

        console.error(
            "GLOBAL MESSAGE READ ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Failed to mark message as read."
        });

    }

});
// ==================================================
// SEND SPECIFIC MESSAGE
// ADMIN + OWNER ONLY
// ==================================================

app.post(
    "/api/admin/specific-message",
    async (req, res) => {

        try {

            // ------------------------------------------
            // CHECK LOGIN
            // ------------------------------------------

            if (
                !req.session ||
                !req.session.user ||
                !req.session.user.id
            ) {

                return res.status(401).json({
                    error: "Not logged in."
                });

            }


            const senderId =
                req.session.user.id;


            // ------------------------------------------
            // GET SENDER PROFILE
            // ------------------------------------------

            const {
                data: sender,
                error: senderError
            } = await supabase
                .from("profiles")
                .select("id, username, display_name, role")
                .eq(
                    "id",
                    senderId
                )
                .single();


            if (
                senderError ||
                !sender
            ) {

                console.error(
                    "SENDER PROFILE ERROR:",
                    senderError
                );

                return res.status(403).json({
                    error:
                        "Unable to verify your permissions."
                });

            }


            // ------------------------------------------
            // CHECK PERMISSIONS
            // ------------------------------------------

            if (
                sender.role !== "administrator" &&
                sender.role !== "owner"
            ) {

                return res.status(403).json({
                    error:
                        "Only administrators and owners can send specific messages."
                });

            }


            // ------------------------------------------
            // GET REQUEST DATA
            // ------------------------------------------

            const {
                userId,
                message
            } = req.body || {};


            // ------------------------------------------
            // VALIDATE USER ID
            // ------------------------------------------

            if (
                typeof userId !== "string" ||
                !userId.trim()
            ) {

                return res.status(400).json({
                    error:
                        "A valid user ID is required."
                });

            }


            const targetUserId =
                userId.trim();


            // ------------------------------------------
            // PREVENT SELF MESSAGE
            // ------------------------------------------

            if (
                targetUserId === senderId
            ) {

                return res.status(400).json({
                    error:
                        "You cannot send a specific message to yourself."
                });

            }


            // ------------------------------------------
            // VALIDATE MESSAGE
            // ------------------------------------------

            if (
                typeof message !== "string"
            ) {

                return res.status(400).json({
                    error:
                        "Message must be text."
                });

            }


            const cleanMessage =
                message.trim();


            if (
                !cleanMessage
            ) {

                return res.status(400).json({
                    error:
                        "Message cannot be empty."
                });

            }


            if (
                cleanMessage.length > 1000
            ) {

                return res.status(400).json({
                    error:
                        "Message cannot exceed 1000 characters."
                });

            }


            // ------------------------------------------
            // CHECK TARGET USER EXISTS
            // ------------------------------------------

            const {
                data: targetUser,
                error: targetError
            } = await supabase
                .from("profiles")
                .select(
                    "id, username, display_name"
                )
                .eq(
                    "id",
                    targetUserId
                )
                .single();


            if (
                targetError ||
                !targetUser
            ) {

                return res.status(404).json({
                    error:
                        "That user does not exist."
                });

            }


            // ------------------------------------------
            // CHECK EXISTING MESSAGE
            // ------------------------------------------

            const existingMessage =
                specificMessages.get(
                    targetUserId
                );


            if (
                existingMessage
            ) {

                return res.status(409).json({
                    error:
                        "That user already has an unread specific message."
                });

            }


            // ------------------------------------------
            // CREATE MESSAGE
            // ------------------------------------------

            const now =
                Date.now();


            const newMessage = {

                id:
                    `${now}-${Math.random()
                        .toString(36)
                        .slice(2, 10)}`,

                message:
                    cleanMessage,

                createdAt:
                    now,

                senderId:
                    sender.id,

                senderUsername:
                    sender.username,

                senderDisplayName:
                    sender.display_name ||
                    sender.username ||
                    "Administrator"

            };


            // ------------------------------------------
            // STORE MESSAGE
            // ------------------------------------------

            specificMessages.set(
                targetUserId,
                newMessage
            );


            // ------------------------------------------
            // RESPONSE
            // ------------------------------------------

            console.log(
                `📨 Specific message sent by ${sender.username} to ${targetUser.username}`
            );


            return res.json({

                success:
                    true,

                messageId:
                    newMessage.id,

                targetUser: {

                    id:
                        targetUser.id,

                    username:
                        targetUser.username,

                    display_name:
                        targetUser.display_name

                }

            });


        } catch (error) {

            console.error(
                "SPECIFIC MESSAGE ERROR:",
                error
            );


            return res.status(500).json({
                error:
                    "Failed to send specific message."
            });

        }

    }
);



/* ==================================================
   BAN / KICK MONITOR
================================================== */

let moderationCheckRunning = false;

app.get("/api/me", async (req, res) => {

try {

    if (!req.session.user) {

        return res.json({
            loggedIn: false
        });

    }


    // ==========================================
    // MESSAGE SESSION START
    // ==========================================

    if (!req.session.messageStartedAt) {

        req.session.messageStartedAt =
            Date.now();

    }


    // ==========================================
    // LOAD PROFILE
    // ==========================================

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


    // ==========================================
    // GLOBAL MESSAGE
    // ==========================================

    let pendingGlobalMessage = null;


    if (
        globalMessage &&
        globalMessage.createdAt >=
            req.session.messageStartedAt
    ) {

        pendingGlobalMessage =
            globalMessage;

    }


    // ==========================================
    // SPECIFIC MESSAGE
    // ==========================================

    const pendingSpecificMessage =
        specificMessages.get(data.id) || null;


    if (pendingSpecificMessage) {

        specificMessages.delete(data.id);

    }


    // ==========================================
    // REACTIONS
    // ==========================================

    const [reactions, admin] =
        await Promise.all([
            getReactionCounts(data.id),
            isAdmin(data.id)
        ]);

    // ==========================================
    // EQUIPPED TITLE
    // ==========================================

    let equippedTitle = null;


    if (
        data.equipped_title_id
    ) {

        const {
            data: title,
            error: titleError
        } =
            await supabase
                .from("shop_items")
                .select(
                    "id, name, description, icon, price"
                )
                .eq(
                    "id",
                    data.equipped_title_id
                )
                .maybeSingle();


        if (titleError) {

            console.error(
                "EQUIPPED TITLE ERROR:",
                titleError
            );

        } else {

            equippedTitle =
                title || null;

        }

    }


    // ==========================================
    // RESPONSE
    // ==========================================

    res.json({

        loggedIn: true,

        isAdmin:
            admin,

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
                reactions.ogred,

            // ==================================
            // EQUIPPED TITLE
            // ==================================

            equippedTitle:
                equippedTitle

        },

        globalMessage:
            pendingGlobalMessage,

        specificMessage:
            pendingSpecificMessage

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



// ==================================================
// GET SPECIFIC MESSAGE FOR CURRENT USER
// ==================================================

app.get(
    "/api/specific-message",
    async (req, res) => {

        try {

            if (
                !req.session ||
                !req.session.user ||
                !req.session.user.id
            ) {

                return res.status(401).json({
                    error: "Not logged in."
                });

            }

            const userId =
                req.session.user.id;

            const message =
                specificMessages.get(
                    userId
                );

            if (!message) {

                return res.json({
                    message: null
                });

            }

            return res.json({
                message
            });

        } catch (error) {

            console.error(
                "GET SPECIFIC MESSAGE ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    "Failed to get specific message."
            });

        }

    }
);
// ==================================================
// ONLINE STATUS
// ==================================================

app.get("/api/online", async (req, res) => {

    try {

        // User is not logged in
        if (!req.session || !req.session.user) {

            return res.json({
                online: false
            });

        }


        // Make sure the user still exists
        const {
            data,
            error
        } = await supabase
            .from("profiles")
            .select("id")
            .eq(
                "id",
                req.session.user.id
            )
            .single();


        if (error || !data) {

            return res.json({
                online: false
            });

        }


        // User is logged in
        res.json({
            online: true,
            userId: data.id
        });


    } catch (error) {

        console.error(
            "ONLINE ERROR:",
            error
        );

        res.status(500).json({
            online: false,
            error: "Server error."
        });

    }

});


app.post("/api/admin/kick", async (req, res) => {

    try {

        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                error: "Missing userId"
            });
        }

        const { error } = await supabase
            .from("profiles")
            .update({
                kicked: true
            })
            .eq("id", userId);

        if (error) {

            console.error(
                "KICK DATABASE ERROR:",
                error
            );

            return res.status(500).json({
                error: "Failed to kick user"
            });
        }

        // Tell the client indirectly through /api/me,
        // then clear the flag after 1 second.
        setTimeout(async () => {

            try {

                const { error: clearError } =
                    await supabase
                        .from("profiles")
                        .update({
                            kicked: false
                        })
                        .eq("id", userId);

                if (clearError) {

                    console.error(
                        "CLEAR KICK ERROR:",
                        clearError
                    );

                } else {

                    console.log(
                        `🦵 Kick cleared for ${userId}`
                    );

                }

            } catch (error) {

                console.error(
                    "CLEAR KICK EXCEPTION:",
                    error
                );

            }

        }, 1000);


        res.json({
            success: true,
            kicked: true
        });

    } catch (error) {

        console.error(
            "KICK ERROR:",
            error
        );

        res.status(500).json({
            error: "Server error"
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

// ==================================================
// ALL USERS
// ==================================================

app.get(
    "/api/users",
    async (req, res) => {

        try {

            // ==========================================
            // GET USERS
            // ==========================================

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
                    last_seen,
                    equipped_title_id
                `)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


            if (usersError) {

                console.error(
                    "USERS DATABASE ERROR:",
                    usersError
                );

                return res.status(500).json({
                    error:
                        usersError.message
                });

            }


            // ==========================================
            // GET SHOP ITEMS
            // ==========================================

            const {
                data: shopItems,
                error: shopItemsError
            } = await supabase
                .from("shop_items")
                .select(`
                    id,
                    name,
                    description,
                    price,
                    icon,
                    item_type
                `);


            if (shopItemsError) {

                console.error(
                    "SHOP ITEMS ERROR:",
                    shopItemsError
                );

                return res.status(500).json({
                    error:
                        shopItemsError.message
                });

            }


            // ==========================================
            // CREATE ITEM LOOKUP
            // ==========================================

            const titleMap = {};


            for (
                const item of
                shopItems || []
            ) {

                if (
                    item.item_type ===
                    "title"
                ) {

                    titleMap[
                        item.id
                    ] = item;

                }

            }


            // ==========================================
            // GET REACTIONS
            // ==========================================

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

                console.error(
                    "REACTIONS ERROR:",
                    reactionsError
                );

                return res.status(500).json({
                    error:
                        reactionsError.message
                });

            }


            // ==========================================
            // COUNT REACTIONS
            // ==========================================

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

                    reactionCounts[
                        userId
                    ].gyatt++;

                }


                if (
                    reaction.type ===
                    "cat"
                ) {

                    reactionCounts[
                        userId
                    ].cat++;

                }


                if (
                    reaction.type ===
                    "ogred"
                ) {

                    reactionCounts[
                        userId
                    ].ogred++;

                }

            }


            // ==========================================
            // BUILD RESULT
            // ==========================================

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
                            (
                                Date.now() -
                                lastSeen
                            ) < 60 * 1000;


                        // ==================================
                        // EQUIPPED TITLE
                        // ==================================

                        let equippedTitle =
                            null;


                        if (
                            user.equipped_title_id
                        ) {

                            equippedTitle =
                                titleMap[
                                    user.equipped_title_id
                                ] || null;

                        }


                        return {

                            ...user,


                            avatar:
                                getAvatar(
                                    user.avatar
                                ),


                            online,


                            equippedTitle,


                            gyatt:
                                reactionCounts[
                                    user.id
                                ]?.gyatt || 0,


                            cat:
                                reactionCounts[
                                    user.id
                                ]?.cat || 0,


                            ogred:
                                reactionCounts[
                                    user.id
                                ]?.ogred || 0

                        };

                    }
                );


            // ==========================================
            // SEND USERS
            // ==========================================

            return res.json(
                result
            );


        } catch (error) {

            console.error(
                "USERS ERROR:",
                error
            );

            return res.status(500).json({
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

            const id = req.params.id;

            if (!id) {

                return res.status(400).json({
                    error: "No profile ID was provided."
                });

            }


            // ==========================================
            // GET PROFILE
            // ==========================================

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
                    created_at,
                    equipped_title_id
                `)
                .eq(
                    "id",
                    id
                )
                .maybeSingle();


            if (profileError) {

                console.error(
                    "PROFILE ERROR:",
                    profileError
                );

                return res.status(500).json({
                    error: profileError.message
                });

            }


            if (!profile) {

                return res.status(404).json({
                    error: "User not found."
                });

            }


            // ==========================================
            // GET EQUIPPED TITLE
            // ==========================================

            let equippedTitle = null;


            if (profile.equipped_title_id) {

                const {
                    data: title,
                    error: titleError
                } = await supabase
                    .from("shop_items")
                    .select(`
                        id,
                        name,
                        description,
                        price,
                        icon,
                        item_type
                    `)
                    .eq(
                        "id",
                        profile.equipped_title_id
                    )
                    .eq(
                        "item_type",
                        "title"
                    )
                    .maybeSingle();


                if (titleError) {

                    console.error(
                        "EQUIPPED TITLE ERROR:",
                        titleError
                    );

                } else {

                    equippedTitle =
                        title || null;

                }

            }


            // ==========================================
            // GET ALL DISPLAYED ITEMS
            // ==========================================

            let displayedItems = [];


            const {
                data: inventoryItems,
                error: inventoryError
            } = await supabase
                .from("user_shop_items")
                .select(`
                    id,
                    item_id,
                    equipped,
                    purchased_at
                `)
                .eq(
                    "user_id",
                    id
                )
                .eq(
                    "equipped",
                    true
                );


            if (inventoryError) {

                console.error(
                    "DISPLAYED INVENTORY ERROR:",
                    inventoryError
                );

            } else if (
                inventoryItems &&
                inventoryItems.length > 0
            ) {


                // ======================================
                // GET SHOP ITEMS
                // ======================================

                const itemIds =
                    inventoryItems.map(
                        inventoryItem =>
                            inventoryItem.item_id
                    );


                const {
                    data: shopItems,
                    error: shopItemsError
                } = await supabase
                    .from("shop_items")
                    .select(`
                        id,
                        name,
                        description,
                        price,
                        icon,
                        item_type
                    `)
                    .in(
                        "id",
                        itemIds
                    );


                if (shopItemsError) {

                    console.error(
                        "DISPLAYED SHOP ITEMS ERROR:",
                        shopItemsError
                    );

                } else {

                    displayedItems =
                        (shopItems || []).map(
                            shopItem => {

                                const inventoryItem =
                                    inventoryItems.find(
                                        inventoryItem =>
                                            String(
                                                inventoryItem.item_id
                                            ) ===
                                            String(
                                                shopItem.id
                                            )
                                    );


                                return {

                                    id:
                                        shopItem.id,

                                    name:
                                        shopItem.name,

                                    description:
                                        shopItem.description,

                                    price:
                                        shopItem.price,

                                    icon:
                                        shopItem.icon,

                                    item_type:
                                        shopItem.item_type,

                                    purchased_at:
                                        inventoryItem
                                            ?.purchased_at
                                            || null,

                                    equipped:
                                        true

                                };

                            }
                        );

                }

            }


            // ==========================================
            // GET POSTS
            // ==========================================

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
                    error: postsError.message
                });

            }


            // ==========================================
            // REACTIONS
            // ==========================================

            const reactions =
                await getReactionCounts(id);


            // ==========================================
            // RESPONSE
            // ==========================================

            return res.json({

                ...profile,

                avatar:
                    getAvatar(
                        profile.avatar
                    ),

                equippedTitle:
                    equippedTitle,

                displayedItems:
                    displayedItems,

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

            return res.status(500).json({
                error: "Server error."
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


async function uploadImage(
    fileBuffer,
    fileType,
    fileName,
    userId
) {

    // ==========================================
    // CHECK DATA
    // ==========================================

    if (
        !fileBuffer ||
        !fileName ||
        !userId
    ) {

        throw new Error(
            "Missing file data."
        );

    }


    // ==========================================
    // GET EXTENSION
    // ==========================================

    const extension =
        fileName
            .split(".")
            .pop()
            .toLowerCase();


    // ==========================================
    // ALLOWED EXTENSIONS
    // ==========================================

    const allowedExtensions = [
        "png",
        "jpg",
        "jpeg",
        "webp",
        "gif",

        "mp4",
        "webm",
        "mov",

        "mp3"
    ];


    if (
        !allowedExtensions.includes(
            extension
        )
    ) {

        throw new Error(
            "Unsupported file type."
        );

    }


    // ==========================================
    // DETERMINE MIME TYPE
    // ==========================================

    let contentType =
        fileType;


    // Some browsers/clients can send an
    // incorrect or empty MIME type.
    // Trust the extension for known files.

    if (
        extension === "mp3"
    ) {

        contentType =
            "audio/mpeg";

    } else if (
        extension === "mp4"
    ) {

        contentType =
            "video/mp4";

    } else if (
        extension === "webm"
    ) {

        contentType =
            "video/webm";

    } else if (
        extension === "mov"
    ) {

        contentType =
            "video/quicktime";

    } else if (
        extension === "png"
    ) {

        contentType =
            "image/png";

    } else if (
        extension === "jpg" ||
        extension === "jpeg"
    ) {

        contentType =
            "image/jpeg";

    } else if (
        extension === "webp"
    ) {

        contentType =
            "image/webp";

    } else if (
        extension === "gif"
    ) {

        contentType =
            "image/gif";

    }


    // ==========================================
    // SIZE LIMIT
    // ==========================================

    const isVideo =
        extension === "mp4" ||
        extension === "webm" ||
        extension === "mov";

    const isAudio =
        extension === "mp3";

    const maxSize =

        isVideo
            ? 200 * 1024 * 1024
            : isAudio
                ? 20 * 1024 * 1024
                : 5 * 1024 * 1024;


    if (
        fileBuffer.length >
        maxSize
    ) {

        throw new Error(
            isVideo
                ? "Video must be under 50MB."
                : isAudio
                    ? "Audio must be under 20MB."
                    : "Image must be under 5MB."
        );

    }


    // ==========================================
    // STORAGE PATH
    // ==========================================

    const filePath =
        `posts/${userId}/${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}.${extension}`;


    // ==========================================
    // UPLOAD TO SUPABASE
    // ==========================================

    const {
        error: uploadError
    } =
        await supabase.storage
            .from("avatars")
            .upload(
                filePath,
                fileBuffer,
                {
                    contentType:
                        contentType,

                    upsert:
                        false
                }
            );


    if (uploadError) {

        console.error(
            "SUPABASE FILE UPLOAD ERROR:",
            uploadError
        );

        throw new Error(
            uploadError.message
        );

    }


    // ==========================================
    // PUBLIC URL
    // ==========================================

    const {
        data: publicData
    } =
        supabase.storage
            .from("avatars")
            .getPublicUrl(
                filePath
            );


    if (
        !publicData ||
        !publicData.publicUrl
    ) {

        throw new Error(
            "Could not generate file URL."
        );

    }


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
    upload.single("media"),
    async (req, res) => {

        try {

            // ==========================================
            // CHECK LOGIN
            // ==========================================

            if (
                !req.session ||
                !req.session.user
            ) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }


            const userId =
                req.session.user.id;


            // ==========================================
            // GET CONTENT
            // ==========================================

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


            // ==========================================
            // GET UPLOADED FILE
            // ==========================================

            const file =
                req.file ||
                null;


            let imageUrl =
                null;


            // ==========================================
            // UPLOAD IMAGE / VIDEO
            // ==========================================

            if (file) {

                try {

                    imageUrl =
                        await uploadImage(
                            file.buffer,
                            file.mimetype,
                            file.originalname,
                            userId
                        );

                } catch (error) {

                    console.error(
                        "POST FILE UPLOAD ERROR:",
                        error
                    );

                    return res.status(400).json({
                        error:
                            error.message
                    });

                }

            }


            // ==========================================
            // CHECK EMPTY POST
            // ==========================================

            if (
                !content &&
                !imageUrl
            ) {

                return res.status(400).json({
                    error:
                        "Post cannot be empty."
                });

            }


            // ==========================================
            // CREATE POST
            // ==========================================

            const {
                data,
                error
            } =
                await supabase
                    .from("posts")
                    .insert({

                        user_id:
                            userId,

                        content:
                            content,

                        image_url:
                            imageUrl

                    })
                    .select()
                    .single();


            if (error) {

                console.error(
                    "POST INSERT ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            // ==========================================
            // FIRST POST OF THE DAY
            // ==========================================

            const todayUTC =
                new Date()
                    .toISOString()
                    .slice(0, 10);


            const {
                data: profile,
                error: profileError
            } =
                await supabase
                    .from("profiles")
                    .select(
                        "last_post_reward_date"
                    )
                    .eq(
                        "id",
                        userId
                    )
                    .single();


            if (profileError) {

                console.error(
                    "POST REWARD PROFILE ERROR:",
                    profileError
                );

            } else {

                if (
                    profile.last_post_reward_date !==
                    todayUTC
                ) {

                    const {
                        error: coinError
                    } =
                        await supabase.rpc(
                            "increment_shrekcoins",
                            {

                                user_id:
                                    userId,

                                amount:
                                    5

                            }
                        );


                    if (coinError) {

                        console.error(
                            "POST SHREKCOIN ERROR:",
                            coinError
                        );

                    } else {

                        const {
                            error: dateError
                        } =
                            await supabase
                                .from("profiles")
                                .update({

                                    last_post_reward_date:
                                        todayUTC

                                })
                                .eq(
                                    "id",
                                    userId
                                );


                        if (dateError) {

                            console.error(
                                "POST REWARD DATE ERROR:",
                                dateError
                            );

                        }

                    }

                }

            }


            // ==========================================
            // SUCCESS
            // ==========================================

            return res.status(201).json({

                ...data

            });


        } catch (error) {

            console.error(
                "CREATE POST ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);
/* ==================================================
   LEADERBOARD
   ================================================== */

/* ==================================================
   LEADERBOARD API
================================================== */

app.get("/api/leaderboard", async (req, res) => {

    try {

        const type =
            req.query.type || "overall";


        const validTypes = [
            "overall",
            "posts",
            "comments",
            "cat",
            "gyatt",
            "ogred"
        ];


        if (!validTypes.includes(type)) {

            return res.status(400).json({
                error: "Invalid leaderboard type."
            });

        }


        /* ==================================================
           GET PROFILES
        ================================================== */

        const {
            data: profiles,
            error: profilesError
        } = await supabase
            .from("profiles")
            .select(`
                id,
                username,
                display_name,
                avatar
            `);


        if (profilesError) {

            console.error(
                "LEADERBOARD PROFILES ERROR:",
                profilesError
            );

            return res.status(500).json({
                error: profilesError.message
            });

        }


        /* ==================================================
           GET POSTS
        ================================================== */

        const {
            data: posts,
            error: postsError
        } = await supabase
            .from("posts")
            .select("user_id");


        if (postsError) {

            console.error(
                "LEADERBOARD POSTS ERROR:",
                postsError
            );

            return res.status(500).json({
                error: postsError.message
            });

        }


        /* ==================================================
           COUNT POSTS
        ================================================== */

        const postCounts = {};


        for (const post of posts || []) {

            if (!post.user_id) {
                continue;
            }

            postCounts[post.user_id] =
                (postCounts[post.user_id] || 0) + 1;

        }


        /* ==================================================
           GET COMMENTS
        ================================================== */

        const {
            data: comments,
            error: commentsError
        } = await supabase
            .from("comments")
            .select("user_id");


        if (commentsError) {

            console.error(
                "LEADERBOARD COMMENTS ERROR:",
                commentsError
            );

            return res.status(500).json({
                error: commentsError.message
            });

        }


        /* ==================================================
           COUNT COMMENTS
        ================================================== */

        const commentCounts = {};


        for (const comment of comments || []) {

            if (!comment.user_id) {
                continue;
            }

            commentCounts[comment.user_id] =
                (commentCounts[comment.user_id] || 0) + 1;

        }


        /* ==================================================
           GET REACTIONS
        ================================================== */

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

            console.error(
                "LEADERBOARD REACTIONS ERROR:",
                reactionsError
            );

            return res.status(500).json({
                error: reactionsError.message
            });

        }


        /* ==================================================
           COUNT REACTIONS PER USER
        ================================================== */

        const reactionCounts = {};


        for (const reaction of reactions || []) {

            const userId =
                reaction.to_user_id;

            const reactionType =
                reaction.type;


            if (!userId) {
                continue;
            }


            if (!reactionCounts[userId]) {

                reactionCounts[userId] = {

                    cat: 0,

                    gyatt: 0,

                    ogred: 0

                };

            }


            if (
                reactionType === "cat" ||
                reactionType === "gyatt" ||
                reactionType === "ogred"
            ) {

                reactionCounts[userId][reactionType]++;

            }

        }


        /* ==================================================
           BUILD USERS
        ================================================== */

        let users =
            (profiles || []).map(profile => {

                const userId =
                    profile.id;


                const postsCount =
                    postCounts[userId] || 0;


                const commentsCount =
                    commentCounts[userId] || 0;


                const reactionsForUser =
                    reactionCounts[userId] || {

                        cat: 0,

                        gyatt: 0,

                        ogred: 0

                    };


                const cat =
                    reactionsForUser.cat;


                const gyatt =
                    reactionsForUser.gyatt;


                const ogred =
                    reactionsForUser.ogred;


                /* ==========================================
                   OVERALL SCORE
                   
                   Posts     = 5 points
                   Comments  = 2 points
                   Reactions = 1 point
                   ========================================== */

                const score =
                    (
                        postsCount * 5
                    ) +
                    (
                        commentsCount * 2
                    ) +
                    cat +
                    gyatt +
                    ogred;


                let leaderboardScore;


                switch (type) {

                    case "posts":

                        leaderboardScore =
                            postsCount;

                        break;


                    case "comments":

                        leaderboardScore =
                            commentsCount;

                        break;


                    case "cat":

                        leaderboardScore =
                            cat;

                        break;


                    case "gyatt":

                        leaderboardScore =
                            gyatt;

                        break;


                    case "ogred":

                        leaderboardScore =
                            ogred;

                        break;


                    case "overall":

                    default:

                        leaderboardScore =
                            score;

                        break;

                }


                return {

                    id:
                        profile.id,

                    username:
                        profile.username,

                    display_name:
                        profile.display_name,

                    avatar:
                        profile.avatar,

                    posts:
                        postsCount,

                    comments:
                        commentsCount,

                    cat:
                        cat,

                    gyatt:
                        gyatt,

                    ogred:
                        ogred,

                    score:
                        score,

                    leaderboardScore:
                        leaderboardScore

                };

            });


        /* ==================================================
           SORT BY SCORE
        ================================================== */

        users.sort(
            (a, b) => {

                if (
                    b.leaderboardScore !==
                    a.leaderboardScore
                ) {

                    return (
                        b.leaderboardScore -
                        a.leaderboardScore
                    );

                }


                /*
                 * Deterministic ordering for tied users.
                 *
                 * THIS DOES NOT AFFECT THEIR RANK.
                 */

                return String(a.id)
                    .localeCompare(
                        String(b.id)
                    );

            }
        );


        /* ==================================================
           TIE-AWARE RANKING
           
           Example:
           
           1 = 100
           2 = 80
           2 = 80
           4 = 50
           5 = 20
           5 = 20
           5 = 20
           8 = 10
        ================================================== */

        let previousScore = null;

        let previousRank = 0;


        users.forEach(
            (user, index) => {

                const score =
                    user.leaderboardScore;


                if (
                    previousScore !== null &&
                    score === previousScore
                ) {

                    user.rank =
                        previousRank;

                }

                else {

                    user.rank =
                        index + 1;

                    previousRank =
                        user.rank;

                    previousScore =
                        score;

                }

            }
        );


        /* ==================================================
           TOP 5
        ================================================== */

        const topFive =
            users.slice(0, 5);


        /* ==================================================
           CURRENT LOGGED-IN USER
        ================================================== */

        let currentUser = null;


        const currentUserId =
            req.session?.user?.id;


        if (currentUserId) {

            const foundUser =
                users.find(
                    user =>
                        String(user.id) ===
                        String(currentUserId)
                );


            if (foundUser) {

                currentUser = {

                    id:
                        foundUser.id,

                    username:
                        foundUser.username,

                    display_name:
                        foundUser.display_name,

                    avatar:
                        foundUser.avatar,

                    posts:
                        foundUser.posts,

                    comments:
                        foundUser.comments,

                    cat:
                        foundUser.cat,

                    gyatt:
                        foundUser.gyatt,

                    ogred:
                        foundUser.ogred,

                    score:
                        foundUser.score,

                    leaderboardScore:
                        foundUser.leaderboardScore,

                    rank:
                        foundUser.rank

                };

            }

        }


        /* ==================================================
           RETURN
        ================================================== */

        return res.json({

            leaderboard:
                topFive,

            currentUser:
                currentUser,

            totalUsers:
                users.length

        });


    } catch (error) {

        console.error(
            "LEADERBOARD ERROR:",
            error
        );


        return res.status(500).json({

            error:
                "Could not load leaderboard."

        });

    }

});
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
                    postId,
                    user_id,
                    content,
                    image_url,
                    created_at
                `)
                .eq(
                    "postId",
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
    upload.single("image"),
    async (req, res) => {

        try {

            // ==========================================
            // CHECK LOGIN
            // ==========================================

            if (!req.session?.user) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }


            const userId =
                req.session.user.id;

            const postId =
                req.params.postId;


            // ==========================================
            // GET CONTENT
            // ==========================================

            const content =
                String(
                    req.body?.content ||
                    ""
                ).trim();


            if (content.length > 500) {

                return res.status(400).json({
                    error:
                        "Comment is too long."
                });

            }


            // ==========================================
            // FILE
            // ==========================================

            const file =
                req.file || null;


            let imageUrl =
                null;



            // ==========================================
            // UPLOAD IMAGE / VIDEO
            // ==========================================

            if (file) {

                try {
                    const extension =
                        file.originalname
                            .split(".")
                            .pop()
                            .toLowerCase();

                    const allowed = [
                        "png",
                        "jpg",
                        "jpeg",
                        "webp",
                        "gif",
                        "mp4",
                        "webm",
                        "mov"
                    ];

                    if (!allowed.includes(extension)) {
                        return res.status(400).json({
                            error: "Unsupported file type."
                        });
                    }

                    const isVideo = file.mimetype.startsWith("video/");

                    const maxSize =
                        isVideo
                            ? 50 * 1024 * 1024
                            : 5 * 1024 * 1024;

                    if (file.size > maxSize) {
                        return res.status(400).json({
                            error: isVideo
                                ? "Video must be under 50MB."
                                : "Image must be under 5MB."
                        });
                    }

                    const filePath =
                        `comments/${userId}/${Date.now()}-${Math.random()
                            .toString(36)
                            .slice(2)}.${extension}`;

                    const {
                        error: uploadError
                    } = await supabase.storage
                        .from("avatars")
                        .upload(filePath, file.buffer, {
                            contentType: file.mimetype,
                            upsert: false
                        });

                    if (uploadError) {
                        console.error(
                            "COMMENT FILE UPLOAD ERROR:",
                            uploadError
                        );

                        return res.status(500).json({
                            error: uploadError.message
                        });
                    }

                    const {
                        data: publicData
                    } = supabase.storage
                        .from("avatars")
                        .getPublicUrl(filePath);

                    imageUrl = publicData.publicUrl;

                } catch (error) {
                    console.error("COMMENT FILE ERROR:", error);

                    return res.status(500).json({
                        error: "Failed to upload comment media."
                    });
                }
            }


            // ==========================================
            // CHECK EMPTY COMMENT
            // ==========================================

            if (
                !content &&
                !imageUrl
            ) {

                return res.status(400).json({
                    error:
                        "Comment cannot be empty."
                });

            }


            // ==========================================
            // CREATE COMMENT
            // ==========================================

            const {
                data,
                error
            } =
                await supabase
                    .from("comments")
                    .insert({

                        postId:

                            req.params.postId,

                            postId,


                        user_id:
                            userId,

                        content:
                            content,

                        content,


                        image_url:
                            imageUrl

                    })
                    .select()
                    .single();


            if (error) {

                console.error(
                    "COMMENT INSERT ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            // ==========================================
            // FIRST COMMENT OF THE DAY
            // ==========================================

            const todayUTC =
                new Date()
                    .toISOString()
                    .slice(
                        0,
                        10
                    );


            const {

                data:
                    profile,
                error:
                    profileError

            } =
                await supabase
                    .from("profiles")
                    .select(
                        "last_comment_reward_date"
                    )
                    .eq(
                        "id",
                        userId
                    )
                    .single();


            if (profileError) {

                console.error(
                    "COMMENT REWARD PROFILE ERROR:",
                    profileError
                );

            } else {


                // ======================================
                // FIRST COMMENT OF UTC DAY
                // ======================================


                if (
                    profile.last_comment_reward_date !==
                    todayUTC
                ) {

                    const {

                        error:
                            coinError

                    } =
                        await supabase.rpc(
                            "increment_shrekcoins",
                            {

                                user_id:
                                    userId,

                                amount:
                                    5

                            }
                        );


                    if (coinError) {

                        console.error(
                            "COMMENT SHREKCOIN ERROR:",
                            coinError
                        );

                    } else {

                        // ==================================
                        // MARK REWARD AS CLAIMED
                        // ==================================

                        const {
                            error: dateError
                        } = await supabase
                            .from("profiles")
                            .update({
                                last_comment_reward_date:
                                    todayUTC
                            })
                            .eq(
                                "id",
                                userId
                            );

                        if (dateError) {

                            console.error(
                                "COMMENT REWARD DATE ERROR:",
                                dateError
                            );

                        }

                    }

                }

            }


            // ==========================================
            // SUCCESS
            // ==========================================

            return res.status(201).json({
                ...data
            });


        } catch (error) {

            console.error(
                "COMMENT ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    error.message ||
                    "Server error."
            });

        }

    }
);

app.post("/api/shop/sell", async (req, res) => {

    try {

        // Must be logged in
        if (!req.session.user) {
            return res.status(401).json({
                error: "You must be logged in."
            });
        }

        const sellerId = req.session.user.id;

        const itemId = Number(req.body.item_id);
        const price = Number(req.body.price);

        // Validate item ID
        if (
            !Number.isInteger(itemId) ||
            itemId <= 0
        ) {
            return res.status(400).json({
                error: "Invalid item ID."
            });
        }

        // Validate price
        if (
            !Number.isInteger(price) ||
            price <= 0
        ) {
            return res.status(400).json({
                error: "Price must be a positive whole number."
            });
        }

        /*
         * Make sure the seller actually owns this item.
         */

        const {
            data: ownership,
            error: ownershipError
        } = await supabase
            .from("user_shop_items")
            .select("user_id, item_id")
            .eq("user_id", sellerId)
            .eq("item_id", itemId)
            .maybeSingle();

        if (ownershipError) {

            console.error(
                "SELL OWNERSHIP ERROR:",
                ownershipError
            );

            return res.status(500).json({
                error: "Failed to check item ownership."
            });
        }

        if (!ownership) {

            return res.status(403).json({
                error: "You do not own this item."
            });
        }


        /*
         * Make sure it isn't already listed.
         */

        const {
            data: existingListing,
            error: listingCheckError
        } = await supabase
            .from("marketplace_listings")
            .select("id")
            .eq("item_id", itemId)
            .eq("seller_id", sellerId)
            .maybeSingle();

        if (listingCheckError) {

            console.error(
                "SELL LISTING CHECK ERROR:",
                listingCheckError
            );

            return res.status(500).json({
                error: "Failed to check marketplace listing."
            });
        }

        if (existingListing) {

            return res.status(400).json({
                error: "This item is already listed for sale."
            });
        }


        /*
         * Create marketplace listing.
         *
         * IMPORTANT:
         * We do NOT insert into shop_items.
         */

        const {
            data: listing,
            error: insertError
        } = await supabase
            .from("marketplace_listings")
            .insert({
                item_id: itemId,
                seller_id: sellerId,
                price: price
            })
            .select()
            .single();

        if (insertError) {

            console.error(
                "SELL LISTING INSERT ERROR:",
                insertError
            );

            return res.status(500).json({
                error: "Failed to create marketplace listing."
            });
        }


        res.json({

            success: true,

            listing: {
                id: listing.id,
                item_id: listing.item_id,
                seller_id: listing.seller_id,
                price: listing.price,
                created_at: listing.created_at
            }

        });

    } catch (error) {

        console.error(
            "SELL SERVER ERROR:",
            error
        );

        res.status(500).json({
            error: "Internal server error."
        });

    }

});
// ==================================================
// BUY SHOP ITEM
// ==================================================

app.post(
    "/api/shop/buy",
    async (req, res) => {

        try {

            // ==========================================
            // CHECK LOGIN
            // ==========================================

            if (
                !req.session ||
                !req.session.user ||
                !req.session.user.id
            ) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }


            const userId =
                req.session.user.id;


            // ==========================================
            // GET ITEM ID
            // ==========================================

            const itemId =
                req.body &&
                req.body.item_id;


            if (
                itemId === undefined ||
                itemId === null ||
                itemId === ""
            ) {

                return res.status(400).json({
                    error:
                        "A valid item ID is required."
                });

            }


            const numericItemId =
                Number(itemId);


            if (
                !Number.isInteger(numericItemId) ||
                numericItemId <= 0
            ) {

                return res.status(400).json({
                    error:
                        "Invalid item ID."
                });

            }


            // ==========================================
            // PURCHASE
            // ==========================================

            const {
                data,
                error
            } =
                await supabase.rpc(
                    "buy_shop_item",
                    {
                        p_user_id:
                            userId,

                        p_item_id:
                            numericItemId
                    }
                );


            // ==========================================
            // DATABASE ERROR
            // ==========================================

            if (error) {

                console.error(
                    "SHOP PURCHASE ERROR:",
                    error
                );


                const message =
                    error.message ||
                    "Purchase failed.";


                // Not enough coins

                if (
                    message.toLowerCase()
                        .includes(
                            "not enough"
                        )
                ) {

                    return res.status(400).json({
                        error:
                            "You don't have enough ShrekCoins."
                    });

                }


                // Already owns item

                if (
                    message.toLowerCase()
                        .includes(
                            "already own"
                        )
                ) {

                    return res.status(400).json({
                        error:
                            "You already own this item."
                    });

                }


                // Item doesn't exist

                if (
                    message.toLowerCase()
                        .includes(
                            "not found"
                        ) ||
                    message.toLowerCase()
                        .includes(
                            "unavailable"
                        )
                ) {

                    return res.status(404).json({
                        error:
                            "That item is unavailable."
                    });

                }


                return res.status(500).json({
                    error:
                        "Purchase failed."
                });

            }


            // ==========================================
            // GET NEW COIN BALANCE
            // ==========================================

            const {
                data: profile,
                error: profileError
            } =
                await supabase
                    .from("profiles")
                    .select("shrekcoins")
                    .eq(
                        "id",
                        userId
                    )
                    .single();


            if (profileError) {

                console.error(
                    "COIN BALANCE ERROR:",
                    profileError
                );

            }


            // ==========================================
            // SUCCESS
            // ==========================================

            return res.json({

                success:
                    true,

                purchase:
                    data,

                shrekcoins:
                    profile
                        ? profile.shrekcoins
                        : null

            });


        } catch (error) {

            console.error(
                "SHOP BUY ERROR:",
                error
            );


            return res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);
// ==================================================
// SHOP INVENTORY
// ==================================================


// ==================================================
// SHOP INVENTORY
// ==================================================

// ==================================================
// SHOP INVENTORY
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


            // ==========================================
            // GET PROFILE
            // ==========================================

            const {
                data: profile,
                error: profileError
            } =
                await supabase
                    .from("profiles")
                    .select(`
                        id,
                        username,
                        display_name,
                        avatar,
                        bio,
                        created_at,
                        equipped_title_id
                    `)
                    .eq(
                        "id",
                        id
                    )
                    .maybeSingle();


            if (profileError) {

                console.error(
                    "PROFILE ERROR:",
                    profileError
                );

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


            // ==========================================
            // GET EQUIPPED TITLE
            // ==========================================

            let equippedTitle =
                null;


            if (
                profile.equipped_title_id
            ) {

                const {
                    data: title,
                    error: titleError
                } =
                    await supabase
                        .from("shop_items")
                        .select(`
                            id,
                            name,
                            description,
                            price,
                            icon,
                            item_type
                        `)
                        .eq(
                            "id",
                            profile.equipped_title_id
                        )
                        .eq(
                            "item_type",
                            "title"
                        )
                        .maybeSingle();


                if (titleError) {

                    console.error(
                        "EQUIPPED TITLE ERROR:",
                        titleError
                    );

                } else {

                    equippedTitle =
                        title || null;

                }

            }


            // ==========================================
            // GET ALL DISPLAYED ITEMS
            // ==========================================

            let displayedItems = [];


            const {
                data: ownedItems,
                error: ownedError
            } =
                await supabase
                    .from("user_shop_items")
                    .select(`
                        purchased_at,
                        equipped,
                        shop_items (
                            id,
                            name,
                            description,
                            icon,
                            price,
                            item_type
                        )
                    `)
                    .eq(
                        "user_id",
                        id
                    );


            if (ownedError) {

                console.error(
                    "DISPLAYED ITEMS ERROR:",
                    ownedError
                );

            } else {

                // ======================================
                // ONLY DISPLAY NORMAL EQUIPPED ITEMS
                // TITLES ARE HANDLED SEPARATELY
                // ======================================

                displayedItems =
                    (ownedItems || [])
                        .filter(
                            row =>
                                row.shop_items &&
                                row.shop_items.item_type !== "title" &&
                                row.equipped === true
                        )
                        .map(
                            row => ({

                                id:
                                    row.shop_items.id,

                                name:
                                    row.shop_items.name,

                                description:
                                    row.shop_items.description,

                                icon:
                                    row.shop_items.icon,

                                price:
                                    row.shop_items.price,

                                item_type:
                                    row.shop_items.item_type,

                                purchased_at:
                                    row.purchased_at,

                                equipped:
                                    true

                            })
                        );

            }


            // ==========================================
            // LIMIT DISPLAYED ITEMS
            // ==========================================

            displayedItems =
                displayedItems.slice(
                    0,
                    5
                );


            console.log(
                "PROFILE DISPLAYED ITEMS:",
                id,
                displayedItems
            );


            // ==========================================
            // GET POSTS
            // ==========================================

            const {
                data: posts,
                error: postsError
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


            // ==========================================
            // REACTIONS
            // ==========================================

            const reactions =
                await getReactionCounts(
                    id
                );


            // ==========================================
            // RESPONSE
            // ==========================================

            return res.json({

                ...profile,

                avatar:
                    getAvatar(
                        profile.avatar
                    ),

                equippedTitle:
                    equippedTitle,

                displayedItems:
                    displayedItems,

                displayedCount:
                    displayedItems.length,

                maxDisplayed:
                    5,

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

            return res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);
// ==================================================
// EQUIP SHOP TITLE
// ==================================================

// ==================================================
// EQUIP / DISPLAY SHOP ITEM
// ==================================================


// ==================================================
// EQUIP SHOP ITEM
// ==================================================

app.post(
    "/api/shop/equip",
    async (req, res) => {

        try {

            // ==========================================
            // CHECK LOGIN
            // ==========================================

            if (
                !req.session ||
                !req.session.user ||
                !req.session.user.id
            ) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }


            const userId =
                req.session.user.id;


            // ==========================================
            // GET ITEM ID
            // ==========================================

            const itemId =
                req.body &&
                req.body.item_id;


            const numericItemId =
                Number(itemId);


            if (
                !Number.isInteger(
                    numericItemId
                ) ||
                numericItemId <= 0
            ) {

                return res.status(400).json({
                    error:
                        "A valid item ID is required."
                });

            }


            // ==========================================
            // CHECK OWNERSHIP
            // ==========================================

            const {
                data: ownership,
                error: ownershipError
            } =
                await supabase
                    .from("user_shop_items")
                    .select(`
                        user_id,
                        item_id,
                        equipped
                    `)
                    .eq(
                        "user_id",
                        userId
                    )
                    .eq(
                        "item_id",
                        numericItemId
                    )
                    .maybeSingle();


            if (ownershipError) {

                console.error(
                    "OWNERSHIP CHECK ERROR:",
                    ownershipError
                );

                return res.status(500).json({
                    error:
                        ownershipError.message
                });

            }


            if (!ownership) {

                return res.status(403).json({
                    error:
                        "You do not own this item."
                });

            }


            // ==========================================
            // GET SHOP ITEM
            // ==========================================

            const {
                data: item,
                error: itemError
            } =
                await supabase
                    .from("shop_items")
                    .select(`
                        id,
                        name,
                        description,
                        icon,
                        price,
                        item_type
                    `)
                    .eq(
                        "id",
                        numericItemId
                    )
                    .maybeSingle();


            if (itemError) {

                console.error(
                    "SHOP ITEM ERROR:",
                    itemError
                );

                return res.status(500).json({
                    error:
                        itemError.message
                });

            }


            if (!item) {

                return res.status(404).json({
                    error:
                        "Shop item not found."
                });

            }


            // ==========================================
            // AVATAR
            // ==========================================

            if (
                item.item_type ===
                "avatar"
            ) {

                return res.status(400).json({
                    error:
                        "Avatars cannot be equipped. Download the .SB avatar instead."
                });

            }



            // ==========================================
            // TITLE
            // ==========================================

            if (
                item.item_type ===
                "title"
            ) {

                const {
                    error: updateError
                } =
                    await supabase
                        .from("profiles")
                        .update({

                            equipped_title_id:
                                numericItemId

                        })
                        .eq(
                            "id",
                            userId
                        );


                if (updateError) {

                    console.error(
                        "EQUIP TITLE ERROR:",
                        updateError
                    );

                    return res.status(500).json({
                        error:
                            "Could not equip title."
                    });

                }


                return res.json({

                    success:
                        true,

                    type:
                        "title",

                    equipped:
                        item

                });

            }


            // ==========================================
            // CHECK IF ALREADY EQUIPPED
            // ==========================================

            if (
                ownership.equipped
            ) {

                return res.json({

                    success:
                        true,

                    type:
                        "item",

                    alreadyEquipped:
                        true,

                    displayed:
                        item

                });

            }


            // ==========================================
            // COUNT EQUIPPED ITEMS
            // ==========================================

            const {
                count,
                error: countError
            } =
                await supabase
                    .from("user_shop_items")
                    .select(
                        "item_id",
                        {
                            count:
                                "exact",
                            head:
                                true
                        }
                    )
                    .eq(
                        "user_id",
                        userId
                    )
                    .eq(
                        "equipped",
                        true
                    );


            if (countError) {

                console.error(
                    "EQUIPPED COUNT ERROR:",
                    countError
                );

                return res.status(500).json({
                    error:
                        countError.message
                });

            }


            // ==========================================
            // MAXIMUM 5 ITEMS
            // ==========================================

            if (
                (count || 0) >= 5
            ) {

                return res.status(400).json({
                    error:
                        "You can only display 5 items at once."
                });

            }


            // ==========================================
            // EQUIP ITEM
            // ==========================================

            const {
                error: equipError
            } =
                await supabase
                    .from("user_shop_items")
                    .update({

                        equipped:
                            true

                    })
                    .eq(
                        "user_id",
                        userId
                    )
                    .eq(
                        "item_id",
                        numericItemId
                    );


            if (equipError) {

                console.error(
                    "EQUIP ITEM ERROR:",
                    equipError
                );

                return res.status(500).json({
                    error:
                        "Could not display item."
                });

            }


            return res.json({

                success:
                    true,

                type:
                    "item",

                displayed:
                    item

            });


        } catch (error) {

            console.error(
                "SHOP EQUIP ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    "Failed to equip item."
            });

        }

    }
);
// ==================================================
// UNDISPLAY SHOP ITEM
// ==================================================

app.post(
    "/api/shop/undisplay",
    async (req, res) => {

        try {

            // ==========================================
            // CHECK LOGIN
            // ==========================================

            if (
                !req.session ||
                !req.session.user ||
                !req.session.user.id
            ) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }


            const userId =
                req.session.user.id;


            // ==========================================
            // GET ITEM ID
            // ==========================================

            const itemId =
                req.body &&
                req.body.item_id;


            const numericItemId =
                Number(itemId);


            if (
                !Number.isInteger(
                    numericItemId
                ) ||
                numericItemId <= 0
            ) {

                return res.status(400).json({
                    error:
                        "A valid item ID is required."
                });

            }


            // ==========================================
            // CHECK OWNERSHIP
            // ==========================================

            const {
                data: ownership,
                error: ownershipError
            } =
                await supabase
                    .from("user_shop_items")
                    .select(
                        "item_id, equipped"
                    )
                    .eq(
                        "user_id",
                        userId
                    )
                    .eq(
                        "item_id",
                        numericItemId
                    )
                    .maybeSingle();


            if (ownershipError) {

                console.error(
                    "UNDISPLAY OWNERSHIP ERROR:",
                    ownershipError
                );

                return res.status(500).json({
                    error:
                        ownershipError.message
                });

            }


            if (!ownership) {

                return res.status(403).json({
                    error:
                        "You do not own this item."
                });

            }


            // ==========================================
            // UNDISPLAY
            // ==========================================

            const {
                error: updateError
            } =
                await supabase
                    .from("user_shop_items")
                    .update({

                        equipped:
                            false

                    })
                    .eq(
                        "user_id",
                        userId
                    )
                    .eq(
                        "item_id",
                        numericItemId
                    );


            if (updateError) {

                console.error(
                    "UNDISPLAY ITEM ERROR:",
                    updateError
                );

                return res.status(500).json({
                    error:
                        "Could not undisplay item."
                });

            }


            return res.json({

                success:
                    true

            });


        } catch (error) {

            console.error(
                "UNDISPLAY ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    "Failed to undisplay item."
            });

        }

    }
);
// ==================================================
// UNEQUIP / HIDE SHOP ITEM
// ==================================================

app.post(
    "/api/shop/unequip",
    async (req, res) => {

        try {

            if (
                !req.session ||
                !req.session.user ||
                !req.session.user.id
            ) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }


            const userId =
                req.session.user.id;


            const itemId =
                req.body &&
                req.body.item_id;


            // ==========================================
            // IF NO ITEM ID → UNEQUIP TITLE
            // ==========================================

            if (
                itemId === undefined ||
                itemId === null
            ) {

                const {
                    error
                } =
                    await supabase
                        .from("profiles")
                        .update({

                            equipped_title_id:
                                null

                        })
                        .eq(
                            "id",
                            userId
                        );


                if (error) {

                    return res.status(500).json({
                        error:
                            error.message
                    });

                }


                return res.json({
                    success:
                        true
                });

            }


            const numericItemId =
                Number(itemId);


            if (
                !Number.isInteger(
                    numericItemId
                )
            ) {

                return res.status(400).json({
                    error:
                        "Invalid item ID."
                });

            }


            // ==========================================
            // CHECK ITEM TYPE
            // ==========================================

            const {
                data: item,
                error: itemError
            } =
                await supabase
                    .from("shop_items")
                    .select(
                        "id, item_type"
                    )
                    .eq(
                        "id",
                        numericItemId
                    )
                    .maybeSingle();


            if (itemError || !item) {

                return res.status(404).json({
                    error:
                        "Shop item not found."
                });

            }


            // ==========================================
            // HIDE NORMAL ITEM
            // ==========================================

            if (
                item.item_type !==
                "title"
            ) {

                const {
                    error
                } =
                    await supabase
                        .from("profiles")
                        .update({

                            displayed_item_id:
                                null

                        })
                        .eq(
                            "id",
                            userId
                        );


                if (error) {

                    return res.status(500).json({
                        error:
                            error.message
                    });

                }


                return res.json({
                    success:
                        true
                });

            }


            // ==========================================
            // UNEQUIP TITLE
            // ==========================================

            const {
                error
            } =
                await supabase
                    .from("profiles")
                    .update({

                        equipped_title_id:
                            null

                    })
                    .eq(
                        "id",
                        userId
                    );


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            return res.json({
                success:
                    true
            });


        } catch (error) {

            console.error(
                "UNEQUIP/HIDE ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    "Failed to unequip or hide item."
            });

        }

    }
);
// ==================================================
// GET SHOP ITEMS
// ==================================================
app.get("/api/shop/items", async (req, res) => {
    try {
        const {
            data: items,
            error
        } = await supabase
            .from("shop_items")
            .select("*")
            .order("id", {
                ascending: true
            });

        if (error) {
            console.error("SHOP ITEMS ERROR:", error);

            return res.status(500).json({
                error: "Failed to load shop items."
            });
        }

        const currentUserId =
            req.session?.user?.id || null;

        const formattedItems = (items || []).map(item => ({
            ...item,

            owned:
                currentUserId !== null &&
                item.user_id === currentUserId
        }));

        return res.json({
            success: true,
            items: formattedItems
        });

    } catch (error) {
        console.error("SHOP ITEMS ERROR:", error);

        return res.status(500).json({
            error: "Server error."
        });
    }
});
app.post(
    "/api/shop/items",
    async (req, res) => {

        try {

            // ==========================================
            // CHECK LOGIN
            // ==========================================

            if (
                !req.session ||
                !req.session.user
            ) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }


            const userId =
                req.session.user.id;


            // ==========================================
            // GET DATA
            // ==========================================

            const name =
                String(
                    req.body.name ||
                    ""
                ).trim();

            const description =
                String(
                    req.body.description ||
                    ""
                ).trim();

            const itemType =
                String(
                    req.body.item_type ||
                    ""
                ).trim();

            const price =
                Number(
                    req.body.price
                );

            const icon =
                String(
                    req.body.icon ||
                    "🧌"
                ).trim();

            const file =
                req.body.file;


            // ==========================================
            // VALIDATION
            // ==========================================

            if (!name) {

                return res.status(400).json({
                    error:
                        "Item name is required."
                });

            }


            if (name.length > 100) {

                return res.status(400).json({
                    error:
                        "Item name must be 100 characters or less."
                });

            }


            if (description.length > 1000) {

                return res.status(400).json({
                    error:
                        "Description must be 1000 characters or less."
                });

            }


            if (itemType !== "avatar") {

                return res.status(400).json({
                    error:
                        "Invalid item type."
                });

            }


            if (
                !Number.isInteger(price) ||
                price < 1 ||
                price > 1000000000
            ) {

                return res.status(400).json({
                    error:
                        "Invalid ShrekCoin price."
                });

            }


            if (!file) {

                return res.status(400).json({
                    error:
                        "No .sb file was provided."
                });

            }


            if (
                !file.name ||
                !file.name
                    .toLowerCase()
                    .endsWith(".sb")
            ) {

                return res.status(400).json({
                    error:
                        "Avatar files must use the .sb extension."
                });

            }


            if (!file.data) {

                return res.status(400).json({
                    error:
                        "Avatar file data is missing."
                });

            }


            // ==========================================
            // DECODE FILE
            // ==========================================

            let fileBuffer;

            try {

                fileBuffer =
                    Buffer.from(
                        file.data,
                        "base64"
                    );

            } catch (error) {

                return res.status(400).json({
                    error:
                        "Invalid .sb file."
                });

            }


            if (!fileBuffer.length) {

                return res.status(400).json({
                    error:
                        "The .sb file is empty."
                });

            }


            // ==========================================
            // FILE SIZE
            // ==========================================

            const maxSize =
                20 * 1024 * 1024;


            if (
                fileBuffer.length >
                maxSize
            ) {

                return res.status(400).json({
                    error:
                        "The .sb file must be under 20MB."
                });

            }


            // ==========================================
            // SAFE FILE NAME
            // ==========================================

            const safeName =
                file.name
                    .replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    );


            const storagePath =
                `shop/${userId}/${Date.now()}-${safeName}`;


            // ==========================================
            // UPLOAD TO SUPABASE STORAGE
            // ==========================================

            const {
                error: uploadError
            } =
                await supabase.storage
                    .from("avatars")
                    .upload(
                        storagePath,
                        fileBuffer,
                        {

                            contentType:
                                "application/octet-stream",

                            upsert:
                                false

                        }
                    );


            if (uploadError) {

                console.error(
                    "SHOP FILE UPLOAD ERROR:",
                    uploadError
                );

                return res.status(500).json({
                    error:
                        "Could not upload the .sb file."
                });

            }


            // ==========================================
            // GET PUBLIC URL
            // ==========================================

            const {
                data: publicData
            } =
                supabase.storage
                    .from("avatars")
                    .getPublicUrl(
                        storagePath
                    );


            const fileUrl =
                publicData?.publicUrl;


            if (!fileUrl) {

                await supabase.storage
                    .from("avatars")
                    .remove([
                        storagePath
                    ]);

                return res.status(500).json({
                    error:
                        "Could not create the file URL."
                });

            }


            // ==========================================
            // CREATE SHOP ITEM
            // ==========================================

            const {
                data: item,
                error: itemError
            } =
                await supabase
                    .from("shop_items")
                    .insert({

                        name:
                            name,

                        description:
                            description,

                        item_type:
                            "avatar",

                        item_value:
                            fileUrl,

                        price:
                            price,

                        icon:
                            icon

                    })
                    .select()
                    .single();


            // ==========================================
            // DATABASE ERROR
            // ==========================================

            if (itemError) {

                console.error(
                    "SHOP ITEM INSERT ERROR:",
                    itemError
                );


                await supabase.storage
                    .from("avatars")
                    .remove([
                        storagePath
                    ]);


                return res.status(500).json({
                    error:
                        itemError.message
                });

            }


            // ==========================================
            // CREATE MARKETPLACE LISTING
            // ==========================================

            const {
                data: listing,
                error: listingError
            } =
                await supabase
                    .from("marketplace_listings")
                    .insert({

                        item_id:
                            item.id,

                        seller_id:
                            userId,

                        price:
                            price

                    })
                    .select()
                    .single();


            // ==========================================
            // MARKETPLACE ERROR
            // ==========================================

            if (listingError) {

                console.error(
                    "MARKETPLACE LISTING ERROR:",
                    listingError
                );


                // Delete the shop item

                await supabase
                    .from("shop_items")
                    .delete()
                    .eq(
                        "id",
                        item.id
                    );


                // Delete uploaded file

                await supabase.storage
                    .from("avatars")
                    .remove([
                        storagePath
                    ]);


                return res.status(500).json({
                    error:
                        "Avatar was created, but the marketplace listing could not be created."
                });

            }


            // ==========================================
            // GIVE CREATOR OWNERSHIP
            // ==========================================

            const {
                error: ownershipError
            } =
                await supabase
                    .from("user_shop_items")
                    .insert({

                        user_id:
                            userId,

                        item_id:
                            item.id

                    });


            // ==========================================
            // OWNERSHIP ERROR
            // ==========================================

            if (ownershipError) {

                console.error(
                    "SVIS OWNERSHIP ERROR:",
                    ownershipError
                );


                // Roll everything back

                await supabase
                    .from("marketplace_listings")
                    .delete()
                    .eq(
                        "id",
                        listing.id
                    );


                await supabase
                    .from("shop_items")
                    .delete()
                    .eq(
                        "id",
                        item.id
                    );


                await supabase.storage
                    .from("avatars")
                    .remove([
                        storagePath
                    ]);


                return res.status(500).json({
                    error:
                        "Avatar was created, but ownership could not be assigned."
                });

            }


            // ==========================================
            // SUCCESS
            // ==========================================

            return res.status(201).json({

                success:
                    true,

                message:
                    "Avatar published successfully and listed for sale.",

                item:
                    item,

                listing:
                    listing

            });


        } catch (error) {

            console.error(
                "SHOP PUBLISH ERROR:",
                error
            );


            return res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);
// ==================================================
// GET MY SHOP ITEMS
// ==================================================

app.get(
    "/api/shop/my-items",
    async (req, res) => {

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


            const userId =
                req.session.user.id;


            const {
                data,
                error
            } =
                await supabase
                    .from("user_items")
                    .select(`
                        id,
                        purchased_at,
                        item:shop_items (
                            id,
                            name,
                            description,
                            item_type,
                            price,
                            item_value
                        )
                    `)
                    .eq(
                        "user_id",
                        userId
                    )
                    .order(
                        "purchased_at",
                        {
                            ascending: false
                        }
                    );


            if (error) {

                console.error(
                    "MY ITEMS ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        "Failed to load your items."
                });

            }


            return res.json({
                items:
                    data || []
            });


        } catch (error) {

            console.error(
                "MY ITEMS ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);
// ==================================================
// REACTIONS
// ==================================================

// ==================================================
// ADD REACTION + SHREKCOIN REWARD
// ==================================================

async function addReaction(
    req,
    res,
    type
) {

    try {

        // ==========================================
        // CHECK LOGIN
        // ==========================================

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


        // ==========================================
        // PREVENT SELF REACTION
        // ==========================================

        if (
            fromUserId ===
            toUserId
        ) {

            return res.status(400).json({
                error:
                    "You cannot react to yourself."
            });

        }


        // ==========================================
        // VALIDATE REACTION TYPE
        // ==========================================

        const validTypes = [
            "gyatt",
            "cat",
            "ogred"
        ];


        if (
            !validTypes.includes(type)
        ) {

            return res.status(400).json({
                error:
                    "Invalid reaction type."
            });

        }


        // ==========================================
        // CHECK TARGET USER
        // ==========================================

        const {
            data: targetUser,
            error: targetError
        } = await supabase
            .from("profiles")
            .select(
                "id, shrekcoins"
            )
            .eq(
                "id",
                toUserId
            )
            .maybeSingle();


        if (targetError) {

            console.error(
                "TARGET USER ERROR:",
                targetError
            );

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


        // ==========================================
        // CREATE REACTION
        // ==========================================

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


        // ==========================================
        // DUPLICATE REACTION
        // ==========================================

        if (insertError) {

            if (
                insertError.code ===
                "23505"
            ) {

                const names = {

                    gyatt:
                        "Gyatt",

                    cat:
                        "Cat",

                    ogred:
                        "Ogred"

                };


                return res.status(400).json({

                    error:
                        `You already gave this person a ${names[type]}.`

                });

            }


            console.error(
                "REACTION INSERT ERROR:",
                insertError
            );


            return res.status(500).json({
                error:
                    insertError.message
            });

        }


        // ==========================================
        // GIVE TARGET USER +1 SHREKCOIN
        // ==========================================

        const {
            error: coinError
        } = await supabase.rpc(
            "increment_shrekcoins",
            {
                user_id:
                    toUserId,

                amount:
                    1
            }
        );


        if (coinError) {

            console.error(
                "SHREKCOIN REWARD ERROR:",
                coinError
            );

            // The reaction was already created.
            // Don't undo it here.
            //
            // This means the reaction still works
            // even if the coin reward has a problem.

        }


        // ==========================================
        // GET UPDATED REACTION COUNT
        // ==========================================

        const {
            count,
            error: countError
        } = await supabase
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


        // ==========================================
        // SUCCESS
        // ==========================================

        res.json({

            success:
                true,

            [type]:
                count || 0,

            shrekcoinEarned:
                1

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

// ==================================================
// SHREKBOOK ADMIN SYSTEM
// ==================================================

const ROLE_LEVELS = {
    peasant: 0,
    junior_moderator: 1,
    senior_moderator: 2,
    administrator: 3,
    owner: 4
};

const ADMIN_ROLES = [
    "owner",
    "administrator",
    "senior_moderator",
    "junior_moderator"
];

const VALID_ROLES = [
    "owner",
    "administrator",
    "senior_moderator",
    "junior_moderator",
    "peasant"
];


// ==================================================
// REQUIRE LOGIN
// ==================================================

function requireLogin(req, res, next) {

    if (!req.session?.user?.id) {

        return res.status(401).json({
            error: "Not logged in."
        });

    }

    next();

}


// ==================================================
// GET CURRENT ADMIN
// ==================================================

async function getAdminActor(req) {

    const userId =
        req.session?.user?.id;

    if (!userId) {

        return {
            actor: null,
            error: "Not logged in."
        };

    }


    const {
        data: actor,
        error
    } = await supabase
        .from("profiles")
        .select(
            "id, username, display_name, role, banned, kicked"
        )
        .eq(
            "id",
            userId
        )
        .maybeSingle();


    if (error) {

        console.error(
            "GET ADMIN ACTOR ERROR:",
            error
        );

        return {
            actor: null,
            error: error.message
        };

    }


    if (!actor) {

        return {
            actor: null,
            error: "Profile not found."
        };

    }


    return {
        actor,
        error: null
    };

}


// ==================================================
// REQUIRE ADMIN
// ==================================================

async function requireAdmin(req, res) {

    const {
        actor,
        error
    } = await getAdminActor(req);


    if (!actor) {

        res.status(403).json({
            error:
                error ||
                "Admin access required."
        });

        return null;

    }


    if (actor.banned) {

        res.status(403).json({
            error:
                "Your account is banned."
        });

        return null;

    }


    if (!ADMIN_ROLES.includes(actor.role)) {

        res.status(403).json({
            error:
                "Admin access required."
        });

        return null;

    }


    return actor;

}


// ==================================================
// CAN MANAGE
// ==================================================

function canManageRole(
    actorRole,
    targetRole
) {

    return (
        ROLE_LEVELS[actorRole] >
        ROLE_LEVELS[targetRole]
    );

}


// ==================================================
// ADMIN AUTH
// ==================================================

app.get(
    "/api/admin/auth",
    requireLogin,
    async (req, res) => {

        try {

            const actor =
                await requireAdmin(
                    req,
                    res
                );


            if (!actor) {
                return;
            }


            res.json({
                success: true,
                authorized: true,
                user: actor
            });


        } catch (error) {

            console.error(
                "ADMIN AUTH ERROR:",
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
// ADMIN USER LIST
// ==================================================

app.get(
    "/api/admin/users",
    requireLogin,
    async (req, res) => {

        try {

            const actor =
                await requireAdmin(
                    req,
                    res
                );


            if (!actor) {
                return;
            }


            const {
                data: users,
                error
            } = await supabase
                .from("profiles")
                .select(
                    "id, username, display_name, avatar, role, banned, kicked, shrekcoins"
                )
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


            res.json(
                users || []
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
// CHANGE ROLE
// ==================================================

app.put(
    "/api/admin/users/:id/role",
    requireLogin,
    async (req, res) => {

        try {

            const actor =
                await requireAdmin(
                    req,
                    res
                );


            if (!actor) {
                return;
            }


            const targetId =
                req.params.id;


            const newRole =
                String(
                    req.body?.role || ""
                )
                .trim()
                .toLowerCase();


            if (
                !VALID_ROLES.includes(
                    newRole
                )
            ) {

                return res.status(400).json({
                    error:
                        "Invalid role."
                });

            }


            const {
                data: target,
                error
            } = await supabase
                .from("profiles")
                .select(
                    "id, username, role"
                )
                .eq(
                    "id",
                    targetId
                )
                .maybeSingle();


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            if (!target) {

                return res.status(404).json({
                    error:
                        "User not found."
                });

            }


            if (
                target.id === actor.id
            ) {

                return res.status(403).json({
                    error:
                        "You cannot change your own role."
                });

            }


            if (
                !canManageRole(
                    actor.role,
                    target.role
                )
            ) {

                return res.status(403).json({
                    error:
                        "You cannot manage this user."
                });

            }


            // Only owner can assign owner.

            if (
                newRole === "owner" &&
                actor.role !== "owner"
            ) {

                return res.status(403).json({
                    error:
                        "Only the owner can assign owner."
                });

            }


            // Non-owner cannot assign
            // equal or higher role.

            if (
                actor.role !== "owner" &&
                ROLE_LEVELS[newRole] >=
                ROLE_LEVELS[actor.role]
            ) {

                return res.status(403).json({
                    error:
                        "You cannot assign a role equal to or above your own."
                });

            }


            const {
                error: updateError
            } = await supabase
                .from("profiles")
                .update({
                    role:
                        newRole
                })
                .eq(
                    "id",
                    target.id
                );


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
                `ADMIN: ${actor.username} changed ${target.username} to ${newRole}`
            );


            res.json({
                success: true,
                username:
                    target.username,
                role:
                    newRole
            });


        } catch (error) {

            console.error(
                "ROLE CHANGE ERROR:",
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
// BAN
// ==================================================

app.post(
    "/api/admin/users/:id/ban",
    requireLogin,
    async (req, res) => {

        try {

            const actor =
                await requireAdmin(
                    req,
                    res
                );


            if (!actor) {
                return;
            }


            const {
                data: target,
                error
            } = await supabase
                .from("profiles")
                .select(
                    "id, username, role"
                )
                .eq(
                    "id",
                    req.params.id
                )
                .maybeSingle();


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            if (!target) {

                return res.status(404).json({
                    error:
                        "User not found."
                });

            }


            if (
                target.id === actor.id
            ) {

                return res.status(403).json({
                    error:
                        "You cannot ban yourself."
                });

            }


            if (
                !canManageRole(
                    actor.role,
                    target.role
                )
            ) {

                return res.status(403).json({
                    error:
                        "You cannot ban this user."
                });

            }


            const {
                error: updateError
            } = await supabase
                .from("profiles")
                .update({
                    banned: true,
                    kicked: false
                })
                .eq(
                    "id",
                    target.id
                );


            if (updateError) {

                console.error(
                    "BAN ERROR:",
                    updateError
                );

                return res.status(500).json({
                    error:
                        updateError.message
                });

            }


            console.log(
                `ADMIN: ${actor.username} banned ${target.username}`
            );


            res.json({
                success: true,
                banned: true
            });


        } catch (error) {

            console.error(
                "BAN ROUTE ERROR:",
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
// UNBAN
// ==================================================

app.post(
    "/api/admin/users/:id/unban",
    requireLogin,
    async (req, res) => {

        try {

            // ==========================================
            // ROLES ALLOWED TO UNBAN
            // ==========================================

            const canUnban = [
                "administrator",
                "owner"
            ];


            // ==========================================
            // GET ACTOR
            // ==========================================

            const actor =
                await requireAdmin(
                    req,
                    res
                );


            if (!actor) {
                return;
            }


            // ==========================================
            // CHECK ACTOR PERMISSION
            // ==========================================

            if (
                !canUnban.includes(
                    actor.role
                )
            ) {

                return res.status(403).json({
                    error:
                        "You must be an administrator or higher to ban/unban people."
                });

            }


            // ==========================================
            // GET TARGET USER
            // ==========================================

            const {
                data: target,
                error
            } = await supabase
                .from("profiles")
                .select(
                    "id, username, role, banned"
                )
                .eq(
                    "id",
                    req.params.id
                )
                .maybeSingle();


            if (error) {

                console.error(
                    "UNBAN TARGET ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            // ==========================================
            // USER NOT FOUND
            // ==========================================

            if (!target) {

                return res.status(404).json({
                    error:
                        "User not found."
                });

            }


            // ==========================================
            // PREVENT SELF-UNBAN
            // ==========================================

            if (
                target.id === actor.id
            ) {

                return res.status(403).json({
                    error:
                        "You cannot unban yourself."
                });

            }


            // ==========================================
            // CHECK ROLE MANAGEMENT
            // ==========================================

            if (
                !canManageRole(
                    actor.role,
                    target.role
                )
            ) {

                return res.status(403).json({
                    error:
                        "You cannot unban this user."
                });

            }


            // ==========================================
            // UNBAN USER
            // ==========================================

            const {
                error: updateError
            } = await supabase
                .from("profiles")
                .update({
                    banned: false
                })
                .eq(
                    "id",
                    target.id
                );


            if (updateError) {

                console.error(
                    "UNBAN UPDATE ERROR:",
                    updateError
                );

                return res.status(500).json({
                    error:
                        updateError.message
                });

            }


            // ==========================================
            // SUCCESS
            // ==========================================

            console.log(
                `🔓 ${actor.username} unbanned ${target.username}`
            );


            return res.json({

                success:
                    true,

                banned:
                    false

            });

        } catch (error) {

            console.error(
                "🔥 UNBAN ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    error.message ||
                    "Server error."
            });

        }

    }
);


// ==================================================
// KICK
// ==================================================

app.post(
    "/api/admin/users/:id/kick",
    requireLogin,
    async (req, res) => {

        try {

            const actor =
                await requireAdmin(
                    req,
                    res
                );


            if (!actor) {
                return;
            }


            const {
                data: target,
                error
            } = await supabase
                .from("profiles")
                .select(
                    "id, username, role"
                )
                .eq(
                    "id",
                    req.params.id
                )
                .maybeSingle();


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            if (!target) {

                return res.status(404).json({
                    error:
                        "User not found."
                });

            }


            if (
                target.id === actor.id
            ) {

                return res.status(403).json({
                    error:
                        "You cannot kick yourself."
                });

            }


            if (
                !canManageRole(
                    actor.role,
                    target.role
                )
            ) {

                return res.status(403).json({
                    error:
                        "You cannot kick this user."
                });

            }


            const {
                error: updateError
            } = await supabase
                .from("profiles")
                .update({
                    kicked: true,
                    banned: false
                })
                .eq(
                    "id",
                    target.id
                );


            if (updateError) {

                console.error(
                    "KICK ERROR:",
                    updateError
                );

                return res.status(500).json({
                    error:
                        updateError.message
                });

            }


            console.log(
                `ADMIN: ${actor.username} kicked ${target.username}`
            );


            res.json({
                success: true,
                kicked: true
            });


        } catch (error) {

            console.error(
                "KICK ROUTE ERROR:",
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
// CLEAR KICK
// ==================================================
//
// This is NOT a "reactivate" system.
// It simply clears the temporary kick flag.
//
// Your admin panel doesn't have to expose this.
// ==================================================

app.post(
    "/api/admin/users/:id/clear-kick",
    requireLogin,
    async (req, res) => {

        try {

            const actor =
                await requireAdmin(
                    req,
                    res
                );


            if (!actor) {
                return;
            }


            const {
                data: target,
                error
            } = await supabase
                .from("profiles")
                .select(
                    "id, username, role"
                )
                .eq(
                    "id",
                    req.params.id
                )
                .maybeSingle();


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            if (!target) {

                return res.status(404).json({
                    error:
                        "User not found."
                });

            }


            if (
                target.id === actor.id
            ) {

                return res.status(403).json({
                    error:
                        "You cannot do this to yourself."
                });

            }


            if (
                !canManageRole(
                    actor.role,
                    target.role
                )
            ) {

                return res.status(403).json({
                    error:
                        "You cannot manage this user."
                });

            }


            const {
                error: updateError
            } = await supabase
                .from("profiles")
                .update({
                    kicked: false
                })
                .eq(
                    "id",
                    target.id
                );


            if (updateError) {

                return res.status(500).json({
                    error:
                        updateError.message
                });

            }


            res.json({
                success: true
            });


        } catch (error) {

            console.error(
                "CLEAR KICK ERROR:",
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
// MODERATION STATUS
// ==================================================
//
// THIS is what makes existing open pages
// detect bans/kicks.
//
// Login system is NOT touched.
// ==================================================

app.get(
    "/api/moderation/status",
    requireLogin,
    async (req, res) => {

        try {

            const userId =
                req.session.user.id;


            const {
                data: profile,
                error
            } = await supabase
                .from("profiles")
                .select(
                    "banned, kicked"
                )
                .eq(
                    "id",
                    userId
                )
                .maybeSingle();


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            if (!profile) {

                return res.status(404).json({
                    error:
                        "Profile not found."
                });

            }


            res.json({
                banned:
                    profile.banned === true,

                kicked:
                    profile.kicked === true
            });


        } catch (error) {

            console.error(
                "MODERATION STATUS ERROR:",
                error
            );


            res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);

app.post("/api/admin/reset-password", async (req, res) => {
    try {
        // Make sure someone is actually logged in
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                error: "Not logged in"
            });
        }

        // Get the currently logged-in admin's profile
        const { data: admin, error: adminError } = await supabase
            .from("profiles")
            .select("id, role")
            .eq("id", req.session.user.id)
            .single();

        if (adminError || !admin) {
            return res.status(403).json({
                error: "Unable to verify administrator"
            });
        }

        // Only administrators and owner can reset passwords
        if (admin.role !== "administrator" && admin.role !== "owner") {
            return res.status(403).json({
                error: "You do not have permission to reset passwords"
            });
        }

        const { userId, newPassword } = req.body;

        if (!userId || !newPassword) {
            return res.status(400).json({
                error: "User ID and new password are required"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                error: "Password must be at least 6 characters"
            });
        }

        // Change the user's Supabase Auth password
        const { data, error } =
            await supabase.auth.admin.updateUserById(
                userId,
                {
                    password: newPassword
                }
            );

        if (error) {
            console.error("Password reset error:", error);

            return res.status(500).json({
                error: error.message
            });
        }

        return res.json({
            success: true,
            message: "Password reset successfully"
        });

    } catch (error) {

        console.error("Admin password reset error:", error);

        return res.status(500).json({
            error: "Internal server error"
        });
    }
});
// ==================================================
// SHOP INVENTORY
// ==================================================
// ==================================================
// ADMIN SHREKCOINS
// ==================================================

app.post(
    "/api/admin/users/:id/shrekcoins",
    requireLogin,
    async (req, res) => {

        try {

            const actor =
                await requireAdmin(
                    req,
                    res
                );

            if (!actor) {
                return;
            }


            const targetId =
                req.params.id;


            const action =
                String(
                    req.body?.action || ""
                )
                .trim()
                .toLowerCase();


            const amount =
                Number(
                    req.body?.amount
                );


            if (
                action !== "give" &&
                action !== "take"
            ) {

                return res.status(400).json({
                    error:
                        "Action must be give or take."
                });

            }


            if (
                !Number.isInteger(amount) ||
                amount <= 0
            ) {

                return res.status(400).json({
                    error:
                        "Amount must be a positive whole number."
                });

            }


            if (
                amount > 1000000000
            ) {

                return res.status(400).json({
                    error:
                        "Amount is too large."
                });

            }


            // Get target

            const {
                data: target,
                error: targetError
            } = await supabase
                .from("profiles")
                .select(
                    "id, username, display_name, role, shrekcoins"
                )
                .eq(
                    "id",
                    targetId
                )
                .maybeSingle();


            if (targetError) {

                console.error(
                    "SHREKCOIN TARGET ERROR:",
                    targetError
                );

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


            // Admin cannot modify
            // someone with an equal/higher role.

            if (
                !canManageRole(
                    actor.role,
                    target.role
                )
            ) {

                return res.status(403).json({
                    error:
                        "You cannot modify this user's ShrekCoins."
                });

            }


            const currentCoins =
                Number(
                    target.shrekcoins || 0
                );


            let newCoins;


            if (
                action === "give"
            ) {

                newCoins =
                    currentCoins +
                    amount;

            } else {

                newCoins =
                    currentCoins -
                    amount;

                if (
                    newCoins < 0
                ) {
                    newCoins = 0;
                }

            }


            const {
                error: updateError
            } = await supabase
                .from("profiles")
                .update({
                    shrekcoins:
                        newCoins
                })
                .eq(
                    "id",
                    target.id
                );


            if (updateError) {

                console.error(
                    "SHREKCOIN UPDATE ERROR:",
                    updateError
                );

                return res.status(500).json({
                    error:
                        updateError.message
                });

            }


            console.log(
                `🪙 ${actor.username} ${action} ${amount} ShrekCoins ${action === "give" ? "to" : "from"} ${target.username}`
            );


            return res.json({

                success:
                    true,

                userId:
                    target.id,

                username:
                    target.username,

                action,

                amount,

                shrekcoins:
                    newCoins

            });


        } catch (error) {

            console.error(
                "SHREKCOIN ROUTE ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);

// ==================================================
// ADMIN SHREKCOIN MANAGEMENT
// ==================================================

app.post(
    "/api/admin/shrekcoins",
    requireLogin,
    async (req, res) => {

        try {

            // ==========================================
            // CHECK ADMIN
            // ==========================================

            const actor =
                await requireAdmin(
                    req,
                    res
                );

            if (!actor) {
                return;
            }


            // ==========================================
            // GET INPUT
            // ==========================================

            const userId =
                String(
                    req.body?.userId ||
                    ""
                ).trim();

            const action =
                String(
                    req.body?.action ||
                    ""
                ).trim().toLowerCase();

            const amount =
                Number(
                    req.body?.amount
                );


            // ==========================================
            // VALIDATE USER ID
            // ==========================================

            if (!userId) {

                return res.status(400).json({
                    error:
                        "User ID is required."
                });

            }


            // ==========================================
            // VALIDATE ACTION
            // ==========================================

            if (
                action !== "give" &&
                action !== "take"
            ) {

                return res.status(400).json({
                    error:
                        "Action must be give or take."
                });

            }


            // ==========================================
            // VALIDATE AMOUNT
            // ==========================================

            if (
                !Number.isInteger(amount) ||
                amount <= 0
            ) {

                return res.status(400).json({
                    error:
                        "Amount must be a positive whole number."
                });

            }


            // ==========================================
            // GET TARGET USER
            // ==========================================

            const {
                data: target,
                error: targetError
            } = await supabase
                .from("profiles")
                .select(
                    "id, username, display_name, shrekcoins, role"
                )
                .eq(
                    "id",
                    userId
                )
                .maybeSingle();


            if (targetError) {

                console.error(
                    "SHREKCOIN TARGET ERROR:",
                    targetError
                );

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
            // PREVENT NEGATIVE BALANCE
            // ==========================================

            const currentBalance =
                Number(
                    target.shrekcoins || 0
                );


            let newBalance;


            if (action === "give") {

                newBalance =
                    currentBalance +
                    amount;

            } else {

                newBalance =
                    currentBalance -
                    amount;

                if (newBalance < 0) {

                    newBalance = 0;

                }

            }


            // ==========================================
            // UPDATE BALANCE
            // ==========================================

            const {
                data: updated,
                error: updateError
            } = await supabase
                .from("profiles")
                .update({

                    shrekcoins:
                        newBalance

                })
                .eq(
                    "id",
                    userId
                )
                .select(
                    "id, username, display_name, shrekcoins"
                )
                .single();


            if (updateError) {

                console.error(
                    "SHREKCOIN UPDATE ERROR:",
                    updateError
                );

                return res.status(500).json({
                    error:
                        updateError.message
                });

            }


            // ==========================================
            // LOG ACTION
            // ==========================================

            console.log(
                `🪙 ADMIN: ${actor.username} ${action} ${amount} ShrekCoins ${target.username}. New balance: ${newBalance}`
            );


            // ==========================================
            // SUCCESS
            // ==========================================

            return res.json({

                success:
                    true,

                action:
                    action,

                amount:
                    amount,

                userId:
                    target.id,

                username:
                    target.username,

                shrekcoins:
                    updated.shrekcoins

            });


        } catch (error) {

            console.error(
                "ADMIN SHREKCOIN ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);

app.get("/api/shop/inventory", async (req, res) => {

    try {

        // ==========================================
        // CHECK LOGIN
        // ==========================================

        if (
            !req.session ||
            !req.session.user ||
            !req.session.user.id
        ) {

            return res.status(401).json({
                error: "You must be logged in."
            });

        }

        const userId = req.session.user.id;


        // ==========================================
        // GET OWNED ITEMS
        // ==========================================

        const {
            data: ownedItems,
            error: ownedError
        } = await supabase
            .from("user_shop_items")
            .select(`
                purchased_at,
                equipped,
                shop_items (
                    id,
                    name,
                    description,
                    item_type,
                    item_value,
                    price,
                    icon
                )
            `)
            .eq("user_id", userId);


        if (ownedError) {

            console.error(
                "INVENTORY OWNED ITEMS ERROR:",
                ownedError
            );

            return res.status(500).json({
                error: ownedError.message
            });

        }


        // ==========================================
        // GET PROFILE
        // ==========================================

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .select(`
                equipped_title_id,
                displayed_item_id
            `)
            .eq("id", userId)
            .maybeSingle();


        if (profileError) {

            console.error(
                "INVENTORY PROFILE ERROR:",
                profileError
            );

            return res.status(500).json({
                error: profileError.message
            });

        }


        // ==========================================
        // GET EQUIPPED TITLE
        // ==========================================

        let equippedTitle = null;

        if (
            profile &&
            profile.equipped_title_id
        ) {

            const {
                data: title,
                error: titleError
            } = await supabase
                .from("shop_items")
                .select(`
                    id,
                    name,
                    description,
                    item_type,
                    item_value,
                    price,
                    icon
                `)
                .eq(
                    "id",
                    profile.equipped_title_id
                )
                .eq(
                    "item_type",
                    "title"
                )
                .maybeSingle();


            if (titleError) {

                console.error(
                    "EQUIPPED TITLE ERROR:",
                    titleError
                );

            } else {

                equippedTitle =
                    title || null;

            }

        }


        // ==========================================
        // GET DISPLAYED ITEM
        // ==========================================

        let displayedItem = null;

        if (
            profile &&
            profile.displayed_item_id
        ) {

            const {
                data: item,
                error: itemError
            } = await supabase
                .from("shop_items")
                .select(`
                    id,
                    name,
                    description,
                    item_type,
                    item_value,
                    price,
                    icon
                `)
                .eq(
                    "id",
                    profile.displayed_item_id
                )
                .maybeSingle();


            if (itemError) {

                console.error(
                    "DISPLAYED ITEM ERROR:",
                    itemError
                );

            } else {

                displayedItem =
                    item || null;

            }

        }


        // ==========================================
        // FORMAT INVENTORY
        // ==========================================

        const items =
            (ownedItems || [])
                .map(row => {

                    if (!row.shop_items) {
                        return null;
                    }

                    return {

                        id:
                            row.shop_items.id,

                        name:
                            row.shop_items.name,

                        description:
                            row.shop_items.description,

                        icon:
                            row.shop_items.icon,

                        price:
                            row.shop_items.price,

                        item_type:
                            row.shop_items.item_type,

                        item_value:
                            row.shop_items.item_value,

                        purchased_at:
                            row.purchased_at,

                        equipped:
                            row.equipped === true

                    };

                })
                .filter(Boolean);


        // ==========================================
        // DISPLAYED ITEMS
        // ==========================================

        const displayedItems =
            items.filter(item => {

                return (
                    item.item_type !== "title" &&
                    item.equipped === true
                );

            });


        // ==========================================
        // RESPONSE
        // ==========================================

        return res.json({

            success: true,

            items,

            equipped:
                equippedTitle,

            displayedItems,

            displayedCount:
                displayedItems.length,

            maxDisplayed:
                5

        });


    } catch (error) {

        console.error(
            "SHOP INVENTORY ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Failed to load inventory."
        });

    }

});
app.get(
    "/api/shop/download/:id",
    async (req, res) => {

        try {

            // ==========================================
            // CHECK LOGIN
            // ==========================================

            if (
                !req.session ||
                !req.session.user ||
                !req.session.user.id
            ) {

                return res.status(401).json({
                    error:
                        "You must be logged in."
                });

            }


            const userId =
                req.session.user.id;


            // ==========================================
            // GET ITEM ID
            // ==========================================

            const itemId =
                Number(req.params.id);


            if (
                !Number.isInteger(itemId) ||
                itemId <= 0
            ) {

                return res.status(400).json({
                    error:
                        "Invalid item ID."
                });

            }


            // ==========================================
            // CHECK OWNERSHIP
            // ==========================================

            const {
                data: ownership,
                error: ownershipError
            } =
                await supabase
                    .from("user_shop_items")
                    .select("item_id")
                    .eq(
                        "user_id",
                        userId
                    )
                    .eq(
                        "item_id",
                        itemId
                    )
                    .maybeSingle();


            if (ownershipError) {

                console.error(
                    "DOWNLOAD OWNERSHIP ERROR:",
                    ownershipError
                );

                return res.status(500).json({
                    error:
                        "Could not verify ownership."
                });

            }


            if (!ownership) {

                return res.status(403).json({
                    error:
                        "You do not own this avatar."
                });

            }


            // ==========================================
            // GET AVATAR
            // ==========================================

            const {
                data: item,
                error: itemError
            } =
                await supabase
                    .from("shop_items")
                    .select(`
                        id,
                        name,
                        item_type,
                        item_value
                    `)
                    .eq(
                        "id",
                        itemId
                    )
                    .maybeSingle();


            if (itemError) {

                console.error(
                    "DOWNLOAD ITEM ERROR:",
                    itemError
                );

                return res.status(500).json({
                    error:
                        "Could not find avatar."
                });

            }


            if (!item) {

                return res.status(404).json({
                    error:
                        "Avatar not found."
                });

            }


            // ==========================================
            // MAKE SURE IT IS AN AVATAR
            // ==========================================

            if (
                item.item_type !==
                "avatar"
            ) {

                return res.status(400).json({
                    error:
                        "This item is not an avatar."
                });

            }


            // ==========================================
            // CHECK FILE URL
            // ==========================================

            if (
                !item.item_value
            ) {

                return res.status(404).json({
                    error:
                        "Avatar file not found."
                });

            }


            // ==========================================
            // DOWNLOAD FILE
            // ==========================================

            const avatarResponse =
                await fetch(
                    item.item_value
                );


            if (
                !avatarResponse.ok
            ) {

                console.error(
                    "AVATAR STORAGE ERROR:",
                    avatarResponse.status,
                    avatarResponse.statusText
                );

                return res.status(500).json({
                    error:
                        "Could not retrieve avatar file."
                });

            }


            const arrayBuffer =
                await avatarResponse.arrayBuffer();


            const buffer =
                Buffer.from(
                    arrayBuffer
                );


            // ==========================================
            // CREATE SAFE FILENAME
            // ==========================================

            const safeName =
                String(
                    item.name ||
                    "shrekbook-avatar"
                )
                    .replace(
                        /[^a-z0-9_\- ]/gi,
                        ""
                    )
                    .trim()
                    .replace(
                        /\s+/g,
                        "-"
                    );


            // ==========================================
            // SEND FILE
            // ==========================================

            res.setHeader(
                "Content-Type",
                "application/octet-stream"
            );

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${safeName || "shrekbook-avatar"}.sb"`
            );

            res.setHeader(
                "Content-Length",
                buffer.length
            );


            return res.send(
                buffer
            );


        } catch (error) {

            console.error(
                "AVATAR DOWNLOAD ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    "Failed to download avatar."
            });

        }

    }
);
app.post("/api/hambicoin/exchange", async (req, res) => {

    try {

        // ==========================================
        // CHECK LOGIN
        // ==========================================

        if (!req.session.user) {

            return res.status(401).json({
                error: "You must be logged in."
            });

        }

        const userId =
            req.session.user.id;


        // ==========================================
        // GET INPUT
        // ==========================================

        const {
            direction,
            amount
        } = req.body;


        const numericAmount =
            Number(amount);


        // ==========================================
        // VALIDATE AMOUNT
        // ==========================================

        if (
            !Number.isInteger(numericAmount) ||
            numericAmount <= 0
        ) {

            return res.status(400).json({
                error:
                    "Amount must be a positive whole number."
            });

        }


        // ==========================================
        // VALIDATE DIRECTION
        // ==========================================

        if (
            direction !== "shrek_to_hambi" &&
            direction !== "hambi_to_shrek"
        ) {

            return res.status(400).json({
                error:
                    "Invalid exchange direction."
            });

        }


        // ==========================================
        // SHREKCOINS → HAMBICOINS
        //
        // 100 ShrekCoins = 1 HambiCoin
        // ==========================================

        if (
            direction === "shrek_to_hambi" &&
            numericAmount % 100 !== 0
        ) {

            return res.status(400).json({
                error:
                    "ShrekCoin amount must be divisible by 100."
            });

        }


        // ==========================================
        // EXCHANGE
        // ==========================================

        const {
            data,
            error
        } = await supabase.rpc(
            "exchange_hambicoin",
            {
                p_user_id:
                    userId,

                p_direction:
                    direction,

                p_amount:
                    numericAmount
            }
        );


        if (error) {

            console.error(
                "HAMBI EXCHANGE ERROR:",
                error
            );

            return res.status(400).json({
                error:
                    error.message ||
                    "Exchange failed."
            });

        }


        // ==========================================
        // UPDATED BALANCES
        // ==========================================

        const balances =
            data?.[0];


        return res.json({

            success:
                true,

            user: {

                shrekcoins:
                    Number(
                        balances?.shrekcoins || 0
                    ),

                hambicoins:
                    Number(
                        balances?.hambicoins || 0
                    )

            }

        });


    } catch (error) {

        console.error(
            "HAMBI EXCHANGE SERVER ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Internal server error."
        });

    }

});
app.post("/api/shop/purchase", async (req, res) => {

    try {

        if (!req.session.user) {

            return res.status(401).json({
                error:
                    "You must be logged in."
            });

        }

        const itemId =
            Number(req.body.item_id);


        if (
            !Number.isInteger(itemId) ||
            itemId <= 0
        ) {

            return res.status(400).json({
                error:
                    "Invalid item ID."
            });

        }


        const {
            data,
            error
        } = await supabase.rpc(
            "purchase_shop_item",
            {
                p_buyer_id:
                    req.session.user.id,

                p_item_id:
                    itemId
            }
        );


        if (error) {

            console.error(
                "SHOP PURCHASE ERROR:",
                error
            );

            return res.status(400).json({
                error:
                    error.message ||
                    "Purchase failed."
            });

        }


        const result =
            data?.[0];


        res.json({

            success:
                true,

            buyer_shrekcoins:
                Number(
                    result?.buyer_shrekcoins || 0
                ),

            seller_shrekcoins:
                Number(
                    result?.seller_shrekcoins || 0
                ),

            seller_id:
                result?.seller_id,

            seller_amount:
                Number(
                    result?.seller_amount || 0
                ),

            tax_amount:
                Number(
                    result?.tax_amount || 0
                )

        });


    } catch (error) {

        console.error(
            "SHOP PURCHASE SERVER ERROR:",
            error
        );

        res.status(500).json({
            error:
                "Internal server error."
        });

    }

});
app.get("/api/shop/sell-history", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({
                error: "You must be logged in."
            });
        }

        const sellerId = req.session.user.id;

        const { data, error } = await supabase
            .from("marketplace_sales")
            .select(`
                id,
                item_id,
                buyer_id,
                price,
                tax,
                seller_amount,
                created_at,
                shop_items (
                    name,
                    icon
                ),
                profiles!marketplace_sales_buyer_id_fkey (
                    username,
                    display_name,
                    avatar
                )
            `)
            .eq("seller_id", sellerId)
            .order("created_at", {
                ascending: false
            });

        if (error) {

            console.error(
                "SELL HISTORY ERROR:",
                error
            );

            return res.status(500).json({
                error: "Failed to load sell history."
            });
        }

        res.json({
            success: true,
            sales: data || []
        });

    } catch (error) {

        console.error(
            "SELL HISTORY SERVER ERROR:",
            error
        );

        res.status(500).json({
            error: "Internal server error."
        });
    }

});
app.post("/api/currency/transfer", async (req, res) => {

    try {

        // ==========================================
        // CHECK LOGIN
        // ==========================================

        if (!req.session.user) {

            return res.status(401).json({
                error:
                    "You must be logged in."
            });

        }

        const userId =
            req.session.user.id;


        // ==========================================
        // GET INPUT
        // ==========================================

        const {
            username,
            currency,
            amount
        } = req.body;


        // ==========================================
        // VALIDATE USERNAME
        // ==========================================

        if (
            !username ||
            typeof username !== "string"
        ) {

            return res.status(400).json({
                error:
                    "Recipient username is required."
            });

        }


        // ==========================================
        // VALIDATE AMOUNT
        // ==========================================

        const numericAmount =
            Number(amount);


        if (
            !Number.isInteger(numericAmount) ||
            numericAmount <= 0
        ) {

            return res.status(400).json({
                error:
                    "Amount must be a positive whole number."
            });

        }


        // ==========================================
        // VALIDATE CURRENCY
        // ==========================================

        if (
            currency !== "shrekcoins" &&
            currency !== "hambicoins"
        ) {

            return res.status(400).json({
                error:
                    "Invalid currency."
            });

        }


        // ==========================================
        // TRANSFER
        // ==========================================

        const {
            data,
            error
        } = await supabase.rpc(
            "transfer_currency",
            {
                p_sender_id:
                    userId,

                p_recipient_username:
                    username.trim(),

                p_currency:
                    currency,

                p_amount:
                    numericAmount
            }
        );


        if (error) {

            console.error(
                "CURRENCY TRANSFER ERROR:",
                error
            );

            return res.status(400).json({
                error:
                    error.message ||
                    "Transfer failed."
            });

        }


        // ==========================================
        // UPDATED BALANCES
        // ==========================================

        const balances =
            data?.[0];


        return res.json({

            success:
                true,

            user: {

                shrekcoins:
                    Number(
                        balances?.shrekcoins || 0
                    ),

                hambicoins:
                    Number(
                        balances?.hambicoins || 0
                    )

            }

        });


    } catch (error) {

        console.error(
            "CURRENCY TRANSFER SERVER ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Internal server error."
        });

    }

});



// ============================================================
// SHREKBOOK HOUSES API
// ============================================================

// ---------- House authentication helper ----------

function requireHouseLogin(req, res) {
    if (!req.session || !req.session.user || !req.session.user.id) {
        res.status(401).json({
            error: "You must be logged in."
        });
        return null;
    }

    return req.session.user.id;
}


// ---------- House ID validation ----------

function getHouseId(req, res) {
    const rawId = String(req.params.id || "").trim();

    if (!/^\d+$/.test(rawId)) {
        res.status(400).json({
            error: "Invalid House ID."
        });
        return null;
    }

    return Number(rawId);
}


// ---------- Get profile ----------

async function getHouseProfile(userId) {
    if (!userId) return null;

    const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        console.error("getHouseProfile error:", error);
        return null;
    }

    return data || null;
}


// ---------- Get House type ----------

async function getHouseTypeByName(name) {
    if (!name) return null;

    const { data, error } = await supabase
        .from("house_types")
        .select("id, name, cost, tax_reduction, room_count")
        .eq("name", name)
        .maybeSingle();

    if (error) {
        console.error("getHouseTypeByName error:", error);
        return null;
    }

    return data || null;
}


// ---------- Get membership ----------

async function getHouseMembership(houseId, userId) {
    if (!houseId || !userId) return null;

    const { data, error } = await supabase
        .from("house_members")
        .select("id, house_id, user_id, role, joined_at")
        .eq("house_id", houseId)
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        console.error("getHouseMembership error:", error);
        return null;
    }

    return data || null;
}


// ---------- Check House manager ----------

async function isHouseManager(houseId, userId) {
    const membership = await getHouseMembership(houseId, userId);

    if (!membership) {
        return false;
    }

    return (
        membership.role === "owner" ||
        membership.role === "admin"
    );
}


// ============================================================
// HOUSE TYPES
// ============================================================

app.get("/api/houses/types", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("house_types")
            .select("id, name, cost, tax_reduction, room_count")
            .order("cost", { ascending: true });

        if (error) {
            console.error("GET /api/houses/types:", error);

            return res.status(500).json({
                error: "Failed to load House types."
            });
        }

        res.json({
            houseTypes: data || []
        });

    } catch (err) {
        console.error("House types error:", err);

        res.status(500).json({
            error: "Server error."
        });
    }
});


// ============================================================
// LIST HOUSES
// IMPORTANT:
// House searching is done by houses.html locally.
// There is NO /api/houses/search route.
// ============================================================

app.get("/api/houses", async (req, res) => {
    try {
        const { data: houses, error } = await supabase
            .from("houses")
            .select("id, name, description, owner_id, house_type, created_at")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("GET /api/houses:", error);

            return res.status(500).json({
                error: "Failed to load Houses."
            });
        }

        const houseList = houses || [];

        // Get owners manually.
        // This avoids relying on Supabase FK/nested-select behavior.
        const ownerIds = [
            ...new Set(
                houseList
                    .map(h => h.owner_id)
                    .filter(Boolean)
            )
        ];

        let owners = [];

        if (ownerIds.length > 0) {
            const { data, error: ownerError } = await supabase
                .from("profiles")
                .select("id, username, display_name, avatar_url")
                .in("id", ownerIds);

            if (ownerError) {
                console.error("House owner lookup:", ownerError);
            } else {
                owners = data || [];
            }
        }

        const ownerMap = new Map(
            owners.map(owner => [owner.id, owner])
        );

        const result = houseList.map(house => ({
            ...house,

            owner: ownerMap.get(house.owner_id) || null
        }));

        res.json({
            houses: result
        });

    } catch (err) {
        console.error("GET /api/houses error:", err);

        res.status(500).json({
            error: "Server error."
        });
    }
});


// ============================================================
// HOUSE INVITATIONS
// MUST COME BEFORE /api/houses/:id
// ============================================================

app.get("/api/houses/invitations", async (req, res) => {
    const userId = requireHouseLogin(req, res);

    if (!userId) return;

    try {
        const { data: invitations, error } = await supabase
            .from("house_invitations")
            .select(
                "id, house_id, inviter_id, invitee_id, status, created_at"
            )
            .eq("invitee_id", userId)
            .eq("status", "pending")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("GET invitations:", error);

            return res.status(500).json({
                error: "Failed to load invitations."
            });
        }

        const list = invitations || [];

        const houseIds = [
            ...new Set(list.map(x => x.house_id))
        ];

        const inviterIds = [
            ...new Set(list.map(x => x.inviter_id))
        ];

        let houses = [];
        let inviters = [];

        if (houseIds.length > 0) {
            const { data, error: houseError } = await supabase
                .from("houses")
                .select("id, name, house_type")
                .in("id", houseIds);

            if (!houseError) {
                houses = data || [];
            }
        }

        if (inviterIds.length > 0) {
            const { data, error: inviterError } = await supabase
                .from("profiles")
                .select("id, username, display_name, avatar_url")
                .in("id", inviterIds);

            if (!inviterError) {
                inviters = data || [];
            }
        }

        const houseMap = new Map(
            houses.map(h => [h.id, h])
        );

        const inviterMap = new Map(
            inviters.map(p => [p.id, p])
        );

        res.json({
            invitations: list.map(invite => ({
                ...invite,
                house: houseMap.get(invite.house_id) || null,
                inviter: inviterMap.get(invite.inviter_id) || null
            }))
        });

    } catch (err) {
        console.error("GET invitations error:", err);

        res.status(500).json({
            error: "Server error."
        });
    }
});


// ============================================================
// ACCEPT INVITATION
// ============================================================

app.post("/api/houses/invitations/:id/accept", async (req, res) => {
    const userId = requireHouseLogin(req, res);

    if (!userId) return;

    const invitationId = Number(req.params.id);

    if (!Number.isInteger(invitationId)) {
        return res.status(400).json({
            error: "Invalid invitation ID."
        });
    }

    try {
        const { data: invitation, error } = await supabase
            .from("house_invitations")
            .select("*")
            .eq("id", invitationId)
            .eq("invitee_id", userId)
            .eq("status", "pending")
            .maybeSingle();

        if (error) {
            console.error("Accept invitation lookup:", error);

            return res.status(500).json({
                error: "Failed to find invitation."
            });
        }

        if (!invitation) {
            return res.status(404).json({
                error: "Invitation not found."
            });
        }

        const { error: memberError } = await supabase
            .from("house_members")
            .upsert(
                {
                    house_id: invitation.house_id,
                    user_id: userId,
                    role: "member"
                },
                {
                    onConflict: "house_id,user_id"
                }
            );

        if (memberError) {
            console.error("Accept invitation member:", memberError);

            return res.status(500).json({
                error: "Failed to join House."
            });
        }

        const { error: updateError } = await supabase
            .from("house_invitations")
            .update({
                status: "accepted"
            })
            .eq("id", invitationId);

        if (updateError) {
            console.error("Accept invitation update:", updateError);

            return res.status(500).json({
                error: "Joined House, but failed to update invitation."
            });
        }

        res.json({
            success: true
        });

    } catch (err) {
        console.error("Accept invitation error:", err);

        res.status(500).json({
            error: "Server error."
        });
    }
});


// ============================================================
// DECLINE INVITATION
// ============================================================

app.post("/api/houses/invitations/:id/decline", async (req, res) => {
    const userId = requireHouseLogin(req, res);

    if (!userId) return;

    const invitationId = Number(req.params.id);

    if (!Number.isInteger(invitationId)) {
        return res.status(400).json({
            error: "Invalid invitation ID."
        });
    }

    try {
        const { data, error } = await supabase
            .from("house_invitations")
            .update({
                status: "declined"
            })
            .eq("id", invitationId)
            .eq("invitee_id", userId)
            .eq("status", "pending")
            .select("id")
            .maybeSingle();

        if (error) {
            console.error("Decline invitation:", error);

            return res.status(500).json({
                error: "Failed to decline invitation."
            });
        }

        if (!data) {
            return res.status(404).json({
                error: "Invitation not found."
            });
        }

        res.json({
            success: true
        });

    } catch (err) {
        console.error("Decline invitation error:", err);

        res.status(500).json({
            error: "Server error."
        });
    }
});


// ============================================================
// USER SEARCH
// THIS IS FOR HOUSE INVITES
// ============================================================

app.get("/api/users/search", async (req, res) => {
    const userId = requireHouseLogin(req, res);

    if (!userId) return;

    try {
        const q = String(req.query.q || "").trim();

        if (!q) {
            return res.json({
                users: []
            });
        }

        if (q.length < 1) {
            return res.json({
                users: []
            });
        }

        // Escape characters that have special meaning in PostgREST ilike.
        const safeQ = q
            .replace(/\\/g, "\\\\")
            .replace(/%/g, "\\%")
            .replace(/_/g, "\\_");

        const pattern = `%${safeQ}%`;

        const { data, error } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .or(
                `username.ilike.${pattern},display_name.ilike.${pattern}`
            )
            .neq("id", userId)
            .limit(20);

        if (error) {
            console.error("User search:", error);

            return res.status(500).json({
                error: "Failed to search users."
            });
        }

        res.json({
            users: data || []
        });

    } catch (err) {
        console.error("User search error:", err);

        res.status(500).json({
            error: "Server error."
        });
    }
});


// ============================================================
// GET ONE HOUSE
// ============================================================

app.get("/api/houses/:id", async (req, res) => {
    const userId = requireHouseLogin(req, res);

    if (!userId) return;

    const houseId = getHouseId(req, res);

    if (houseId === null) return;

    try {

        // --------------------------------------------------------
        // HOUSE
        // --------------------------------------------------------

        const { data: house, error: houseError } = await supabase
            .from("houses")
            .select(
                "id, name, description, owner_id, house_type, created_at"
            )
            .eq("id", houseId)
            .maybeSingle();

        if (houseError) {
            console.error("House lookup:", houseError);

            return res.status(500).json({
                error: "Failed to load House."
            });
        }

        if (!house) {
            return res.status(404).json({
                error: "House not found."
            });
        }


        // --------------------------------------------------------
        // HOUSE TYPE
        // --------------------------------------------------------

        const houseType = await getHouseTypeByName(
            house.house_type
        );


        // --------------------------------------------------------
        // OWNER
        // --------------------------------------------------------

        const owner = await getHouseProfile(
            house.owner_id
        );


        // --------------------------------------------------------
        // ROOMS
        // --------------------------------------------------------

        const { data: rooms, error: roomsError } = await supabase
            .from("house_rooms")
            .select(
                "id, house_id, name, room_type, user_id, created_at"
            )
            .eq("house_id", houseId)
            .order("id", { ascending: true });

        if (roomsError) {
            console.error("House rooms:", roomsError);

            return res.status(500).json({
                error: "Failed to load House rooms."
            });
        }


        // --------------------------------------------------------
        // MEMBERS
        // --------------------------------------------------------

        const { data: memberships, error: membersError } = await supabase
            .from("house_members")
            .select(
                "id, house_id, user_id, role, joined_at"
            )
            .eq("house_id", houseId)
            .order("joined_at", { ascending: true });

        if (membersError) {
            console.error("House members:", membersError);

            return res.status(500).json({
                error: "Failed to load House members."
            });
        }

        const memberRows = memberships || [];

        const memberIds = [
            ...new Set(
                memberRows
                    .map(member => member.user_id)
                    .filter(Boolean)
            )
        ];

        let profiles = [];

        if (memberIds.length > 0) {
            const { data, error: profileError } = await supabase
                .from("profiles")
                .select(
                    "id, username, display_name, avatar_url"
                )
                .in("id", memberIds);

            if (profileError) {
                console.error("House member profiles:", profileError);
            } else {
                profiles = data || [];
            }
        }

        const profileMap = new Map(
            profiles.map(profile => [profile.id, profile])
        );

        const members = memberRows.map(member => ({
            ...member,
            user: profileMap.get(member.user_id) || null
        }));


        // --------------------------------------------------------
        // CURRENT USER MEMBERSHIP
        // --------------------------------------------------------

        let membership = await getHouseMembership(
            houseId,
            userId
        );


        // --------------------------------------------------------
        // OWNER FALLBACK
        // --------------------------------------------------------

        // If the owner wasn't backfilled into house_members,
        // still treat them as owner.
        if (
            !membership &&
            house.owner_id === userId
        ) {
            membership = {
                house_id: houseId,
                user_id: userId,
                role: "owner"
            };
        }


        // --------------------------------------------------------
        // PERMISSIONS
        // --------------------------------------------------------

        const canManage =
            !!membership &&
            (
                membership.role === "owner" ||
                membership.role === "admin"
            );

        const canInvite =
            !!membership;


        // --------------------------------------------------------
        // FINAL RESPONSE
        // --------------------------------------------------------

        res.json({
            house: house,

            houseType: houseType,

            owner: owner,

            rooms: rooms || [],

            members: members,

            membership: membership,

            canManage: canManage,

            canInvite: canInvite
        });

    } catch (err) {
        console.error("GET /api/houses/:id error:", err);

        res.status(500).json({
            error: "Server error."
        });
    }
});


// ============================================================
// CREATE HOUSE
// ============================================================

app.post("/api/houses", async (req, res) => {
    const userId = requireHouseLogin(req, res);

    if (!userId) return;

    try {
        const name = String(req.body.name || "").trim();
        const description = String(req.body.description || "").trim();
        const houseTypeName = String(
            req.body.houseType || ""
        ).trim();

        if (!name) {
            return res.status(400).json({
                error: "House name is required."
            });
        }

        if (name.length > 100) {
            return res.status(400).json({
                error: "House name is too long."
            });
        }

        const houseType = await getHouseTypeByName(
            houseTypeName
        );

        if (!houseType) {
            return res.status(400).json({
                error: "Invalid House type."
            });
        }


        // --------------------------------------------------------
        // GET USER BALANCE
        // --------------------------------------------------------

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id, shrekcoins")
            .eq("id", userId)
            .maybeSingle();

        if (profileError || !profile) {
            return res.status(404).json({
                error: "Profile not found."
            });
        }

        const balance = Number(profile.shrekcoins || 0);
        const cost = Number(houseType.cost || 0);

        if (balance < cost) {
            return res.status(400).json({
                error: "You do not have enough ShrekCoins."
            });
        }


        // --------------------------------------------------------
        // DEDUCT MONEY
        // --------------------------------------------------------

        const { error: moneyError } = await supabase
            .from("profiles")
            .update({
                shrekcoins: balance - cost
            })
            .eq("id", userId);

        if (moneyError) {
            console.error("House money deduction:", moneyError);

            return res.status(500).json({
                error: "Failed to pay for House."
            });
        }


        // --------------------------------------------------------
        // CREATE HOUSE
        // --------------------------------------------------------

        const { data: house, error: houseError } = await supabase
            .from("houses")
            .insert({
                name: name,
                description: description || null,
                owner_id: userId,
                house_type: houseType.name
            })
            .select(
                "id, name, description, owner_id, house_type, created_at"
            )
            .single();

        if (houseError || !house) {

            // Refund if House creation fails.
            await supabase
                .from("profiles")
                .update({
                    shrekcoins: balance
                })
                .eq("id", userId);

            console.error("House creation:", houseError);

            return res.status(500).json({
                error: "Failed to create House."
            });
        }


        // --------------------------------------------------------
        // OWNER MEMBERSHIP
        // --------------------------------------------------------

        const { error: memberError } = await supabase
            .from("house_members")
            .insert({
                house_id: house.id,
                user_id: userId,
                role: "owner"
            });

        if (memberError) {
            console.error("House owner membership:", memberError);

            // Delete House and refund.
            await supabase
                .from("houses")
                .delete()
                .eq("id", house.id);

            await supabase
                .from("profiles")
                .update({
                    shrekcoins: balance
                })
                .eq("id", userId);

            return res.status(500).json({
                error: "Failed to create House membership."
            });
        }


        // --------------------------------------------------------
        // CREATE ROOMS
        // --------------------------------------------------------

        const roomCount = Number(houseType.room_count);

        const roomRows = [];

        for (let i = 1; i <= roomCount; i++) {

            // Last room is owner's bedroom.
            if (i === roomCount) {
                roomRows.push({
                    house_id: house.id,
                    name: "Owner's Bedroom",
                    room_type: "bedroom",
                    user_id: userId
                });
            } else {
                roomRows.push({
                    house_id: house.id,
                    name: `Common Room ${i}`,
                    room_type: "common",
                    user_id: null
                });
            }
        }

        const { data: rooms, error: roomError } = await supabase
            .from("house_rooms")
            .insert(roomRows)
            .select(
                "id, house_id, name, room_type, user_id, created_at"
            );

        if (roomError) {
            console.error("House rooms creation:", roomError);

            // Clean up House if room creation failed.
            await supabase
                .from("houses")
                .delete()
                .eq("id", house.id);

            await supabase
                .from("profiles")
                .update({
                    shrekcoins: balance
                })
                .eq("id", userId);

            return res.status(500).json({
                error: "Failed to create House rooms."
            });
        }


        // --------------------------------------------------------
        // RESPONSE
        // --------------------------------------------------------

        res.status(201).json({
            success: true,

            house: house,

            houseType: houseType,

            owner: await getHouseProfile(userId),

            rooms: rooms || [],

            membership: {
                house_id: house.id,
                user_id: userId,
                role: "owner"
            }
        });

    } catch (err) {
        console.error("POST /api/houses error:", err);

        res.status(500).json({
            error: "Server error."
        });
    }
});


// ============================================================
// UPDATE HOUSE
// OWNER / ADMIN
// ============================================================

app.put("/api/houses/:id", async (req, res) => {
    const userId = requireHouseLogin(req, res);

    if (!userId) return;

    const houseId = getHouseId(req, res);

    if (houseId === null) return;

    try {
        const canManage = await isHouseManager(
            houseId,
            userId
        );

        if (!canManage) {
            return res.status(403).json({
                error: "You do not have permission to manage this House."
            });
        }

        const updates = {};

        if (req.body.name !== undefined) {
            const name = String(req.body.name).trim();

            if (!name) {
                return res.status(400).json({
                    error: "House name cannot be empty."
                });
            }

            updates.name = name;
        }

        if (req.body.description !== undefined) {
            updates.description =
                String(req.body.description).trim() || null;
        }

        const { data, error } = await supabase
            .from("houses")
            .update(updates)
            .eq("id", houseId)
            .select(
                "id, name, description, owner_id, house_type, created_at"
            )
            .single();

        if (error) {
            console.error("Update House:", error);

            return res.status(500).json({
                error: "Failed to update House."
            });
        }

        res.json({
            success: true,
            house: data
        });

    } catch (err) {
        console.error("PUT /api/houses/:id:", err);

        res.status(500).json({
            error: "Server error."
        });
    }
});


// ============================================================
// INVITE USER
// ============================================================

app.post("/api/houses/:id/invite", async (req, res) => {
    const userId = requireHouseLogin(req, res);

    if (!userId) return;

    const houseId = getHouseId(req, res);

    if (houseId === null) return;

    try {
        const membership = await getHouseMembership(
            houseId,
            userId
        );

        if (!membership) {
            return res.status(403).json({
                error: "You must be a House member to invite people."
            });
        }

        const inviteeId = String(
            req.body.userId || ""
        ).trim();

        if (!inviteeId) {
            return res.status(400).json({
                error: "User ID is required."
            });
        }

        if (inviteeId === userId) {
            return res.status(400).json({
                error: "You cannot invite yourself."
            });
        }


        // Make sure target profile exists.
        const target = await getHouseProfile(inviteeId);

        if (!target) {
            return res.status(404).json({
                error: "User not found."
            });
        }


        // Already member?
        const existingMember = await getHouseMembership(
            houseId,
            inviteeId
        );

        if (existingMember) {
            return res.status(400).json({
                error: "That user is already in this House."
            });
        }


        const { data, error } = await supabase
            .from("house_invitations")
            .upsert(
                {
                    house_id: houseId,
                    inviter_id: userId,
                    invitee_id: inviteeId,
                    status: "pending"
                },
                {
                    onConflict: "house_id,invitee_id"
                }
            )
            .select("*")
            .single();

        if (error) {
            console.error("House invitation:", error);

            return res.status(500).json({
                error: "Failed to send invitation."
            });
        }

        res.json({
            success: true,
            invitation: data
        });

    } catch (err) {
        console.error("Invite error:", err);

        res.status(500).json({
            error: "Server error."
        });
    }
});


// ============================================================
// REMOVE MEMBER
// ============================================================

app.delete("/api/houses/:id/members/:userId", async (req, res) => {
    const userId = requireHouseLogin(req, res);

    if (!userId) return;

    const houseId = getHouseId(req, res);

    if (houseId === null) return;

    try {
        const manager = await getHouseMembership(
            houseId,
            userId
        );

        if (
            !manager ||
            (
                manager.role !== "owner" &&
                manager.role !== "admin"
            )
        ) {
            return res.status(403).json({
                error: "You do not have permission to remove members."
            });
        }

        const targetId = String(
            req.params.userId || ""
        ).trim();

        const target = await getHouseMembership(
            houseId,
            targetId
        );

        if (!target) {
            return res.status(404).json({
                error: "Member not found."
            });
        }

        if (target.role === "owner") {
            return res.status(400).json({
                error: "The House owner cannot be removed."
            });
        }

        if (
            manager.role === "admin" &&
            target.role === "admin"
        ) {
            return res.status(403).json({
                error: "House admins cannot remove other admins."
            });
        }

        const { error } = await supabase
            .from("house_members")
            .delete()
            .eq("house_id", houseId)
            .eq("user_id", targetId);

        if (error) {
            console.error("Remove member:", error);

            return res.status(500).json({
                error: "Failed to remove member."
            });
        }

        res.json({
            success: true
        });

    } catch (err) {
        console.error("Remove member error:", err);

        res.status(500).json({
            error: "Server error."
        });
    }
});


// ============================================================
// PROMOTE ADMIN
// ============================================================

app.post("/api/houses/:id/admins/:userId", async (req, res) => {
    const userId = requireHouseLogin(req, res);

    if (!userId) return;

    const houseId = getHouseId(req, res);

    if (houseId === null) return;

    try {
        const owner = await getHouseMembership(
            houseId,
            userId
        );

        if (!owner || owner.role !== "owner") {
            return res.status(403).json({
                error: "Only the House owner can manage admins."
            });
        }

        const targetId = String(
            req.params.userId || ""
        ).trim();

        const target = await getHouseMembership(
            houseId,
            targetId
        );

        if (!target) {
            return res.status(404).json({
                error: "Member not found."
            });
        }

        if (target.role === "owner") {
            return res.status(400).json({
                error: "The owner is already the owner."
            });
        }

        const { error } = await supabase
            .from("house_members")
            .update({
                role: "admin"
            })
            .eq("house_id", houseId)
            .eq("user_id", targetId);

        if (error) {
            console.error("Promote admin:", error);

            return res.status(500).json({
                error: "Failed to promote member."
            });
        }

        res.json({
            success: true
        });

    } catch (err) {
        console.error("Promote admin error:", err);

        res.status(500).json({
            error: "Server error."
        });
    }
});


// ============================================================
// DEMOTE ADMIN
// ============================================================

app.delete("/api/houses/:id/admins/:userId", async (req, res) => {
    const userId = requireHouseLogin(req, res);

    if (!userId) return;

    const houseId = getHouseId(req, res);

    if (houseId === null) return;

    try {
        const owner = await getHouseMembership(
            houseId,
            userId
        );

        if (!owner || owner.role !== "owner") {
            return res.status(403).json({
                error: "Only the House owner can manage admins."
            });
        }

        const targetId = String(
            req.params.userId || ""
        ).trim();

        const { error } = await supabase
            .from("house_members")
            .update({
                role: "member"
            })
            .eq("house_id", houseId)
            .eq("user_id", targetId)
            .eq("role", "admin");

        if (error) {
            console.error("Demote admin:", error);

            return res.status(500).json({
                error: "Failed to demote admin."
            });
        }

        res.json({
            success: true
        });

    } catch (err) {
        console.error("Demote admin error:", err);

        res.status(500).json({
            error: "Server error."
        });
    }
});


// ============================================================
// GET ROOM
// ============================================================

app.get("/api/houses/:houseId/rooms/:roomId", async (req, res) => {
    const userId = requireHouseLogin(req, res);

    if (!userId) return;

    const houseId = Number(req.params.houseId);
    const roomId = Number(req.params.roomId);

    if (
        !Number.isInteger(houseId) ||
        !Number.isInteger(roomId)
    ) {
        return res.status(400).json({
            error: "Invalid House or room ID."
        });
    }

    try {

        // --------------------------------------------------------
        // HOUSE
        // --------------------------------------------------------

        const { data: house, error: houseError } = await supabase
            .from("houses")
            .select(
                "id, name, description, owner_id, house_type, created_at"
            )
            .eq("id", houseId)
            .maybeSingle();

        if (houseError) {
            console.error("Room House lookup:", houseError);

            return res.status(500).json({
                error: "Failed to load House."
            });
        }

        if (!house) {
            return res.status(404).json({
                error: "House not found."
            });
        }


        // --------------------------------------------------------
        // ROOM
        // --------------------------------------------------------

        const { data: room, error: roomError } = await supabase
            .from("house_rooms")
            .select(
                "id, house_id, name, room_type, user_id, created_at"
            )
            .eq("id", roomId)
            .eq("house_id", houseId)
            .maybeSingle();

        if (roomError) {
            console.error("Room lookup:", roomError);

            return res.status(500).json({
                error: "Failed to load room."
            });
        }

        if (!room) {
            return res.status(404).json({
                error: "Room not found."
            });
        }


        // --------------------------------------------------------
        // HOUSE TYPE
        // --------------------------------------------------------

        const houseType = await getHouseTypeByName(
            house.house_type
        );


        // --------------------------------------------------------
        // BEDROOM OWNER
        // --------------------------------------------------------

        let bedroomOwner = null;

        if (
            room.room_type === "bedroom" &&
            room.user_id
        ) {
            bedroomOwner = await getHouseProfile(
                room.user_id
            );
        }


        // --------------------------------------------------------
        // MEMBERSHIP
        // --------------------------------------------------------

        let membership = await getHouseMembership(
            houseId,
            userId
        );

        if (
            !membership &&
            house.owner_id === userId
        ) {
            membership = {
                house_id: houseId,
                user_id: userId,
                role: "owner"
            };
        }


        // --------------------------------------------------------
        // ACCESS
        // --------------------------------------------------------

        let canAccess = false;
        let canManageAccess = false;

        if (membership) {
            canManageAccess =
                membership.role === "owner" ||
                membership.role === "admin";

            // Common rooms are public to House members.
            if (room.room_type === "common") {
                canAccess = true;
            }

            // Owner/admin can enter any bedroom.
            if (
                room.room_type === "bedroom" &&
                canManageAccess
            ) {
                canAccess = true;
            }

            // Bedroom owner can enter.
            if (
                room.room_type === "bedroom" &&
                room.user_id === userId
            ) {
                canAccess = true;
            }

            // Explicit bedroom access.
            if (
                room.room_type === "bedroom" &&
                !canAccess
            ) {
                const { data: access } = await supabase
                    .from("house_room_access")
                    .select("id")
                    .eq("room_id", roomId)
                    .eq("user_id", userId)
                    .maybeSingle();

                if (access) {
                    canAccess = true;
                }
            }
        }


        res.json({
            house: house,

            houseType: houseType,

            room: room,

            bedroomOwner: bedroomOwner,

            membership: membership,

            canAccess: canAccess,

            canManageAccess: canManageAccess
        });

    } catch (err) {
        console.error("GET room error:", err);

        res.status(500).json({
            error: "Server error."
        });
    }
});


// ============================================================
// GET ROOM MESSAGES
// ============================================================

app.get(
    "/api/houses/:houseId/rooms/:roomId/messages",
    async (req, res) => {

        const userId = requireHouseLogin(req, res);

        if (!userId) return;

        const houseId = Number(req.params.houseId);
        const roomId = Number(req.params.roomId);

        if (
            !Number.isInteger(houseId) ||
            !Number.isInteger(roomId)
        ) {
            return res.status(400).json({
                error: "Invalid House or room ID."
            });
        }

        try {

            const membership = await getHouseMembership(
                houseId,
                userId
            );

            if (!membership) {
                return res.status(403).json({
                    error: "You are not a member of this House."
                });
            }

            const { data: room, error: roomError } = await supabase
                .from("house_rooms")
                .select(
                    "id, house_id, room_type, user_id"
                )
                .eq("id", roomId)
                .eq("house_id", houseId)
                .maybeSingle();

            if (roomError || !room) {
                return res.status(404).json({
                    error: "Room not found."
                });
            }


            // Bedroom access.
            if (room.room_type === "bedroom") {

                let allowed =
                    membership.role === "owner" ||
                    membership.role === "admin" ||
                    room.user_id === userId;

                if (!allowed) {
                    const { data: access } = await supabase
                        .from("house_room_access")
                        .select("id")
                        .eq("room_id", roomId)
                        .eq("user_id", userId)
                        .maybeSingle();

                    allowed = !!access;
                }

                if (!allowed) {
                    return res.status(403).json({
                        error: "You do not have access to this bedroom."
                    });
                }
            }


            const { data: messages, error } = await supabase
                .from("house_room_messages")
                .select(
                    "id, room_id, user_id, message, created_at"
                )
                .eq("room_id", roomId)
                .order("created_at", {
                    ascending: true
                })
                .limit(200);

            if (error) {
                console.error("Room messages:", error);

                return res.status(500).json({
                    error: "Failed to load messages."
                });
            }


            const rows = messages || [];

            const userIds = [
                ...new Set(
                    rows
                        .map(m => m.user_id)
                        .filter(Boolean)
                )
            ];

            let profiles = [];

            if (userIds.length > 0) {
                const { data } = await supabase
                    .from("profiles")
                    .select(
                        "id, username, display_name, avatar_url"
                    )
                    .in("id", userIds);

                profiles = data || [];
            }

            const profileMap = new Map(
                profiles.map(p => [p.id, p])
            );

            res.json({
                messages: rows.map(message => ({
                    ...message,
                    user:
                        profileMap.get(message.user_id) ||
                        null
                }))
            });

        } catch (err) {
            console.error("GET room messages error:", err);

            res.status(500).json({
                error: "Server error."
            });
        }
    }
);


// ============================================================
// SEND ROOM MESSAGE
// ============================================================

app.post(
    "/api/houses/:houseId/rooms/:roomId/messages",
    async (req, res) => {

        const userId = requireHouseLogin(req, res);

        if (!userId) return;

        const houseId = Number(req.params.houseId);
        const roomId = Number(req.params.roomId);

        if (
            !Number.isInteger(houseId) ||
            !Number.isInteger(roomId)
        ) {
            return res.status(400).json({
                error: "Invalid House or room ID."
            });
        }

        try {

            const message = String(
                req.body.message || ""
            ).trim();

            if (!message) {
                return res.status(400).json({
                    error: "Message cannot be empty."
                });
            }

            if (message.length > 5000) {
                return res.status(400).json({
                    error: "Message is too long."
                });
            }


            const membership = await getHouseMembership(
                houseId,
                userId
            );

            if (!membership) {
                return res.status(403).json({
                    error: "You are not a member of this House."
                });
            }


            const { data: room, error: roomError } = await supabase
                .from("house_rooms")
                .select(
                    "id, house_id, room_type, user_id"
                )
                .eq("id", roomId)
                .eq("house_id", houseId)
                .maybeSingle();

            if (roomError || !room) {
                return res.status(404).json({
                    error: "Room not found."
                });
            }


            // Bedroom permissions.
            if (room.room_type === "bedroom") {

                let allowed =
                    membership.role === "owner" ||
                    membership.role === "admin" ||
                    room.user_id === userId;

                if (!allowed) {
                    const { data: access } = await supabase
                        .from("house_room_access")
                        .select("id")
                        .eq("room_id", roomId)
                        .eq("user_id", userId)
                        .maybeSingle();

                    allowed = !!access;
                }

                if (!allowed) {
                    return res.status(403).json({
                        error: "You do not have access to this bedroom."
                    });
                }
            }


            const { data, error } = await supabase
                .from("house_room_messages")
                .insert({
                    room_id: roomId,
                    user_id: userId,
                    message: message
                })
                .select(
                    "id, room_id, user_id, message, created_at"
                )
                .single();

            if (error) {
                console.error("Send room message:", error);

                return res.status(500).json({
                    error: "Failed to send message."
                });
            }

            res.status(201).json({
                success: true,
                message: {
                    ...data,
                    user: await getHouseProfile(userId)
                }
            });

        } catch (err) {
            console.error("POST room message error:", err);

            res.status(500).json({
                error: "Server error."
            });
        }
    }
);


// ============================================================
// GRANT BEDROOM ACCESS
// ============================================================

app.post(
    "/api/houses/:houseId/rooms/:roomId/access",
    async (req, res) => {

        const userId = requireHouseLogin(req, res);

        if (!userId) return;

        const houseId = Number(req.params.houseId);
        const roomId = Number(req.params.roomId);

        if (
            !Number.isInteger(houseId) ||
            !Number.isInteger(roomId)
        ) {
            return res.status(400).json({
                error: "Invalid House or room ID."
            });
        }

        try {

            const manager = await isHouseManager(
                houseId,
                userId
            );

            if (!manager) {
                return res.status(403).json({
                    error: "You do not have permission to manage room access."
                });
            }

            const targetUserId = String(
                req.body.userId || ""
            ).trim();

            if (!targetUserId) {
                return res.status(400).json({
                    error: "User ID is required."
                });
            }


            const { data: room, error: roomError } = await supabase
                .from("house_rooms")
                .select(
                    "id, house_id, room_type"
                )
                .eq("id", roomId)
                .eq("house_id", houseId)
                .maybeSingle();

            if (roomError || !room) {
                return res.status(404).json({
                    error: "Room not found."
                });
            }

            if (room.room_type !== "bedroom") {
                return res.status(400).json({
                    error: "Only bedrooms can have restricted access."
                });
            }


            const member = await getHouseMembership(
                houseId,
                targetUserId
            );

            if (!member) {
                return res.status(400).json({
                    error: "That user is not a member of this House."
                });
            }


            const { error } = await supabase
                .from("house_room_access")
                .upsert(
                    {
                        room_id: roomId,
                        user_id: targetUserId
                    },
                    {
                        onConflict: "room_id,user_id"
                    }
                );

            if (error) {
                console.error("Grant room access:", error);

                return res.status(500).json({
                    error: "Failed to grant room access."
                });
            }

            res.json({
                success: true
            });

        } catch (err) {
            console.error("Grant access error:", err);

            res.status(500).json({
                error: "Server error."
            });
        }
    }
);


// ============================================================
// REMOVE BEDROOM ACCESS
// ============================================================

app.delete(
    "/api/houses/:houseId/rooms/:roomId/access/:userId",
    async (req, res) => {

        const userId = requireHouseLogin(req, res);

        if (!userId) return;

        const houseId = Number(req.params.houseId);
        const roomId = Number(req.params.roomId);
        const targetUserId = String(
            req.params.userId || ""
        ).trim();

        if (
            !Number.isInteger(houseId) ||
            !Number.isInteger(roomId)
        ) {
            return res.status(400).json({
                error: "Invalid House or room ID."
            });
        }

        try {

            const manager = await isHouseManager(
                houseId,
                userId
            );

            if (!manager) {
                return res.status(403).json({
                    error: "You do not have permission to manage room access."
                });
            }

            const { error } = await supabase
                .from("house_room_access")
                .delete()
                .eq("room_id", roomId)
                .eq("user_id", targetUserId);

            if (error) {
                console.error("Remove room access:", error);

                return res.status(500).json({
                    error: "Failed to remove room access."
                });
            }

            res.json({
                success: true
            });

        } catch (err) {
            console.error("Remove room access error:", err);

            res.status(500).json({
                error: "Server error."
            });
        }
    }
);


// ============================================================
// GET BEDROOM ACCESS
// ============================================================

app.get(
    "/api/houses/:houseId/rooms/:roomId/access",
    async (req, res) => {

        const userId = requireHouseLogin(req, res);

        if (!userId) return;

        const houseId = Number(req.params.houseId);
        const roomId = Number(req.params.roomId);

        if (
            !Number.isInteger(houseId) ||
            !Number.isInteger(roomId)
        ) {
            return res.status(400).json({
                error: "Invalid House or room ID."
            });
        }

        try {

            const manager = await isHouseManager(
                houseId,
                userId
            );

            if (!manager) {
                return res.status(403).json({
                    error: "You do not have permission to view room access."
                });
            }

            const { data, error } = await supabase
                .from("house_room_access")
                .select(
                    "id, room_id, user_id, granted_at"
                )
                .eq("room_id", roomId)
                .order("granted_at", {
                    ascending: true
                });

            if (error) {
                console.error("Get room access:", error);

                return res.status(500).json({
                    error: "Failed to load room access."
                });
            }

            const rows = data || [];

            const userIds = [
                ...new Set(
                    rows.map(row => row.user_id)
                )
            ];

            let profiles = [];

            if (userIds.length > 0) {
                const { data: profileData } = await supabase
                    .from("profiles")
                    .select(
                        "id, username, display_name, avatar_url"
                    )
                    .in("id", userIds);

                profiles = profileData || [];
            }

            const profileMap = new Map(
                profiles.map(p => [p.id, p])
            );

            res.json({
                access: rows.map(row => ({
                    ...row,
                    user:
                        profileMap.get(row.user_id) ||
                        null
                }))
            });

        } catch (err) {
            console.error("Get room access error:", err);

            res.status(500).json({
                error: "Server error."
            });
        }
    }
);


// ============================================================
// LEAVE HOUSE
// ============================================================

app.delete("/api/houses/:id/leave", async (req, res) => {
    const userId = requireHouseLogin(req, res);

    if (!userId) return;

    const houseId = getHouseId(req, res);

    if (houseId === null) return;

    try {

        const { data: house, error: houseError } = await supabase
            .from("houses")
            .select("id, owner_id")
            .eq("id", houseId)
            .maybeSingle();

        if (houseError || !house) {
            return res.status(404).json({
                error: "House not found."
            });
        }

        if (house.owner_id === userId) {
            return res.status(400).json({
                error: "The House owner cannot leave their own House."
            });
        }

        const { error } = await supabase
            .from("house_members")
            .delete()
            .eq("house_id", houseId)
            .eq("user_id", userId);

        if (error) {
            console.error("Leave House:", error);

            return res.status(500).json({
                error: "Failed to leave House."
            });
        }

        res.json({
            success: true
        });

    } catch (err) {
        console.error("Leave House error:", err);

        res.status(500).json({
            error: "Server error."
        });
    }
});



// ==================================================
// START
// ==================================================


app.listen(PORT, () => {

    console.log(
        `🧌 ShrekBook server running on port ${PORT}`
    );

});