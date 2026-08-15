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
            String(req.body.username || "").trim();

        const display_name =
            String(
                req.body.display_name || username
            ).trim();

        const email =
            String(req.body.email || "").trim();

        const password =
            String(req.body.password || "");

        if (!username || !email || !password) {
            return res.status(400).json({
                error:
                    "Username, email, and password are required."
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
                error: usernameError.message
            });
        }

        if (existing) {
            return res.status(400).json({
                error: "That username is already taken."
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
                error: authError.message
            });
        }

        const userId = authData.user.id;

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .insert({
                id: userId,
                username,
                display_name: display_name || username,
                avatar: null,
                bio: "",
                gyatt: 0,
                cat: 0,
                ogred: 0
            })
            .select()
            .single();

        if (profileError) {
            await supabase.auth.admin.deleteUser(userId);

            return res.status(500).json({
                error: profileError.message
            });
        }

        res.status(201).json({
            success: true,
            user: profile
        });

    } catch (error) {
        console.error("SIGNUP ERROR:", error);

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
            String(req.body.email || "").trim();

        const password =
            String(req.body.password || "");

        if (!email || !password) {
            return res.status(400).json({
                error:
                    "Email and password are required."
            });
        }

        const {
            data: authData,
            error: authError
        } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            return res.status(401).json({
                error: authError.message
            });
        }

        const authUser = authData.user;

        let {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", authUser.id)
            .maybeSingle();

        if (profileError) {
            return res.status(500).json({
                error: profileError.message
            });
        }

        // Create missing profile automatically
        if (!profile) {
            let username =
                (authUser.email || "user")
                    .split("@")[0]
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, "")
                    .slice(0, 20);

            if (!username) {
                username = "user";
            }

            const original = username;
            let number = 1;

            while (true) {
                const { data: taken } =
                    await supabase
                        .from("profiles")
                        .select("id")
                        .eq("username", username)
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
            } = await supabase
                .from("profiles")
                .insert({
                    id: authUser.id,
                    username,
                    display_name: username,
                    avatar: null,
                    bio: "",
                    gyatt: 0,
                    cat: 0,
                    ogred: 0
                })
                .select()
                .single();

            if (createError) {
                return res.status(500).json({
                    error: createError.message
                });
            }

            profile = created;
        }

        req.session.user = {
            id: profile.id,
            username: profile.username,
            display_name: profile.display_name
        };

        req.session.save(error => {
            if (error) {
                return res.status(500).json({
                    error:
                        "Could not save login session."
                });
            }

            res.json({
                success: true,
                user: profile
            });
        });

    } catch (error) {
        console.error("LOGIN ERROR:", error);

        res.status(500).json({
            error: "Server error."
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
                error: "Logout failed."
            });
        }

        res.clearCookie("connect.sid");

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
            .eq("id", req.session.user.id)
            .single();

        if (error || !data) {
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
            error: "Server error."
        });
    }
});

// ==================================================
// USERS
// ==================================================

app.get("/api/users", async (req, res) => {
    try {
        const { data: users, error: usersError } = await supabase
            .from("profiles")
            .select(`
                id,
                username,
                display_name,
                avatar,
                bio,
                created_at
            `)
            .order("created_at", {
                ascending: false
            });

        if (usersError) {
            return res.status(500).json({
                error: usersError.message
            });
        }

        const { data: reactions, error: reactionsError } =
            await supabase
                .from("reactions")
                .select(`
                    to_user_id,
                    type
                `);

        if (reactionsError) {
            return res.status(500).json({
                error: reactionsError.message
            });
        }

        const reactionCounts = {};

        for (const reaction of reactions || []) {
            const userId = reaction.to_user_id;

            if (!reactionCounts[userId]) {
                reactionCounts[userId] = {
                    gyatt: 0,
                    cat: 0,
                    ogred: 0
                };
            }

            if (reaction.type === "gyatt") {
                reactionCounts[userId].gyatt++;
            }

            if (reaction.type === "cat") {
                reactionCounts[userId].cat++;
            }

            if (reaction.type === "ogred") {
                reactionCounts[userId].ogred++;
            }
        }

        const result = (users || []).map(user => ({
            ...user,

            gyatt: reactionCounts[user.id]?.gyatt || 0,
            cat: reactionCounts[user.id]?.cat || 0,
            ogred: reactionCounts[user.id]?.ogred || 0
        }));

        res.json(result);

    } catch (error) {
        console.error("USERS ERROR:", error);

        res.status(500).json({
            error: "Server error."
        });
    }
});

