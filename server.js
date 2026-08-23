
require("dotenv").config();

const express = require("express");
const path = require("path");
const http = require("http");
const session = require("express-session");
const WebSocket = require("ws");
const { createClient } = require("@supabase/supabase-js");

const OpenAI = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});
const app = express();

const PORT =
    process.env.PORT || 3000;

/* ==================================================
   SHREKSEARCH
================================================== */

app.get("/api/shreksearch", async (req, res) => {

    try {

        const query =
            String(req.query.q || "").trim();


        if (!query) {

            return res.status(400).json({
                error: "Search query is required."
            });

        }


        if (query.length > 200) {

            return res.status(400).json({
                error: "Search query is too long."
            });

        }


        /*
         * ==============================================
         * SEARCH WIKIPEDIA
         * ==============================================
         */

        const searchUrl =
            "https://en.wikipedia.org/w/rest.php/v1/search/page?q=" +
            encodeURIComponent(query) +
            "&limit=1";


        const searchResponse =
            await fetch(searchUrl);


        if (!searchResponse.ok) {

            throw new Error(
                "Wikipedia search failed."
            );

        }


        const searchData =
            await searchResponse.json();


        if (
            !searchData.pages ||
            !searchData.pages.length
        ) {

            return res.status(404).json({
                error:
                    "No Wikipedia article was found."
            });

        }


        const page =
            searchData.pages[0];


        const title =
            page.title;


        /*
         * ==============================================
         * GET WIKIPEDIA FIRST PARAGRAPH
         * ==============================================
         */

        const summaryUrl =
            "https://en.wikipedia.org/api/rest_v1/page/summary/" +
            encodeURIComponent(
                title.replace(/ /g, "_")
            );


        const summaryResponse =
            await fetch(summaryUrl);


        if (!summaryResponse.ok) {

            throw new Error(
                "Could not retrieve Wikipedia article."
            );

        }


        const summaryData =
            await summaryResponse.json();


        const wikipediaText =
            summaryData.extract ||
            page.excerpt ||
            "No Wikipedia summary available.";


        const wikipediaUrl =
            summaryData.content_urls?.desktop?.page ||
            `https://en.wikipedia.org/wiki/${encodeURIComponent(
                title.replace(/ /g, "_")
            )}`;


        /*
         * ==============================================
         * AI SUMMARY
         * ==============================================
         */

        let aiSummary =
            "AI summary unavailable.";


        if (process.env.OPENAI_API_KEY) {

            const aiResponse =
                await openai.responses.create({

                    model: "gpt-5.6",

                    input: `
You are ShrekSearch's summarizer.

Summarize the following Wikipedia introduction
in simple, accurate language.

Do not invent information.

Keep it to 2-4 sentences.

Wikipedia introduction:

${wikipediaText}
                    `.trim()

                });


            aiSummary =
                aiResponse.output_text ||
                "AI summary unavailable.";

        }


        /*
         * ==============================================
         * SEND RESULT
         * ==============================================
         */

        res.json({

            title: title,

            wikipedia: wikipediaText,

            wikipediaUrl: wikipediaUrl,

            aiSummary: aiSummary

        });


    } catch (error) {

        console.error(
            "SHREKSEARCH ERROR:",
            error
        );


        res.status(500).json({

            error:
                error.message ||
                "ShrekSearch failed."

        });

    }

});
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


// ==================================================
// INSTANT MODERATION WEBSOCKET
// ==================================================

const server =
    http.createServer(app);


const wss =
    new WebSocket.Server({

        server,

        path:
            "/moderation"

    });


// ==================================================
// CONNECTED USERS
// ==================================================
//
// userId -> Set of WebSocket connections
//
// Multiple tabs are supported.
//

const moderationSockets =
    new Map();


// ==================================================
// ADD SOCKET
// ==================================================

function addModerationSocket(
    userId,
    socket
) {

    if (
        !moderationSockets.has(
            userId
        )
    ) {

        moderationSockets.set(
            userId,
            new Set()
        );

    }


    moderationSockets
        .get(userId)
        .add(socket);

}


// ==================================================
// REMOVE SOCKET
// ==================================================

function removeModerationSocket(
    userId,
    socket
) {

    const sockets =
        moderationSockets.get(
            userId
        );


    if (!sockets) {
        return;
    }


    sockets.delete(
        socket
    );


    if (
        sockets.size === 0
    ) {

        moderationSockets.delete(
            userId
        );

    }

}


// ==================================================
// SEND MODERATION EVENT
// ==================================================

function sendModerationEvent(
    userId,
    type
) {

    const sockets =
        moderationSockets.get(
            userId
        );


    if (!sockets) {

        console.log(
            `⚠️ No active socket for user ${userId}`
        );

        return;

    }


    const message =
        JSON.stringify({

            type

        });


    for (
        const socket
        of sockets
    ) {

        if (
            socket.readyState ===
            WebSocket.OPEN
        ) {

            socket.send(
                message
            );

            console.log(
                `📡 Sent ${type} to ${userId}`
            );

        }

    }

}

/* ==================================================
   ONLINE STATUS
================================================== */

app.post("/api/online", async (req, res) => {

    try {

        if (!req.session || !req.session.userId) {

            return res.status(401).json({
                error: "Not logged in."
            });

        }

        const userId =
            req.session.userId;


        const { error } =
            await supabase
                .from("profiles")
                .update({
                    last_seen: new Date().toISOString()
                })
                .eq("id", userId);


        if (error) {

            console.error(
                "ONLINE STATUS SUPABASE ERROR:",
                error
            );

            return res.status(500).json({
                error: "Could not update online status."
            });

        }


        res.json({
            success: true
        });


    } catch (error) {

        console.error(
            "ONLINE STATUS ERROR:",
            error
        );

        res.status(500).json({
            error: "Could not update online status."
        });

    }

});
// ==================================================
// WEBSOCKET CONNECTION
// ==================================================

