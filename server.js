console.log("🔥 ShrekBook clean server starting...");

require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const { createClient } = require("@supabase/supabase-js");

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

app.use(express.json());

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
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 24 * 30
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
// SIGNUP
// ==================================================

app.post("/api/signup", async (req, res) => {
    try {
        const {
            username,
            display_name,
            email,
            password
        } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                error:
                    "Username, email, and password are required."
            });
        }

        const cleanUsername = username
            .trim()
            .toLowerCase();

        // Check username

        const {
            data: existingProfile,
            error: usernameError
        } = await supabase
            .from("profiles")
            .select("id")
            .eq("username", cleanUsername)
            .maybeSingle();

        if (usernameError) {
            return res.status(500).json({
                error: usernameError.message
            });
        }

        if (existingProfile) {
            return res.status(400).json({
                error: "That username is already taken."
            });
        }

        // Create Auth account

        const {
            data: authData,
            error: authError
        } = await supabase.auth.admin.createUser({
            email: email.trim(),
            password,
            email_confirm: true
        });

        if (authError) {
            return res.status(400).json({
                error: authError.message
            });
        }

        const userId = authData.user.id;

        // Create profile

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .insert({
                id: userId,
                username: cleanUsername,
                display_name:
                    display_name?.trim() ||
                    cleanUsername,
                avatar: null,
                bio: "",
                gyatt: 0,
                cat: 0,
                ogred: 0
            })
            .select()
            .single();

        if (profileError) {
            await supabase.auth.admin.deleteUser(
                userId
            );

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
            data,
            error
        } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password
        });

        if (error) {
            return res.status(401).json({
                error: error.message
            });
        }

        const user = data.user;

        // Get profile

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            return res.status(500).json({
                error: profileError.message
            });
        }

        let finalProfile = profile;

        // Create missing profile

        if (!finalProfile) {
            let username =
                (user.email || "user")
                    .split("@")[0]
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, "")
                    .slice(0, 20);

            if (!username) {
                username = "user";
            }

            let baseUsername = username;
            let number = 1;

            while (true) {
                const {
                    data: existing
                } = await supabase
                    .from("profiles")
                    .select("id")
                    .eq("username", username)
                    .maybeSingle();

                if (!existing) {
                    break;
                }

                username =
                    `${baseUsername}${number}`;

                number++;
            }

            const {
                data: newProfile,
                error: createError
            } = await supabase
                .from("profiles")
                .insert({
                    id: user.id,
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

            finalProfile = newProfile;
        }

        // Create session

        req.session.user = {
            id: finalProfile.id,
            username: finalProfile.username,
            display_name:
                finalProfile.display_name
        };

        req.session.save(error => {
            if (error) {
                console.error(
                    "SESSION ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        "Could not save login session."
                });
            }

            res.json({
                success: true,
                user: finalProfile
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

        if (error) {
            return res.status(500).json({
                error: error.message
            });
        }

        res.json({
            loggedIn: true,
            user: data
        });

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// ==================================================
// GET USERS
// ==================================================

app.get("/api/users", async (req, res) => {
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
            return res.status(500).json({
                error: error.message
            });
        }

        res.json(data || []);

    } catch (error) {
        res.status(500).json({
            error: "Server error."
        });
    }
});

// ==================================================
// GET ONE USER
// ==================================================

app.get("/api/users/:id", async (req, res) => {
    try {
        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", req.params.id)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({
                error: "User not found."
            });
        }

        const {
            data: posts,
            error: postsError
        } = await supabase
            .from("posts")
            .select("*")
            .eq(
                "user_id",
                req.params.id
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

        res.json({
            ...profile,
            posts: posts || []
        });

    } catch (error) {
        res.status(500).json({
            error: error.message
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
                req.session.user.id
            )
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
            error: error.message
        });
    }
});

// ==================================================
// POSTS
// ==================================================

app.get("/api/posts", async (req, res) => {
    try {
        const {
            data: posts,
            error
        } = await supabase
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
                error: error.message
            });
        }

        const result = [];

        for (const post of posts || []) {
            const {
                data: profile
            } = await supabase
                .from("profiles")
                .select(
                    "username, display_name"
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
            error: error.message
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
        } = await supabase
            .from("posts")
            .insert({
                user_id:
                    req.session.user.id,
                content
            })
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                error: error.message
            });
        }

        res.json(data);

    } catch (error) {
        res.status(500).json({
            error: error.message
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
            const {
                data: comments,
                error
            } = await supabase
                .from("comments")
                .select("*")
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
                    error: error.message
                });
            }

            const result = [];

            for (
                const comment of comments || []
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
                error: error.message
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

                    content
                })
                .select()
                .single();

            if (error) {
                return res.status(500).json({
                    error: error.message
                });
            }

            res.json(data);

        } catch (error) {
            res.status(500).json({
                error: error.message
            });
        }
    }
);

// ==================================================
// START SERVER
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