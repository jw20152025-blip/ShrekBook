require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const PORT = process.env.PORT || 3000;


// ==================================================
// SUPABASE
// ==================================================

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);


// ==================================================
// EXPRESS
// ==================================================

app.use(express.json({
    limit: "25mb"
}));

app.use(express.urlencoded({
    extended: true,
    limit: "25mb"
}));


// ==================================================
// SESSION
// ==================================================

app.set("trust proxy", 1);

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "shrekbook-secret-change-this",

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
// STATIC FILES
// ==================================================

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ==================================================
// HELPERS
// ==================================================

function normalizeEmail(email) {

    return String(email || "")
        .trim()
        .toLowerCase();

}


function getAvatar(avatar) {

    return (
        avatar ||
        "/default-avatar.png"
    );

}


function requireLogin(req, res, next) {

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


async function getCurrentProfile(req) {

    if (
        !req.session ||
        !req.session.user
    ) {
        return null;
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
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data || null;

}


async function refreshSessionUser(req) {

    const profile =
        await getCurrentProfile(req);

    if (!profile) {
        return null;
    }

    req.session.user = {

        id:
            profile.id,

        username:
            profile.username,

        display_name:
            profile.display_name,

        avatar:
            getAvatar(
                profile.avatar
            ),

        role:
            profile.role || "user"

    };

    return profile;

}


function requireAdmin(req, res, next) {

    if (
        !req.session ||
        !req.session.user
    ) {

        return res.status(401).json({
            error:
                "You must be logged in."
        });

    }

    if (
        req.session.user.role !==
        "admin"
    ) {

        return res.status(403).json({
            error:
                "Admin access required."
        });

    }

    next();

}


function cleanUser(user) {

    if (!user) {
        return null;
    }

    return {

        ...user,

        avatar:
            getAvatar(
                user.avatar
            )

    };

}


// ==================================================
// IMAGE UPLOAD HELPER
// ==================================================

async function uploadImage(
    imageData,
    folder = "uploads"
) {

    if (!imageData) {
        throw new Error(
            "No image supplied."
        );
    }


    /*
        Expected format:

        data:image/png;base64,AAAA...

        OR

        data:image/jpeg;base64,AAAA...
    */

    const match =
        String(imageData).match(
            /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
        );


    if (!match) {

        throw new Error(
            "Invalid image format."
        );

    }


    const mimeType =
        match[1];

    const base64Data =
        match[2];


    const allowedTypes = [

        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
        "image/gif"

    ];


    if (
        !allowedTypes.includes(
            mimeType
        )
    ) {

        throw new Error(
            "Unsupported image type."
        );

    }


    const buffer =
        Buffer.from(
            base64Data,
            "base64"
        );


    // 10 MB limit

    if (
        buffer.length >
        10 * 1024 * 1024
    ) {

        throw new Error(
            "Image is too large. Maximum size is 10MB."
        );

    }


    let extension =
        "png";


    if (
        mimeType ===
        "image/jpeg" ||
        mimeType ===
        "image/jpg"
    ) {

        extension = "jpg";

    } else if (
        mimeType ===
        "image/webp"
    ) {

        extension = "webp";

    } else if (
        mimeType ===
        "image/gif"
    ) {

        extension = "gif";

    }


    const filename =
        `${folder}/${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}.${extension}`;


    const {
        error
    } = await supabase.storage
        .from("images")
        .upload(
            filename,
            buffer,
            {
                contentType:
                    mimeType,

                upsert: false
            }
        );


    if (error) {
        throw error;
    }


    const {
        data
    } = supabase.storage
        .from("images")
        .getPublicUrl(
            filename
        );


    return data.publicUrl;

}


// ==================================================
// TEST / HEALTH
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
                !!(
                    req.session &&
                    req.session.user
                )

        });

    }
);


// ==================================================
// CURRENT USER
// ==================================================

