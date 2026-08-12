require("dotenv").config();

const express = require("express");
const session = require("express-session");


const app = express();

const PORT = process.env.PORT || 3000;

const SUPABASE_URL =
    process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

const SESSION_SECRET =
    process.env.SESSION_SECRET;

const { createClient } = require("@supabase/supabase-js");

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
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {

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



// ========================================
// EXPRESS
// ========================================

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


app.set(
    "trust proxy",
    1
);


// ========================================
// SESSION
// ========================================

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


// ========================================
// FRONTEND
// ========================================

app.use(
    express.static("public")
);


// ========================================
// HEALTH
// ========================================

app.get("/api/health", (req, res) => {

    res.json({

        ok: true,

        loggedIn:
            !!req.session.user

    });

});


// ========================================
// SIGNUP
// ========================================

app.post("/api/signup", async (req, res) => {
    try {
        const {
            email,
            password,
            username,
            display_name
        } = req.body;

        if (!email || !password || !username) {
            return res.status(400).json({
                error: "Email, password, and username are required."
            });
        }

        // Create Supabase Auth account
        const {
            data: authData,
            error: authError
        } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true
        });

        if (authError) {
            console.error("AUTH SIGNUP ERROR:", authError);

            return res.status(400).json({
                error: authError.message
            });
        }

        const userId = authData.user.id;

        // Create ShrekBook profile
        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .insert({
                id: userId,
                username: username,
                display_name: display_name || username,
                avatar: null,
                bio: "",
                gyatt: 0,
                cat: 0,
                ogres: 0
            })
            .select()
            .maybeSingle();

        if (profileError) {
            console.error(
                "PROFILE SIGNUP ERROR:",
                profileError
            );

            // Remove Auth account if profile creation failed
            await supabase.auth.admin.deleteUser(userId);

            return res.status(500).json({
                error: profileError.message
            });
        }

        res.json({
            success: true,
            user: profile
        });

    } catch (error) {
        console.error("SIGNUP SERVER ERROR:", error);

        res.status(500).json({
            error: error.message
        });
    }
});


// ========================================
// LOGIN
// ========================================

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: "Email and password are required."
            });
        }

        // Authenticate with Supabase
        const {
            data: authData,
            error: authError
        } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            console.error("AUTH LOGIN ERROR:", authError);

            return res.status(401).json({
                error: authError.message
            });
        }

        const user = authData.user;

        console.log("✅ Auth user:", user.id);

        // Look for the profile using the Auth UUID
        const {
            data: profile,
            error: profileError
        } = await supabase
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
                error: profileError.message
            });
        }

        let finalProfile = profile;

        // ==========================================
        // CREATE MISSING PROFILE
        // ==========================================

        if (!finalProfile) {

            console.log(
                "⚠️ No profile found. Creating one..."
            );

            let username =
                (user.email || "user")
                    .split("@")[0]
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, "")
                    .slice(0, 20);

            if (!username) {
                username = "user";
            }

            // Make username unique
            let originalUsername = username;
            let number = 1;

            while (true) {

                const {
                    data: existingUser,
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
                        error:
                            usernameError.message
                    });
                }

                if (!existingUser) {
                    break;
                }

                username =
                    `${originalUsername}${number}`;

                number++;
            }

            const {
                data: newProfile,
                error: createError
            } = await supabase
                .from("profiles")
                .insert({
                    id: user.id,
                    username: username,
                    display_name: username,
                    avatar: null,
                    bio: "",
                    gyatt: 0,
                    cat: 0,
                    ogres: 0
                })
                .select()
                .maybeSingle();

            if (createError) {

                console.error(
                    "PROFILE CREATE ERROR:",
                    createError
                );

                return res.status(500).json({
                    error:
                        "Could not create your ShrekBook profile: " +
                        createError.message
                });
            }

            if (!newProfile) {

                return res.status(500).json({
                    error:
                        "Profile creation returned no profile."
                });
            }

            finalProfile = newProfile;

            console.log(
                "✅ Created profile:",
                finalProfile.username
            );
        }

        // ==========================================
        // CREATE LOGIN SESSION
        // ==========================================

        req.session.user = {
            id: finalProfile.id,
            username: finalProfile.username,
            display_name: finalProfile.display_name
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
                user: finalProfile
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

// ========================================
// LOGOUT
// ========================================

app.post("/api/logout", (req, res) => {

    req.session.destroy(error => {

        if (error) {

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


// ========================================
// CURRENT USER
// ========================================

app.get("/api/me", async (req, res) => {

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
            error:
                error.message
        });

    }


    res.json({

        loggedIn: true,

        user: data

    });

});


// ========================================
// USERS
// ========================================

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
                ogres,
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
                error
            );

            return res.status(500).json({
                error:
                    error.message
            });

        }


        res.json(data);

    } catch (error) {

        res.status(500).json({
            error:
                error.message
        });

    }

});


