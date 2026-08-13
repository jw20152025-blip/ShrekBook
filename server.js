console.log("🔥 THIS IS MY CURRENT SERVER.JS");

const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const session = require("express-session");

require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;

// ==================================================
// ENVIRONMENT
// ==================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing Supabase environment variables.");
    console.error("SUPABASE_URL");
    console.error("SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

if (!SESSION_SECRET) {
    console.error("❌ Missing SESSION_SECRET.");
    process.exit(1);
}

// ==================================================
// SUPABASE
// ==================================================

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
);

// ==================================================
// EXPRESS
// ==================================================

app.set("trust proxy", 1);

app.use(express.json({ limit: "10mb" }));

app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

// ==================================================
// SESSION
// ==================================================

app.use(
    session({
        secret: SESSION_SECRET,

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,

            secure:
                process.env.NODE_ENV === "production",

            sameSite: "lax",

            maxAge:
                1000 *
                60 *
                60 *
                24 *
                30
        }
    })
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

// ==================================================
// HEALTH
// ==================================================

app.get("/api/health", (req, res) => {

    res.json({
        ok: true,
        loggedIn: !!req.session.user
    });

});

// ==================================================
// SIGN UP
// ==================================================

app.post("/api/signup", async (req, res) => {

    try {

        const {
            email,
            password,
            username,
            display_name,
            displayName,
            avatar
        } = req.body;

        const finalDisplayName =
            display_name ||
            displayName ||
            username;

        if (
            !email ||
            !password ||
            !username
        ) {

            return res.status(400).json({
                error:
                    "Email, password, and username are required."
            });

        }

        // Check username first

        const {
            data: existingProfile,
            error: usernameError
        } = await supabase
            .from("profiles")
            .select("id")
            .eq("username", username)
            .maybeSingle();

        if (usernameError) {

            console.error(
                "USERNAME CHECK ERROR:",
                usernameError
            );

            return res.status(500).json({
                error: usernameError.message
            });

        }

        if (existingProfile) {

            return res.status(400).json({
                error:
                    "That username is already taken."
            });

        }

        // Create Auth user

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

            console.error(
                "AUTH SIGNUP ERROR:",
                authError
            );

            return res.status(400).json({
                error: authError.message
            });

        }

        const userId =
            authData.user.id;

        // Create profile

        const {
            data: profile,
            error: profileError
        } =
            await supabase
                .from("profiles")
                .insert({
                    id: userId,

                    username,

                    display_name:
                        finalDisplayName,

                    avatar:
                        avatar || null,

                    bio: "",

                    gyatt: 0,

                    cat: 0,

                    ogred: 0
                })
                .select()
                .single();

        if (profileError) {

            console.error(
                "PROFILE SIGNUP ERROR:",
                profileError
            );

            await supabase.auth.admin.deleteUser(
                userId
            );

            return res.status(500).json({
                error:
                    profileError.message
            });

        }

        // Automatically log them in

        req.session.user = {
            id: profile.id,

            username:
                profile.username,

            display_name:
                profile.display_name
        };

        req.session.save(error => {

            if (error) {

                console.error(
                    "SIGNUP SESSION ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        "Account created, but session could not be saved."
                });

            }

            res.status(201).json({
                success: true,

                user: profile
            });

        });

    } catch (error) {

        console.error(
            "SIGNUP SERVER ERROR:",
            error
        );

        res.status(500).json({
            error: error.message
        });

    }

});

// ==================================================
// LOGIN
// ==================================================

app.post("/api/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        if (!email || !password) {

            return res.status(400).json({
                error:
                    "Email and password are required."
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

        const user =
            authData.user;

        // Find profile

        const {
            data: profile,
            error: profileError
        } =
            await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .maybeSingle();

        if (profileError) {

            console.error(
                "PROFILE LOOKUP ERROR:",
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
                    "Your login account exists, but your ShrekBook profile does not."
            });

        }

        // Create session

        req.session.user = {
            id: profile.id,

            username:
                profile.username,

            display_name:
                profile.display_name
        };

        req.session.save(error => {

            if (error) {

                console.error(
                    "SESSION SAVE ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        "Login succeeded but session could not be saved."
                });

            }

            res.json({
                success: true,

                user: profile
            });

        });

    } catch (error) {

        console.error(
            "LOGIN SERVER ERROR:",
            error
        );

        res.status(500).json({
            error: error.message
        });

    }

});