app.get(
    "/api/me",
    async (req, res) => {

        try {

            if (
                !req.session ||
                !req.session.user
            ) {

                return res.json({

                    loggedIn: false,

                    user: null

                });

            }


            const profile =
                await refreshSessionUser(
                    req
                );


            if (!profile) {

                req.session.destroy(
                    () => {}
                );

                return res.json({

                    loggedIn: false,

                    user: null

                });

            }


            res.json({

                loggedIn: true,

                user:
                    cleanUser(profile)

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


            if (
                username.length >
                30
            ) {

                return res.status(400).json({
                    error:
                        "Username is too long."
                });

            }


            if (
                password.length <
                6
            ) {

                return res.status(400).json({
                    error:
                        "Password must be at least 6 characters."
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
                await supabase.auth.admin
                    .createUser({

                        email,

                        password,

                        email_confirm:
                            true

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

                    id:
                        userId,

                    username,

                    display_name:
                        display_name ||
                        username,

                    avatar:
                        null,

                    bio:
                        "",

                    role:
                        "user",

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

                user:
                    cleanUser(profile)

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


            console.log(
                "LOGIN ATTEMPT:",
                email
            );


            const {
                data,
                error
            } =
                await supabase.auth
                    .signInWithPassword({

                        email,

                        password

                    });


            if (error) {

                console.error(
                    "SUPABASE LOGIN ERROR:",
                    error.message
                );

                return res.status(401).json({
                    error:
                        "Invalid email or password."
                });

            }


            if (
                !data ||
                !data.user
            ) {

                return res.status(401).json({
                    error:
                        "Login failed."
                });

            }


            const userId =
                data.user.id;


            const {
                data: profile,
                error: profileError
            } = await supabase
                .from("profiles")
                .select("*")
                .eq(
                    "id",
                    userId
                )
                .maybeSingle();


            if (profileError) {

                console.error(
                    "PROFILE LOGIN ERROR:",
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
                        "Account profile not found."
                });

            }


            // ==========================================
            // BAN CHECK
            // ==========================================

            if (
                profile.banned === true
            ) {

                return res.status(403).json({
                    error:
                        "This account has been banned."
                });

            }


            // ==========================================
            // LOGIN SESSION
            // ==========================================

            req.session.user = {

                id:
                    profile.id,

                username:
                    profile.username,

                display_name:
                    profile.display_name,

                avatar:
                    getAvatar(
                        profile.avatar
                    ),

                role:
                    profile.role ||
                    "user"

            };


            // ==========================================
            // UPDATE LAST SEEN
            // ==========================================

            await supabase
                .from("profiles")
                .update({

                    last_seen:
                        new Date()
                            .toISOString()

                })
                .eq(
                    "id",
                    profile.id
                );


            req.session.save(
                err => {

                    if (err) {

                        console.error(
                            "SESSION SAVE ERROR:",
                            err
                        );

                        return res.status(500).json({
                            error:
                                "Could not create login session."
                        });

                    }


                    console.log(
                        "LOGIN SUCCESS:",
                        profile.username
                    );


                    res.json({

                        success: true,

                        user:
                            cleanUser(profile)

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

                    console.error(
                        "LOGOUT ERROR:",
                        error
                    );

                    return res.status(500).json({
                        error:
                            "Could not log out."
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
// UPDATE LAST SEEN
// ==================================================

app.post(
    "/api/online",
    requireLogin,
    async (req, res) => {

        try {

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


            res.json({
                success: true
            });

        } catch (error) {

            console.error(
                "ONLINE ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not update online status."
            });

        }

    }
);


// ==================================================
// GET ONLINE USERS
// ==================================================

app.get(
    "/api/online",
    async (req, res) => {

        try {

            const cutoff =
                new Date(
                    Date.now() -
                    2 * 60 * 1000
                ).toISOString();


            const {
                data,
                error
            } = await supabase
                .from("profiles")
                .select(
                    "id,username,display_name,avatar,last_seen,role"
                )
                .gte(
                    "last_seen",
                    cutoff
                )
                .order(
                    "last_seen",
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


            res.json(
                (data || []).map(
                    cleanUser
                )
            );

        } catch (error) {

            console.error(
                "ONLINE USERS ERROR:",
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
// USERS
// ==================================================

app.get(
    "/api/users",
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await supabase
                .from("profiles")
                .select("*")
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
                (data || []).map(
                    cleanUser
                )
            );

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
// SINGLE USER
// ==================================================

app.get(
    "/api/users/:id",
    async (req, res) => {

        try {

            const {
                data: user,
                error
            } = await supabase
                .from("profiles")
                .select("*")
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


            if (!user) {

                return res.status(404).json({
                    error:
                        "User not found."
                });

            }


            res.json(
                cleanUser(user)
            );

        } catch (error) {

            console.error(
                "USER ERROR:",
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

            const userId =
                req.session.user.id;


            const updates = {};


            if (
                req.body.username !==
                undefined
            ) {

                const username =
                    String(
                        req.body.username
                    ).trim();


                if (!username) {

                    return res.status(400).json({
                        error:
                            "Username cannot be empty."
                    });

                }


                if (
                    username.length >
                    30
                ) {

                    return res.status(400).json({
                        error:
                            "Username is too long."
                    });

                }


                const {
                    data: existing
                } = await supabase
                    .from("profiles")
                    .select("id")
                    .eq(
                        "username",
                        username
                    )
                    .neq(
                        "id",
                        userId
                    )
                    .maybeSingle();


                if (existing) {

                    return res.status(400).json({
                        error:
                            "That username is already taken."
                    });

                }


                updates.username =
                    username;

            }


            if (
                req.body.display_name !==
                undefined
            ) {

                updates.display_name =
                    String(
                        req.body.display_name
                    ).trim();

            }


            if (
                req.body.bio !==
                undefined
            ) {

                updates.bio =
                    String(
                        req.body.bio
                    ).trim();

            }


            if (
                Object.keys(
                    updates
                ).length === 0
            ) {

                return res.status(400).json({
                    error:
                        "Nothing to update."
                });

            }


            const {
                data,
                error
            } = await supabase
                .from("profiles")
                .update(updates)
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


            await refreshSessionUser(
                req
            );


            res.json({

                success: true,

                user:
                    cleanUser(data)

            });

        } catch (error) {

            console.error(
                "PROFILE UPDATE ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not update profile."
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

            const image =
                req.body.image ||
                req.body.avatar;


            if (!image) {

                return res.status(400).json({
                    error:
                        "No image supplied."
                });

            }


            const avatarUrl =
                await uploadImage(
                    image,
                    "avatars"
                );


            const {
                data,
                error
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


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            await refreshSessionUser(
                req
            );


            res.json({

                success: true,

                avatar:
                    avatarUrl,

                user:
                    cleanUser(data)

            });

        } catch (error) {

            console.error(
                "AVATAR ERROR:",
                error
            );

            res.status(400).json({
                error:
                    error.message ||
                    "Avatar upload failed."
            });

        }

    }
);


// ==================================================
// GENERAL IMAGE UPLOAD
// ==================================================

app.post(
    "/api/upload",
    requireLogin,
    async (req, res) => {

        try {

            const image =
                req.body.image;


            if (!image) {

                return res.status(400).json({
                    error:
                        "No image supplied."
                });

            }


            const url =
                await uploadImage(
                    image,
                    "posts"
                );


            res.json({

                success: true,

                url

            });

        } catch (error) {

            console.error(
                "UPLOAD ERROR:",
                error
            );

            res.status(400).json({
                error:
                    error.message ||
                    "Upload failed."
            });

        }

    }
);


// ==================================================
// POSTS - GET
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
                const post of
                posts || []
            ) {

                let author = null;


                if (
                    post.user_id
                ) {

                    const {
                        data
                    } = await supabase
                        .from("profiles")
                        .select(
                            "id,username,display_name,avatar,role"
                        )
                        .eq(
                            "id",
                            post.user_id
                        )
                        .maybeSingle();


                    author =
                        cleanUser(data);

                }


                result.push({

                    ...post,

                    author,

                    avatar:
                        author
                            ? author.avatar
                            : getAvatar(null)

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


// ==================================================
// CREATE POST
// ==================================================

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


            let imageUrl =
                req.body.image_url ||
                req.body.imageUrl ||
                null;


            // If frontend sends a base64 image
            if (
                req.body.image &&
                String(
                    req.body.image
                ).startsWith(
                    "data:image/"
                )
            ) {

                imageUrl =
                    await uploadImage(
                        req.body.image,
                        "posts"
                    );

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


            res.status(201).json({

                success: true,

                post: data

            });

        } catch (error) {

            console.error(
                "CREATE POST ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message ||
                    "Could not create post."
            });

        }

    }
);


// ==================================================
// DELETE POST
// ==================================================

app.delete(
    "/api/posts/:postId",
    requireLogin,
    async (req, res) => {

        try {

            const {
                data: post,
                error: postError
            } = await supabase
                .from("posts")
                .select(
                    "id,user_id"
                )
                .eq(
                    "id",
                    req.params.postId
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


            const isOwner =
                post.user_id ===
                req.session.user.id;


            const isAdmin =
                req.session.user.role ===
                "admin";


            if (
                !isOwner &&
                !isAdmin
            ) {

                return res.status(403).json({
                    error:
                        "You cannot delete this post."
                });

            }


            const {
                error
            } = await supabase
                .from("posts")
                .delete()
                .eq(
                    "id",
                    req.params.postId
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
                "DELETE POST ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not delete post."
            });

        }

    }
);


// ==================================================
// COMMENTS - GET
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
                    error:
                        error.message
                });

            }


            const result = [];


            for (
                const comment of
                comments || []
            ) {

                let author = null;


                if (
                    comment.user_id
                ) {

                    const {
                        data
                    } = await supabase
                        .from("profiles")
                        .select(
                            "id,username,display_name,avatar,role"
                        )
                        .eq(
                            "id",
                            comment.user_id
                        )
                        .maybeSingle();


                    author =
                        cleanUser(data);

                }


                result.push({

                    ...comment,

                    author

                });

            }


            res.json(result);

        } catch (error) {

            console.error(
                "GET COMMENTS ERROR:",
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
// CREATE COMMENT
// ==================================================

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
                    error:
                        error.message
                });

            }


            res.status(201).json({

                success: true,

                comment: data

            });

        } catch (error) {

            console.error(
                "CREATE COMMENT ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not create comment."
            });

        }

    }
);


// ==================================================
// DELETE COMMENT
// ==================================================

app.delete(
    "/api/comments/:commentId",
    requireLogin,
    async (req, res) => {

        try {

            const {
                data: comment,
                error: lookupError
            } = await supabase
                .from("comments")
                .select(
                    "id,user_id"
                )
                .eq(
                    "id",
                    req.params.commentId
                )
                .maybeSingle();


            if (lookupError) {

                return res.status(500).json({
                    error:
                        lookupError.message
                });

            }


            if (!comment) {

                return res.status(404).json({
                    error:
                        "Comment not found."
                });

            }


            const allowed =
                comment.user_id ===
                    req.session.user.id ||
                req.session.user.role ===
                    "admin";


            if (!allowed) {

                return res.status(403).json({
                    error:
                        "You cannot delete this comment."
                });

            }


            const {
                error
            } = await supabase
                .from("comments")
                .delete()
                .eq(
                    "id",
                    req.params.commentId
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
                "DELETE COMMENT ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not delete comment."
            });

        }

    }
);


// ==================================================
// REACTIONS
// ==================================================
//
// Expected reactions table:
//
// id
// post_id
// user_id
// reaction
// created_at
//
// Example reaction:
// "gyatt"
// ==================================================

app.get(
    "/api/posts/:postId/reactions",
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await supabase
                .from("reactions")
                .select(
                    "id,post_id,user_id,reaction,created_at"
                )
                .eq(
                    "post_id",
                    req.params.postId
                );


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            const counts = {};


            for (
                const reaction
                of data || []
            ) {

                const type =
                    reaction.reaction ||
                    "gyatt";


                counts[type] =
                    (
                        counts[type] ||
                        0
                    ) + 1;

            }


            let mine = null;


            if (
                req.session &&
                req.session.user
            ) {

                const own =
                    (
                        data || []
                    ).find(
                        reaction =>
                            reaction.user_id ===
                            req.session.user.id
                    );


                if (own) {

                    mine =
                        own.reaction;

                }

            }


            res.json({

                counts,

                mine,

                total:
                    (
                        data || []
                    ).length

            });

        } catch (error) {

            console.error(
                "REACTIONS GET ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not load reactions."
            });

        }

    }
);


// ==================================================
// ADD / TOGGLE REACTION
// ==================================================

app.post(
    "/api/posts/:postId/reactions",
    requireLogin,
    async (req, res) => {

        try {

            const reaction =
                String(
                    req.body.reaction ||
                    "gyatt"
                ).trim();


            if (!reaction) {

                return res.status(400).json({
                    error:
                        "Reaction is required."
                });

            }


            const userId =
                req.session.user.id;


            const postId =
                req.params.postId;


            const {
                data: existing,
                error: lookupError
            } = await supabase
                .from("reactions")
                .select("*")
                .eq(
                    "post_id",
                    postId
                )
                .eq(
                    "user_id",
                    userId
                )
                .maybeSingle();


            if (lookupError) {

                return res.status(500).json({
                    error:
                        lookupError.message
                });

            }


            // Clicking the same reaction removes it.

            if (
                existing &&
                existing.reaction ===
                reaction
            ) {

                const {
                    error
                } = await supabase
                    .from("reactions")
                    .delete()
                    .eq(
                        "id",
                        existing.id
                    );


                if (error) {

                    return res.status(500).json({
                        error:
                            error.message
                    });

                }


                return res.json({

                    success: true,

                    active: false,

                    reaction: null

                });

            }


            // Change an existing reaction.

            if (existing) {

                const {
                    data,
                    error
                } = await supabase
                    .from("reactions")
                    .update({

                        reaction

                    })
                    .eq(
                        "id",
                        existing.id
                    )
                    .select()
                    .single();


                if (error) {

                    return res.status(500).json({
                        error:
                            error.message
                    });

                }


                return res.json({

                    success: true,

                    active: true,

                    reaction:
                        data.reaction

                });

            }


            // Add a new reaction.

            const {
                data,
                error
            } = await supabase
                .from("reactions")
                .insert({

                    post_id:
                        postId,

                    user_id:
                        userId,

                    reaction

                })
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

                active: true,

                reaction:
                    data.reaction

            });

        } catch (error) {

            console.error(
                "REACTION ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not update reaction."
            });

        }

    }
);


// ==================================================
// GYATT SHORTCUT
// ==================================================

app.post(
    "/api/posts/:postId/gyatt",
    requireLogin,
    async (req, res) => {

        req.body.reaction =
            "gyatt";


        const postId =
            req.params.postId;


        try {

            const userId =
                req.session.user.id;


            const {
                data: existing
            } = await supabase
                .from("reactions")
                .select("*")
                .eq(
                    "post_id",
                    postId
                )
                .eq(
                    "user_id",
                    userId
                )
                .maybeSingle();


            if (existing) {

                await supabase
                    .from("reactions")
                    .delete()
                    .eq(
                        "id",
                        existing.id
                    );


                return res.json({

                    success: true,

                    active: false

                });

            }


            const {
                error
            } = await supabase
                .from("reactions")
                .insert({

                    post_id:
                        postId,

                    user_id:
                        userId,

                    reaction:
                        "gyatt"

                });


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.json({

                success: true,

                active: true

            });

        } catch (error) {

            console.error(
                "GYATT ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not update gyatt."
            });

        }

    }
);


// ==================================================
// SHREKCHAT AUTH
// ==================================================

app.get(
    "/api/chat/auth",
    requireLogin,
    async (req, res) => {

        try {

            const profile =
                await refreshSessionUser(
                    req
                );


            res.json({

                loggedIn: true,

                user:
                    cleanUser(profile)

            });

        } catch (error) {

            console.error(
                "CHAT AUTH ERROR:",
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
// SHREKCHAT - GET MESSAGES
// ==================================================

app.get(
    "/api/chat/messages",
    requireLogin,
    async (req, res) => {

        try {

            const {
                data: messages,
                error
            } = await supabase
                .from("chat_messages")
                .select("*")
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
                const message
                of messages || []
            ) {

                const {
                    data: user
                } = await supabase
                    .from("profiles")
                    .select(
                        "id,username,display_name,avatar,role"
                    )
                    .eq(
                        "id",
                        message.user_id
                    )
                    .maybeSingle();


                result.push({

                    ...message,

                    user:
                        cleanUser(user)

                });

            }


            res.json(result);

        } catch (error) {

            console.error(
                "CHAT GET ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not load chat."
            });

        }

    }
);


// ==================================================
// SHREKCHAT - SEND MESSAGE
// ==================================================

app.post(
    "/api/chat/messages",
    requireLogin,
    async (req, res) => {

        try {

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
                2000
            ) {

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


            res.status(201).json({

                success: true,

                message:
                    data

            });

        } catch (error) {

            console.error(
                "CHAT SEND ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not send message."
            });

        }

    }
);


// ==================================================
// SHREKCHAT - DELETE MESSAGE
// ==================================================

app.delete(
    "/api/chat/messages/:id",
    requireLogin,
    async (req, res) => {

        try {

            const {
                data: message,
                error: lookupError
            } = await supabase
                .from("chat_messages")
                .select(
                    "id,user_id"
                )
                .eq(
                    "id",
                    req.params.id
                )
                .maybeSingle();


            if (lookupError) {

                return res.status(500).json({
                    error:
                        lookupError.message
                });

            }


            if (!message) {

                return res.status(404).json({
                    error:
                        "Message not found."
                });

            }


            const allowed =
                message.user_id ===
                    req.session.user.id ||
                req.session.user.role ===
                    "admin";


            if (!allowed) {

                return res.status(403).json({
                    error:
                        "You cannot delete this message."
                });

            }


            const {
                error
            } = await supabase
                .from("chat_messages")
                .delete()
                .eq(
                    "id",
                    req.params.id
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
                "CHAT DELETE ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not delete message."
            });

        }

    }
);


// ==================================================
// ADMIN AUTH CHECK
// ==================================================

app.get(
    "/api/admin/auth",
    requireAdmin,
    async (req, res) => {

        try {

            const profile =
                await refreshSessionUser(
                    req
                );


            res.json({

                success: true,

                isAdmin: true,

                user:
                    cleanUser(profile)

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
// ADMIN - GET USERS
// ==================================================

app.get(
    "/api/admin/users",
    requireAdmin,
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await supabase
                .from("profiles")
                .select("*")
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
                (data || []).map(
                    cleanUser
                )
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
// ADMIN - BAN USER
// ==================================================

app.post(
    "/api/admin/users/:id/ban",
    requireAdmin,
    async (req, res) => {

        try {

            const targetId =
                req.params.id;


            if (
                targetId ===
                req.session.user.id
            ) {

                return res.status(400).json({
                    error:
                        "You cannot ban yourself."
                });

            }


            const {
                data: target,
                error: targetError
            } = await supabase
                .from("profiles")
                .select("*")
                .eq(
                    "id",
                    targetId
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


            if (
                target.role ===
                "admin"
            ) {

                return res.status(403).json({
                    error:
                        "You cannot ban another admin."
                });

            }


            const {
                data,
                error
            } = await supabase
                .from("profiles")
                .update({

                    banned: true

                })
                .eq(
                    "id",
                    targetId
                )
                .select()
                .single();


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            // Invalidate Supabase auth user.

            await supabase.auth.admin
                .signOut(
                    targetId
                )
                .catch(
                    () => {}
                );


            res.json({

                success: true,

                user:
                    cleanUser(data)

            });

        } catch (error) {

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
// ADMIN - UNBAN USER
// ==================================================

app.post(
    "/api/admin/users/:id/unban",
    requireAdmin,
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await supabase
                .from("profiles")
                .update({

                    banned: false

                })
                .eq(
                    "id",
                    req.params.id
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

                user:
                    cleanUser(data)

            });

        } catch (error) {

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
// ADMIN - CHANGE ROLE
// ==================================================

app.post(
    "/api/admin/users/:id/role",
    requireAdmin,
    async (req, res) => {

        try {

            const role =
                String(
                    req.body.role ||
                    ""
                ).trim();


            if (
                role !== "admin" &&
                role !== "user"
            ) {

                return res.status(400).json({
                    error:
                        "Role must be admin or user."
                });

            }


            if (
                req.params.id ===
                req.session.user.id
            ) {

                return res.status(400).json({
                    error:
                        "You cannot change your own role."
                });

            }


            const {
                data,
                error
            } = await supabase
                .from("profiles")
                .update({

                    role

                })
                .eq(
                    "id",
                    req.params.id
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

                user:
                    cleanUser(data)

            });

        } catch (error) {

            console.error(
                "ROLE ERROR:",
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
// ADMIN - DELETE USER
// ==================================================

app.delete(
    "/api/admin/users/:id",
    requireAdmin,
    async (req, res) => {

        try {

            const targetId =
                req.params.id;


            if (
                targetId ===
                req.session.user.id
            ) {

                return res.status(400).json({
                    error:
                        "You cannot delete yourself."
                });

            }


            const {
                data: target
            } = await supabase
                .from("profiles")
                .select(
                    "id,role"
                )
                .eq(
                    "id",
                    targetId
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
                "admin"
            ) {

                return res.status(403).json({
                    error:
                        "You cannot delete another admin."
                });

            }


            const {
                error
            } =
                await supabase.auth.admin
                    .deleteUser(
                        targetId
                    );


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            // Profiles should normally cascade
            // from auth.users. If yours doesn't,
            // delete it manually.

            await supabase
                .from("profiles")
                .delete()
                .eq(
                    "id",
                    targetId
                );


            res.json({

                success: true

            });

        } catch (error) {

            console.error(
                "DELETE USER ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not delete user."
            });

        }

    }
);


// ==================================================
// ADMIN - DELETE POST
// ==================================================

app.delete(
    "/api/admin/posts/:id",
    requireAdmin,
    async (req, res) => {

        try {

            const {
                error
            } = await supabase
                .from("posts")
                .delete()
                .eq(
                    "id",
                    req.params.id
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
                "ADMIN DELETE POST ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not delete post."
            });

        }

    }
);


// ==================================================
// ADMIN - DELETE COMMENT
// ==================================================

app.delete(
    "/api/admin/comments/:id",
    requireAdmin,
    async (req, res) => {

        try {

            const {
                error
            } = await supabase
                .from("comments")
                .delete()
                .eq(
                    "id",
                    req.params.id
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
                "ADMIN DELETE COMMENT ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not delete comment."
            });

        }

    }
);


// ==================================================
// ADMIN - DELETE CHAT MESSAGE
// ==================================================

app.delete(
    "/api/admin/chat/:id",
    requireAdmin,
    async (req, res) => {

        try {

            const {
                error
            } = await supabase
                .from("chat_messages")
                .delete()
                .eq(
                    "id",
                    req.params.id
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
                "ADMIN DELETE CHAT ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not delete message."
            });

        }

    }
);


// ==================================================
// ADMIN DASHBOARD STATS
// ==================================================

app.get(
    "/api/admin/stats",
    requireAdmin,
    async (req, res) => {

        try {

            const {
                count: users
            } = await supabase
                .from("profiles")
                .select(
                    "*",
                    {
                        count: "exact",
                        head: true
                    }
                );


            const {
                count: posts
            } = await supabase
                .from("posts")
                .select(
                    "*",
                    {
                        count: "exact",
                        head: true
                    }
                );


            const {
                count: comments
            } = await supabase
                .from("comments")
                .select(
                    "*",
                    {
                        count: "exact",
                        head: true
                    }
                );


            const {
                count: reactions
            } = await supabase
                .from("reactions")
                .select(
                    "*",
                    {
                        count: "exact",
                        head: true
                    }
                );


            const cutoff =
                new Date(
                    Date.now() -
                    2 * 60 * 1000
                ).toISOString();


            const {
                count: online
            } = await supabase
                .from("profiles")
                .select(
                    "*",
                    {
                        count: "exact",
                        head: true
                    }
                )
                .gte(
                    "last_seen",
                    cutoff
                );


            res.json({

                users:
                    users || 0,

                posts:
                    posts || 0,

                comments:
                    comments || 0,

                reactions:
                    reactions || 0,

                online:
                    online || 0

            });

        } catch (error) {

            console.error(
                "ADMIN STATS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not load statistics."
            });

        }

    }
);


// ==================================================
// SERVE PAGES
// ==================================================

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );

    }
);


app.get(
    "/shrekchat.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "shrekchat.html"
            )
        );

    }
);


app.get(
    "/admin.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "admin.html"
            )
        );

    }
);


// ==================================================
// API 404
// ==================================================

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({

            error:
                "API endpoint not found."

        });

    }
);


// ==================================================
// GENERAL ERROR HANDLER
// ==================================================

app.use(
    (error, req, res, next) => {

        console.error(
            "UNHANDLED ERROR:",
            error
        );


        if (
            res.headersSent
        ) {

            return next(error);

        }


        res.status(500).json({

            error:
                "Internal server error."

        });

    }
);


// ==================================================
// START
// ==================================================

app.listen(
    PORT,
    () => {

        console.log(
            `🧌 ShrekBook running on port ${PORT}`
        );

    }
);