// ==================================================
// ONE USER
// ==================================================

app.get("/api/users/:id", async (req, res) => {
    try {
        const id = req.params.id;

        if (!id) {
            return res.status(400).json({
                error: "No profile ID was provided."
            });
        }

        const {
            data: profile,
            error
        } = await supabase
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
            .eq("id", id)
            .single();

        if (error || !profile) {
            return res.status(404).json({
                error: "User not found."
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
                created_at
            `)
            .eq("user_id", id)
            .order("created_at", {
                ascending: false
            });

        if (postsError) {
            return res.status(500).json({
                error: postsError.message
            });
        }

        res.json({
            ...profile,
            posts: posts || []
        });

    } catch (error) {
        res.status(500).json({
            error: "Server error."
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
                error: "You must be logged in."
            });
        }

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
        } = await supabase
            .from("profiles")
            .update({
                display_name:
                    String(display_name || "").trim(),

                bio:
                    String(bio || "").trim(),

                avatar:
                    avatar || null,

                gyatt:
                    Math.max(0, parseInt(gyatt) || 0),

                cat:
                    Math.max(0, parseInt(cat) || 0),

                ogred:
                    Math.max(0, parseInt(ogred) || 0)
            })
            .eq("id", req.session.user.id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                error: error.message
            });
        }

        req.session.user.display_name =
            data.display_name;

        res.json({
            success: true,
            user: data
        });

    } catch (error) {
        res.status(500).json({
            error: "Server error."
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
                error: "You must be logged in."
            });
        }

        const {
            fileName,
            fileType,
            fileData
        } = req.body;

        if (!fileName || !fileType || !fileData) {
            return res.status(400).json({
                error: "Missing image data."
            });
        }

        if (!fileType.startsWith("image/")) {
            return res.status(400).json({
                error: "File must be an image."
            });
        }

        const buffer = Buffer.from(
            fileData,
            "base64"
        );

        if (buffer.length > 5 * 1024 * 1024) {
            return res.status(400).json({
                error: "Image must be under 5MB."
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

        if (!allowed.includes(extension)) {
            return res.status(400).json({
                error: "Unsupported image type."
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
                    contentType: fileType,
                    upsert: true
                }
            );

        if (uploadError) {
            return res.status(500).json({
                error: uploadError.message
            });
        }

        const {
            data: publicData
        } = supabase.storage
            .from("avatars")
            .getPublicUrl(filePath);

        const avatarUrl =
            publicData.publicUrl;

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .update({
                avatar: avatarUrl
            })
            .eq(
                "id",
                req.session.user.id
            )
            .select()
            .single();

        if (profileError) {
            return res.status(500).json({
                error: profileError.message
            });
        }

        res.json({
            success: true,
            avatar: avatarUrl,
            user: profile
        });

    } catch (error) {

        console.error(
            "AVATAR ERROR:",
            error
        );

        res.status(500).json({
            error: "Server error."
        });
    }
});

// ==================================================
// GENERIC IMAGE UPLOAD
// ==================================================

async function uploadImage(
    fileData,
    fileType,
    fileName,
    userId
) {

    if (!fileData || !fileType || !fileName) {
        throw new Error("Missing image data.");
    }

    if (!fileType.startsWith("image/")) {
        throw new Error("File must be an image.");
    }

    const buffer = Buffer.from(
        fileData,
        "base64"
    );

    if (buffer.length > 5 * 1024 * 1024) {
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

    if (!allowed.includes(extension)) {
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
                contentType: fileType,
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
        .getPublicUrl(filePath);

    return publicData.publicUrl;
}


// ==================================================
// GET POSTS
// ==================================================

app.get("/api/posts", async (req, res) => {

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
            .order("created_at", {
                ascending: false
            })
            .limit(100);

        if (error) {

            console.error(
                "GET POSTS ERROR:",
                error
            );

            return res.status(500).json({
                error: error.message
            });

        }

        const result = [];

        for (const post of posts || []) {

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
                    profile?.avatar ||
                    null

            });

        }

        res.json(result);

    } catch (error) {

        console.error(
            "GET POSTS ERROR:",
            error
        );

        res.status(500).json({
            error: "Server error."
        });

    }

});


// ==================================================
// POSTS
// ==================================================

app.post("/api/posts", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({
                error: "You must be logged in."
            });
        }

        const content =
            String(req.body.content || "").trim();

        if (content.length > 5000) {
            return res.status(400).json({
                error: "Post is too long."
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

                imageUrl = await uploadImage(
                    req.body.image.data,
                    req.body.image.type,
                    req.body.image.name,
                    req.session.user.id
                );

            } catch (error) {

                return res.status(400).json({
                    error: error.message
                });

            }
        }

        if (!content && !imageUrl) {
            return res.status(400).json({
                error: "Post cannot be empty."
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
                error: error.message
            });

        }

        res.status(201).json(data);

    } catch (error) {

        console.error(
            "CREATE POST ERROR:",
            error
        );

        res.status(500).json({
            error: "Server error."
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
                    created_at
                `)
                .eq(
                    "post_id",
                    req.params.postId
                )
                .order("created_at", {
                    ascending: true
                });

            if (error) {
                return res.status(500).json({
                    error: error.message
                });
            }

            const result = [];

            for (const comment of comments || []) {
                const {
                    data: profile
                } = await supabase
                    .from("profiles")
                    .select(
                        "username, display_name"
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
                        "User"
                });
            }

            res.json(result);

        } catch (error) {
            res.status(500).json({
                error: "Server error."
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
                    error: "You must be logged in."
                });
            }

            const content =
                String(
                    req.body.content || ""
                ).trim();

            if (content.length > 500) {
                return res.status(400).json({
                    error: "Comment is too long."
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
                        error: error.message
                    });

                }

            }

            if (!content && !imageUrl) {
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
                    error: error.message
                });

            }

            res.status(201).json(data);

        } catch (error) {

            console.error(
                "COMMENT ERROR:",
                error
            );

            res.status(500).json({
                error: "Server error."
            });

        }

    }
);
app.post("/api/users/:id/gyatt", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                error: "You must be logged in."
            });
        }

        const fromUserId =
            req.session.user.id;

        const toUserId =
            req.params.id;

        if (fromUserId === toUserId) {
            return res.status(400).json({
                error: "You cannot react to yourself."
            });
        }

        const {
            error: insertError
        } = await supabase
            .from("reactions")
            .insert({
                from_user_id: fromUserId,
                to_user_id: toUserId,
                type: "gyatt"
            });

        if (insertError) {

            if (
                insertError.code === "23505"
            ) {
                return res.status(400).json({
                    error:
                        "You already gave this person a Gyatt."
                });
            }

            return res.status(500).json({
                error: insertError.message
            });
        }

        const {
            count,
            error: countError
        } = await supabase
            .from("reactions")
            .select("*", {
                count: "exact",
                head: true
            })
            .eq("to_user_id", toUserId)
            .eq("type", "gyatt");

        if (countError) {
            return res.status(500).json({
                error: countError.message
            });
        }

        res.json({
            success: true,
            gyatt: count || 0
        });

    } catch (error) {

        console.error(
            "GYATT ERROR:",
            error
        );

        res.status(500).json({
            error: "Server error."
        });
    }
});
app.post("/api/users/:id/cat", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                error: "You must be logged in."
            });
        }

        const fromUserId =
            req.session.user.id;

        const toUserId =
            req.params.id;

        if (fromUserId === toUserId) {
            return res.status(400).json({
                error: "You cannot react to yourself."
            });
        }

        const {
            error: insertError
        } = await supabase
            .from("reactions")
            .insert({
                from_user_id: fromUserId,
                to_user_id: toUserId,
                type: "cat"
            });

        if (insertError) {

            if (
                insertError.code === "23505"
            ) {
                return res.status(400).json({
                    error:
                        "You already gave this person a Cat."
                });
            }

            return res.status(500).json({
                error: insertError.message
            });
        }

        const {
            count,
            error: countError
        } = await supabase
            .from("reactions")
            .select("*", {
                count: "exact",
                head: true
            })
            .eq("to_user_id", toUserId)
            .eq("type", "cat");

        if (countError) {
            return res.status(500).json({
                error: countError.message
            });
        }

        res.json({
            success: true,
            cat: count || 0
        });

    } catch (error) {

        console.error(
            "CAT ERROR:",
            error
        );

        res.status(500).json({
            error: "Server error."
        });
    }
});
app.post("/api/users/:id/gyatt", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                error: "You must be logged in."
            });
        }

        const fromUserId =
            req.session.user.id;

        const toUserId =
            req.params.id;

        if (fromUserId === toUserId) {
            return res.status(400).json({
                error: "You cannot react to yourself."
            });
        }

        const {
            error: insertError
        } = await supabase
            .from("reactions")
            .insert({
                from_user_id: fromUserId,
                to_user_id: toUserId,
                type: "gyatt"
            });

        if (insertError) {

            if (
                insertError.code === "23505"
            ) {
                return res.status(400).json({
                    error:
                        "You already gave this person a Gyatt."
                });
            }

            return res.status(500).json({
                error: insertError.message
            });
        }

        const {
            count,
            error: countError
        } = await supabase
            .from("reactions")
            .select("*", {
                count: "exact",
                head: true
            })
            .eq("to_user_id", toUserId)
            .eq("type", "gyatt");

        if (countError) {
            return res.status(500).json({
                error: countError.message
            });
        }

        res.json({
            success: true,
            gyatt: count || 0
        });

    } catch (error) {

        console.error(
            "GYATT ERROR:",
            error
        );

        res.status(500).json({
            error: "Server error."
        });
    }
});
app.post("/api/users/:id/ogred", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                error: "You must be logged in."
            });
        }

        const fromUserId =
            req.session.user.id;

        const toUserId =
            req.params.id;

        if (fromUserId === toUserId) {
            return res.status(400).json({
                error: "You cannot react to yourself."
            });
        }

        const {
            error: insertError
        } = await supabase
            .from("reactions")
            .insert({
                from_user_id: fromUserId,
                to_user_id: toUserId,
                type: "ogred"
            });

        if (insertError) {

            if (
                insertError.code === "23505"
            ) {
                return res.status(400).json({
                    error:
                        "You already Ogred this person."
                });
            }

            return res.status(500).json({
                error: insertError.message
            });
        }

        const {
            count,
            error: countError
        } = await supabase
            .from("reactions")
            .select("*", {
                count: "exact",
                head: true
            })
            .eq("to_user_id", toUserId)
            .eq("type", "ogred");

        if (countError) {
            return res.status(500).json({
                error: countError.message
            });
        }

        res.json({
            success: true,
            ogred: count || 0
        });

    } catch (error) {

        console.error(
            "OGRED ERROR:",
            error
        );

        res.status(500).json({
            error: "Server error."
        });
    }
});
// ==================================================
// SHREKCHAT
// ==================================================