wss.on(
    "connection",
    async (
        socket,
        req
    ) => {

        try {

            console.log(
                "🔌 Moderation WebSocket connected."
            );


            // ==========================================
            // GET SESSION COOKIE
            // ==========================================

            const cookieHeader =
                req.headers.cookie || "";


            const sessionCookie =
                cookieHeader
                    .split(";")
                    .map(
                        item =>
                            item.trim()
                    )
                    .find(
                        item =>
                            item.startsWith(
                                "connect.sid="
                            )
                    );


            if (!sessionCookie) {

                console.log(
                    "❌ WebSocket has no session cookie."
                );


                socket.close(
                    1008,
                    "Not logged in."
                );

                return;

            }


            // ==========================================
            // EXTRACT SESSION ID
            // ==========================================

            const rawCookie =
                decodeURIComponent(
                    sessionCookie
                        .substring(
                            "connect.sid=".length
                        )
                );


            let sessionValue =
                rawCookie;


            if (
                sessionValue.startsWith(
                    "s:"
                )
            ) {

                sessionValue =
                    sessionValue.substring(
                        2
                    );

            }


            const sessionId =
                sessionValue.split(
                    "."
                )[0];


            if (!sessionId) {

                socket.close(
                    1008,
                    "Invalid session."
                );

                return;

            }


            // ==========================================
            // LOAD EXPRESS SESSION
            // ==========================================

            sessionStore.get(
                sessionId,
                async (
                    error,
                    storedSession
                ) => {

                    if (error) {

                        console.error(
                            "SESSION LOOKUP ERROR:",
                            error
                        );


                        socket.close(
                            1011,
                            "Session error."
                        );

                        return;

                    }


                    if (!storedSession) {

                        console.log(
                            "❌ WebSocket session not found."
                        );


                        socket.close(
                            1008,
                            "Invalid session."
                        );

                        return;

                    }


                    const userId =
                        storedSession
                            .user
                            ?.id;


                    if (!userId) {

                        console.log(
                            "❌ WebSocket session has no user."
                        );


                        socket.close(
                            1008,
                            "Not logged in."
                        );

                        return;

                    }


                    // ==================================
                    // REGISTER SOCKET
                    // ==================================

                    socket.userId =
                        userId;


                    addModerationSocket(
                        userId,
                        socket
                    );


                    console.log(
                        `🟢 Moderation connected for user ${userId}`
                    );


                    // ==================================
                    // CHECK CURRENT MODERATION STATE
                    // ==================================

                    const {
                        data: profile,
                        error: profileError
                    } =
                        await supabase
                            .from("profiles")
                            .select(
                                "banned, kicked"
                            )
                            .eq(
                                "id",
                                userId
                            )
                            .maybeSingle();


                    if (profileError) {

                        console.error(
                            "MODERATION PROFILE ERROR:",
                            profileError
                        );

                        return;

                    }


                    // ==================================
                    // ALREADY BANNED
                    // ==================================

                    if (
                        profile?.banned ===
                        true
                    ) {

                        socket.send(
                            JSON.stringify({
                                type:
                                    "BAN"
                            })
                        );

                    }


                    // ==================================
                    // ALREADY KICKED
                    // ==================================

                    else if (
                        profile?.kicked ===
                        true
                    ) {

                        socket.send(
                            JSON.stringify({
                                type:
                                    "KICK"
                            })
                        );

                    }

                }
            );


            // ==========================================
            // SOCKET CLOSED
            // ==========================================

            socket.on(
                "close",
                () => {

                    console.log(
                        `🔌 Moderation disconnected for user ${socket.userId || "unknown"}`
                    );


                    if (
                        socket.userId
                    ) {

                        removeModerationSocket(
                            socket.userId,
                            socket
                        );

                    }

                }
            );


            socket.on(
                "error",
                error => {

                    console.error(
                        "MODERATION SOCKET ERROR:",
                        error
                    );

                }
            );


        }

        catch (error) {

            console.error(
                "MODERATION WEBSOCKET ERROR:",
                error
            );


            socket.close(
                1011,
                "Server error."
            );

        }

    }
);


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
// ==================================================
// ADMIN AUTH
// ==================================================

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
        //
        // This is your restored email-ban system.
        // It happens BEFORE Supabase authentication.
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
        //
        // This checks your account/user ban system.
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


            // Find an unused username.

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


            // Create the profile.

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
                            false

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

        }


        // ==========================================
        // CHECK PROFILE BAN
        //
        // Your ADMIN BAN button sets:
        //
        // banned = true
        //
        // So this prevents those accounts from
        // logging in.
        // ==========================================

        if (profile.banned === true) {

            return res.status(403).json({

                error:
                    "Your account has been banned from ShrekBook."

            });

        }


        // ==========================================
        // CHECK PROFILE ACTIVE STATUS
        //
        // Kicked users have:
        //
        // is_active = false
        //
        // They cannot log back in until the account
        // is made active again.
        // ==========================================

        if (profile.is_active === false) {

            return res.status(403).json({

                error:
                    "Your ShrekBook account is currently inactive."

            });

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
                    "id, username, display_name, avatar, role, banned, kicked"
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
                    "id, username, role, banned"
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
                        "You cannot unban yourself."
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
                        "You cannot unban this user."
                });

            }


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

                return res.status(500).json({
                    error:
                        updateError.message
                });

            }


            res.json({
                success: true,
                banned: false
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


// ==================================================
// START
// ==================================================


server.listen(
    PORT,
    () => {

        console.log(
            `ShrekBook running on port ${PORT}`
        );

        console.log(
            `Moderation WebSocket: /moderation`
        );

    }
);