// ==================================================
// LOGOUT
// ==================================================

app.post("/api/logout", (req, res) => {

    req.session.destroy(error => {

        if (error) {

            console.error(
                "LOGOUT ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    "Logout failed."
            });

        }

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
        } =
            await supabase
                .from("profiles")
                .select("*")
                .eq(
                    "id",
                    req.session.user.id
                )
                .maybeSingle();

        if (error) {

            return res.status(500).json({
                error:
                    error.message
            });

        }

        if (!data) {

            return res.json({
                loggedIn: false
            });

        }

        res.json({

            loggedIn: true,

            user: data

        });

    } catch (error) {

        res.status(500).json({
            error:
                error.message
        });

    }

});

// ==================================================
// GET ALL USERS
// ==================================================

app.get("/api/users", async (req, res) => {

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
                    bio,
                    gyatt,
                    cat,
                    ogred,
                    created_at
                `)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );

        if (error) {

            console.error(
                "USERS ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    error.message
            });

        }

        res.json(data || []);

    } catch (error) {

        console.error(
            "USERS SERVER ERROR:",
            error
        );

        res.status(500).json({
            error:
                error.message
        });

    }

});

// ==================================================
// GET ONE USER
// ==================================================

app.get("/api/users/:id", async (req, res) => {

    try {

        const id =
            req.params.id;

        const {
            data: profile,
            error: profileError
        } =
            await supabase
                .from("profiles")
                .select("*")
                .eq("id", id)
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

        // Get their posts

        const {
            data: posts,
            error: postsError
        } =
            await supabase
                .from("posts")
                .select("*")
                .eq("user_id", id)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );

        if (postsError) {

            console.error(
                "PROFILE POSTS ERROR:",
                postsError
            );

            return res.status(500).json({
                error:
                    postsError.message
            });

        }

        res.json({

            ...profile,

            posts:
                posts || []

        });

    } catch (error) {

        console.error(
            "PROFILE SERVER ERROR:",
            error
        );

        res.status(500).json({
            error:
                error.message
        });

    }

});

// ==================================================
// UPDATE PROFILE
// ==================================================

app.put("/api/profile", async (req, res) => {

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
            display_name,
            bio,
            avatar,
            gyatt,
            cat,
            ogred
        } = req.body;

        const {
            data,
            error
        } =
            await supabase
                .from("profiles")
                .update({

                    display_name:
                        String(
                            display_name || ""
                        ).trim(),

                    bio:
                        String(
                            bio || ""
                        ).trim(),

                    avatar:
                        avatar || null,

                    gyatt:
                        Math.max(
                            0,
                            parseInt(gyatt) || 0
                        ),

                    cat:
                        Math.max(
                            0,
                            parseInt(cat) || 0
                        ),

                    ogred:
                        Math.max(
                            0,
                            parseInt(ogred) || 0
                        )

                })
                .eq(
                    "id",
                    userId
                )
                .select()
                .single();

        if (error) {

            console.error(
                "PROFILE UPDATE ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    error.message
            });

        }

        req.session.user.display_name =
            data.display_name;

        res.json({

            success: true,

            user: data

        });

    } catch (error) {

        console.error(
            "PROFILE UPDATE SERVER ERROR:",
            error
        );

        res.status(500).json({
            error:
                error.message
        });

    }

});

// ==================================================
// AVATAR UPLOAD
// ==================================================

app.post("/api/profile/avatar", async (req, res) => {

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
            !fileType.startsWith("image/")
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

        const storagePath =
            `${req.session.user.id}/${Date.now()}.${extension}`;

        const {
            error: uploadError
        } =
            await supabase.storage
                .from("avatars")
                .upload(
                    storagePath,
                    buffer,
                    {
                        contentType:
                            fileType,

                        upsert: true
                    }
                );

        if (uploadError) {

            console.error(
                "AVATAR UPLOAD ERROR:",
                uploadError
            );

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
                    storagePath
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

            user:
                profile

        });

    } catch (error) {

        console.error(
            "AVATAR SERVER ERROR:",
            error
        );

        res.status(500).json({
            error:
                error.message
        });

    }

});

// ==================================================
// GET POSTS
// ==================================================

app.get("/api/posts", async (req, res) => {

    try {

        const {
            data: posts,
            error
        } =
            await supabase
                .from("posts")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: false
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
            const post of posts || []
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
                        post.user_id
                    )
                    .maybeSingle();

            result.push({

                ...post,

                username:
                    profile?.username ||
                    "Unknown",

                display_name:
                    profile?.display_name ||
                    "Unknown",

                avatar:
                    profile?.avatar ||
                    null

            });

        }

        res.json(result);

    } catch (error) {

        console.error(
            "POSTS ERROR:",
            error
        );

        res.status(500).json({
            error:
                error.message
        });

    }

});

// ==================================================
// CREATE POST
// ==================================================

app.post("/api/posts", async (req, res) => {

    try {

        if (!req.session.user) {

            return res.status(401).json({
                error:
                    "You must be logged in."
            });

        }

        const content =
            String(
                req.body.content || ""
            ).trim();

        if (!content) {

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

                    content

                })
                .select()
                .single();

        if (error) {

            console.error(
                "POST CREATE ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    error.message
            });

        }

        res.status(201).json(data);

    } catch (error) {

        console.error(
            "POST SERVER ERROR:",
            error
        );

        res.status(500).json({
            error:
                error.message
        });

    }

});

// ==================================================
// GET COMMENTS
// ==================================================

app.get(
    "/api/posts/:postId/comments",
    async (req, res) => {

        try {

            const postId =
                req.params.postId;

            const {
                data: comments,
                error
            } =
                await supabase
                    .from("comments")
                    .select("*")
                    .eq(
                        "post_id",
                        postId
                    )
                    .order(
                        "created_at",
                        {
                            ascending: true
                        }
                    );

            if (error) {

                console.error(
                    "COMMENTS LOAD ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });

            }

            res.json(
                comments || []
            );

        } catch (error) {

            console.error(
                "COMMENTS SERVER ERROR:",
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
// CREATE COMMENT
// ==================================================

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

            const postId =
                req.params.postId;

            const content =
                String(
                    req.body.content || ""
                ).trim();

            if (!content) {

                return res.status(400).json({
                    error:
                        "Comment cannot be empty."
                });

            }

            // Make sure the post exists

            const {
                data: post,
                error: postError
            } =
                await supabase
                    .from("posts")
                    .select("id")
                    .eq(
                        "id",
                        postId
                    )
                    .maybeSingle();

            if (postError) {

                return res.status(500).json({
                    error:
                        postError.message
                });

            }

            if (!post) {

                return res.status(404).json({
                    error:
                        "Post not found."
                });

            }

            const {
                data: comment,
                error
            } =
                await supabase
                    .from("comments")
                    .insert({

                        post_id:
                            postId,

                        user_id:
                            req.session.user.id,

                        content

                    })
                    .select()
                    .single();

            if (error) {

                console.error(
                    "COMMENT CREATE ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });

            }

            res.status(201).json(
                comment
            );

        } catch (error) {

            console.error(
                "COMMENT SERVER ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);
// ========================================
// SHREKCHAT - GET ROOMS
// ========================================

app.get("/api/chat/rooms", async (req, res) => {

    try {

        const { data, error } = await supabase
            .from("chat_rooms")
            .select("*")
            .order("created_at", {
                ascending: true
            });

        if (error) {
            console.error("CHAT ROOMS ERROR:", error);

            return res.status(500).json({
                error: error.message
            });
        }

        res.json(data || []);

    } catch (error) {

        console.error("CHAT ROOMS SERVER ERROR:", error);

        res.status(500).json({
            error: error.message
        });

    }

});


// ========================================
// SHREKCHAT - CREATE ROOM
// ========================================

app.post("/api/chat/rooms", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({
                error: "You must be logged in."
            });
        }

        const name = String(
            req.body.name || ""
        ).trim();

        if (!name) {
            return res.status(400).json({
                error: "Room name cannot be empty."
            });
        }

        if (name.length > 50) {
            return res.status(400).json({
                error: "Room name must be 50 characters or less."
            });
        }

        const { data, error } = await supabase
            .from("chat_rooms")
            .insert({
                name: name
            })
            .select()
            .single();

        if (error) {

            console.error(
                "CREATE ROOM ERROR:",
                error
            );

            return res.status(400).json({
                error: error.message
            });

        }

        res.status(201).json(data);

    } catch (error) {

        console.error(
            "CREATE ROOM SERVER ERROR:",
            error
        );

        res.status(500).json({
            error: error.message
        });

    }

});


// ========================================
// SHREKCHAT - GET MESSAGES
// ========================================

app.get(
    "/api/chat/rooms/:roomId/messages",
    async (req, res) => {

        try {

            const roomId =
                req.params.roomId;

            const {
                data,
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
                );

            if (error) {

                console.error(
                    "MESSAGES LOAD ERROR:",
                    error
                );

                return res.status(500).json({
                    error: error.message
                });

            }

            // Get usernames separately.
            // No avatars are loaded.

            const messages =
                data || [];

            for (
                const message of messages
            ) {

                const {
                    data: profile
                } = await supabase
                    .from("profiles")
                    .select(
                        "username, display_name"
                    )
                    .eq(
                        "id",
                        message.user_id
                    )
                    .maybeSingle();

                message.username =
                    profile?.username ||
                    "Unknown";

                message.display_name =
                    profile?.display_name ||
                    "Unknown";

            }

            res.json(messages);

        } catch (error) {

            console.error(
                "MESSAGES SERVER ERROR:",
                error
            );

            res.status(500).json({
                error: error.message
            });

        }

    }
);


// ========================================
// SHREKCHAT - SEND MESSAGE
// ========================================

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

            const content =
                String(
                    req.body.content || ""
                ).trim();

            if (!content) {

                return res.status(400).json({
                    error:
                        "Message cannot be empty."
                });

            }

            if (content.length > 2000) {

                return res.status(400).json({
                    error:
                        "Message is too long."
                });

            }

            // Make sure the room exists

            const {
                data: room,
                error: roomError
            } = await supabase
                .from("chat_rooms")
                .select("id")
                .eq(
                    "id",
                    roomId
                )
                .maybeSingle();

            if (roomError) {

                return res.status(500).json({
                    error:
                        roomError.message
                });

            }

            if (!room) {

                return res.status(404).json({
                    error:
                        "Room not found."
                });

            }

            // Create message

            const {
                data: message,
                error
            } = await supabase
                .from("chat_messages")
                .insert({

                    room_id:
                        roomId,

                    user_id:
                        req.session.user.id,

                    content:
                        content

                })
                .select()
                .single();

            if (error) {

                console.error(
                    "SEND MESSAGE ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });

            }

            // Get sender name

            const {
                data: profile
            } = await supabase
                .from("profiles")
                .select(
                    "username, display_name"
                )
                .eq(
                    "id",
                    req.session.user.id
                )
                .maybeSingle();

            res.json({

                ...message,

                username:
                    profile?.username ||
                    "Unknown",

                display_name:
                    profile?.display_name ||
                    "Unknown"

            });

        } catch (error) {

            console.error(
                "SEND MESSAGE SERVER ERROR:",
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
// SERVER
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