// ==================================================
// GET ROOMS
// ==================================================

app.get("/api/chat/rooms", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({
                error: "You must be logged in."
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
            .order("created_at", {
                ascending: true
            });


        if (roomError) {
            return res.status(500).json({
                error: roomError.message
            });
        }


        const {
            data: memberships,
            error: memberError
        } = await supabase
            .from("chat_members")
            .select("room_id")
            .eq("user_id", userId);


        if (memberError) {
            return res.status(500).json({
                error: memberError.message
            });
        }


        const memberRooms =
            new Set(
                (memberships || [])
                    .map(member =>
                        member.room_id
                    )
            );


        const visibleRooms =
            (rooms || []).filter(room => {

                if (!room.is_private) {
                    return true;
                }

                return (
                    room.created_by === userId ||
                    memberRooms.has(room.id)
                );

            });


        res.json(visibleRooms);

    } catch (error) {

        console.error(
            "GET ROOMS ERROR:",
            error
        );

        res.status(500).json({
            error: "Server error."
        });

    }

});


// ==================================================
// CREATE ROOM
// ==================================================

app.post("/api/chat/rooms", async (req, res) => {

    try {

        if (!req.session.user) {
            return res.status(401).json({
                error: "You must be logged in."
            });
        }


        const name =
            String(
                req.body.name || ""
            ).trim();


        const isPrivate =
            req.body.is_private === true;


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

            console.error(
                "CREATE ROOM ERROR:",
                error
            );

            return res.status(500).json({
                error: error.message
            });

        }


        // Creator automatically joins

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
                .eq("id", room.id);


            return res.status(500).json({
                error:
                    memberError.message
            });

        }


        res.status(201).json(room);


    } catch (error) {

        console.error(
            "CREATE ROOM ERROR:",
            error
        );

        res.status(500).json({
            error: "Server error."
        });

    }

});


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
                .eq("id", roomId)
                .maybeSingle();


            if (error) {
                return res.status(500).json({
                    error: error.message
                });
            }


            if (!room) {
                return res.status(404).json({
                    error:
                        "Room not found."
                });
            }


            // Private room access check

            if (room.is_private) {

                const {
                    data: membership
                } = await supabase
                    .from("chat_members")
                    .select("room_id")
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
                    room.created_by !== userId
                ) {

                    return res.status(403).json({
                        error:
                            "🔒 You need an invitation to enter this room."
                    });

                }

            }


            // Public room OR already invited

            const {
                error: joinError
            } = await supabase
                .from("chat_members")
                .upsert({

                    room_id:
                        roomId,

                    user_id:
                        userId

                }, {
                    onConflict:
                        "room_id,user_id"
                });


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
                error: "Server error."
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

            res.status(500).json({
                error: "Server error."
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
                .select("created_by")
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

            res.status(500).json({
                error: "Server error."
            });

        }

    }
);