// ========================================
// PROFILE
// ========================================

app.get(
    "/api/users/:id",
    async (req, res) => {

        try {

            const {
                data: profile,
                error
            } = await supabase
                .from("profiles")
                .select("*")
                .eq(
                    "id",
                    req.params.id
                )
                .single();


            if (error) {

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
                    error:
                        postsError.message
                });

            }


            res.json({

                ...profile,

                posts

            });


        } catch (error) {

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);


// ========================================
// UPDATE PROFILE
// ========================================

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


            const userId =
                req.session.user.id;


            const {

                display_name,

                bio,

                avatar,

                gyatt,

                cat,

                ogres

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
                            parseInt(
                                gyatt
                            ) || 0
                        ),

                    cat:
                        Math.max(
                            0,
                            parseInt(
                                cat
                            ) || 0
                        ),

                    ogres:
                        Math.max(
                            0,
                            parseInt(
                                ogres
                            ) || 0
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
                    "PROFILE UPDATE:",
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

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);


// ========================================
// AVATAR UPLOAD
// ========================================

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
                !fileType.startsWith("image/")
            ) {

                return res.status(400).json({
                    error:
                        "File must be an image."
                });

            }


            // Limit roughly 5MB

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


            const path =
                `${req.session.user.id}/${Date.now()}.${extension}`;


            const {
                error: uploadError
            } = await supabase.storage
                .from("avatars")
                .upload(
                    path,
                    buffer,
                    {

                        contentType:
                            fileType,

                        upsert: true

                    }
                );


            if (uploadError) {

                console.error(
                    "AVATAR UPLOAD:",
                    uploadError
                );

                return res.status(500).json({
                    error:
                        uploadError.message
                });

            }


            const {
                data: publicData
            } = supabase.storage
                .from("avatars")
                .getPublicUrl(path);


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

                user:
                    profile

            });


        } catch (error) {

            console.error(
                "AVATAR ERROR:",
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
// POSTS
// ========================================

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
                error:
                    error.message
            });

        }


        const result = [];


        for (
            const post of posts
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

        res.status(500).json({
            error:
                error.message
        });

    }

});


// ========================================
// CREATE POST
// ========================================

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
                error:
                    error.message
            });

        }


        res.json(data);


    } catch (error) {

        res.status(500).json({
            error:
                error.message
        });

    }

});


// ========================================
// COMMENTS
// ========================================

app.get("/api/posts/:postId/comments", async (req, res) => {
    try {
        const { postId } = req.params;

        const { data, error } = await supabase
            .from("comments")
            .select("*")
            .eq("post_id", postId)
            .order("created_at", {
                ascending: true
            });

        if (error) {
            console.error("COMMENTS LOAD ERROR:", error);

            return res.status(500).json({
                error: error.message
            });
        }

        res.json(data || []);

    } catch (error) {
        console.error("COMMENTS SERVER ERROR:", error);

        res.status(500).json({
            error: error.message
        });
    }
});


// ========================================
// SERVER
// ========================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🧌 ShrekBook running on port ${PORT}`
        );

    }
);