// ==================================================
// GET INVITABLE USERS
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
                .select("user_id")
                .eq(
                    "room_id",
                    roomId
                );


            const memberIds =
                new Set(
                    (members || [])
                        .map(member =>
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
                    avatar,
                    cat,
                    gyatt,
                    ogred
                `)
                .order(
                    "username",
                    {
                        ascending: true
                    }
                );


            if (error) {
                return res.status(500).json({
                    error: error.message
                });
            }


            res.json(
                (users || []).filter(
                    user =>
                        !memberIds.has(user.id)
                )
            );


        } catch (error) {

            console.error(
                "INVITE USERS ERROR:",
                error
            );

            res.status(500).json({
                error: "Server error."
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
                .upsert({

                    room_id:
                        roomId,

                    user_id:
                        invitedUserId

                }, {
                    onConflict:
                        "room_id,user_id"
                });


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
                error: "Server error."
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


            // Verify membership

            const {
                data: membership
            } = await supabase
                .from("chat_members")
                .select("room_id")
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
                        username,
                        display_name,
                        avatar,
                        cat,
                        gyatt,
                        ogred
                    `)
                    .eq(
                        "id",
                        message.user_id
                    )
                    .maybeSingle();


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
                        profile?.avatar ||
                        null,

                    cat:
                        profile?.cat ||
                        0,

                    gyatt:
                        profile?.gyatt ||
                        0,

                    ogred:
                        profile?.ogred ||
                        0

                });

            }


            res.json(result);


        } catch (error) {

            console.error(
                "MESSAGES ERROR:",
                error
            );

            res.status(500).json({
                error: "Server error."
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


            // Must be member

            const {
                data: membership
            } = await supabase
                .from("chat_members")
                .select("room_id")
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
                    req.body.content || ""
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
                error: "Server error."
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