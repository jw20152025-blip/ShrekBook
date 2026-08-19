
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
// MIDDLEWARE
// ==================================================

app.use(
    express.json({
        limit: "15mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "15mb"
    })
);

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
            maxAge:
                1000 * 60 * 60 * 24 * 30
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

    return String(
        email || ""
    )
        .trim()
        .toLowerCase();

}


function getAvatar(avatar) {

    if (!avatar) {
        return "/default-avatar.png";
    }

    return avatar;

}


async function getUserRole(userId) {

    if (
        process.env.OWNER_ID &&
        userId === process.env.OWNER_ID
    ) {

        return "owner";

    }


    const {
        data,
        error
    } =
        await supabase
            .from("admins")
            .select("role")
            .eq(
                "user_id",
                userId
            )
            .maybeSingle();


    if (error) {

        console.error(
            "GET USER ROLE ERROR:",
            error
        );

        return "peasant";

    }


    return data?.role || "peasant";

}


async function getActiveBanByUserId(userId) {

    const {
        data,
        error
    } =
        await supabase
            .from("bans")
            .select("*")
            .eq(
                "user_id",
                userId
            )
            .eq(
                "active",
                true
            )
            .order(
                "banned_at",
                {
                    ascending: false
                }
            )
            .limit(1)
            .maybeSingle();


    if (error) {

        console.error(
            "GET ACTIVE BAN ERROR:",
            error
        );

        return null;

    }


    return data;

}


async function getActiveKickByUserId(userId) {

    const {
        data,
        error
    } =
        await supabase
            .from("kicks")
            .select("*")
            .eq(
                "user_id",
                userId
            )
            .eq(
                "active",
                true
            )
            .order(
                "kicked_at",
                {
                    ascending: false
                }
            )
            .limit(1)
            .maybeSingle();


    if (error) {

        return null;

    }


    return data;

}


async function getReactionCounts(userId) {

    const {
        data,
        error
    } =
        await supabase
            .from("reactions")
            .select("type")
            .eq(
                "to_user_id",
                userId
            );


    if (error) {

        console.error(
            "GET REACTION COUNTS ERROR:",
            error
        );

        return {
            gyatt: 0,
            cat: 0,
            ogred: 0
        };

    }


    const counts = {

        gyatt: 0,

        cat: 0,

        ogred: 0

    };


    for (
        const reaction of
        data || []
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
// AUTH MIDDLEWARE
// ==================================================

function requireLogin(
    req,
    res,
    next
) {

    if (
        !req.session.user
    ) {

        return res.status(401).json({

            error:
                "You must be logged in."

        });

    }


    next();

}


async function requireStaff(
    req,
    res,
    next
) {

    try {

        if (
            !req.session.user
        ) {

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
            role === "peasant"
        ) {

            return res.status(403).json({

                error:
                    "Staff access required."

            });

        }


        req.staffRole =
            role;


        next();

    } catch (error) {

        console.error(
            "REQUIRE STAFF ERROR:",
            error
        );

        res.status(500).json({

            error:
                "Could not verify staff permissions."

        });

    }

}


async function requireOwner(
    req,
    res,
    next
) {

    try {

        if (
            !req.session.user
        ) {

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
            role !== "owner"
        ) {

            return res.status(403).json({

                error:
                    "Owner access required."

            });

        }


        next();

    } catch (error) {

        console.error(
            "REQUIRE OWNER ERROR:",
            error
        );

        res.status(500).json({

            error:
                "Could not verify owner permissions."

        });

    }

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
                "ShrekBook API is working 🧌"

        });

    }
);


app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            status: "ok"

        });

    }
);


// ==================================================
// SIGNUP
// ==================================================

app.post(
    "/api/signup",
    async (
        req,
        res
    ) => {

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

            const username =
                String(
                    req.body.username ||
                    ""
                ).trim();

            const displayName =
                String(
                    req.body.display_name ||
                    username
                ).trim();


            if (
                !email ||
                !password ||
                !username
            ) {

                return res.status(400).json({

                    error:
                        "Email, password and username are required."

                });

            }


            const {
                data,
                error
            } =
                await supabase.auth.admin
                    .createUser({

                        email,

                        password,

                        email_confirm:
                            true

                    });


            if (error) {

                return res.status(400).json({

                    error:
                        error.message

                });

            }


            const user =
                data.user;


            const {
                error:
                    profileError
            } =
                await supabase
                    .from("profiles")
                    .insert({

                        id:
                            user.id,

                        username,

                        display_name:
                            displayName,

                        avatar:
                            null,

                        bio:
                            "",

                        gyatt:
                            0,

                        cat:
                            0,

                        ogred:
                            0

                    });


            if (
                profileError
            ) {

                await supabase.auth.admin
                    .deleteUser(
                        user.id
                    );

                return res.status(500).json({

                    error:
                        profileError.message

                });

            }


            res.status(201).json({

                success:
                    true,

                message:
                    "Account created successfully."

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
    async (
        req,
        res
    ) => {

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
                        "Please enter your email and password."

                });

            }


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

                return res.status(401).json({

                    error:
                        error.message

                });

            }


            const user =
                data.user;


            const ban =
                await getActiveBanByUserId(
                    user.id
                );


            if (ban) {

                return res.status(403).json({

                    error:
                        `You are banned. Reason: ${ban.reason}`

                });

            }


            const {
                data: profile,
                error:
                    profileError
            } =
                await supabase
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
                        user.id
                    )
                    .maybeSingle();


            if (profileError) {

                return res.status(500).json({

                    error:
                        profileError.message

                });

            }


            req.session.user = {

                id:
                    user.id,

                email:
                    user.email,

                username:
                    profile?.username ||
                    "",

                display_name:
                    profile?.display_name ||
                    profile?.username ||
                    "",

                avatar:
                    getAvatar(
                        profile?.avatar
                    )

            };


            await new Promise(
                (
                    resolve,
                    reject
                ) => {

                    req.session.save(
                        error => {

                            if (error) {
                                reject(error);
                            } else {
                                resolve();
                            }

                        }
                    );

                }
            );


            res.json({

                success:
                    true,

                user:
                    req.session.user

            });

        } catch (error) {

            console.error(
                "LOGIN ERROR:",
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


// ==================================================
// LOGOUT
// ==================================================

app.post(
    "/api/logout",
    (
        req,
        res
    ) => {

        req.session.destroy(
            error => {

                if (error) {

                    return res.status(500).json({

                        error:
                            "Could not log out."

                    });

                }


                res.json({

                    success:
                        true

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
    async (
        req,
        res
    ) => {

        try {

            if (
                !req.session.user
            ) {

                return res.json({

                    loggedIn:
                        false,

                    user:
                        null

                });

            }


            const {
                data: profile
            } =
                await supabase
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
                        req.session.user.id
                    )
                    .maybeSingle();


            if (!profile) {

                return res.json({

                    loggedIn:
                        false,

                    user:
                        null

                });

            }


            const role =
                await getUserRole(
                    profile.id
                );


            res.json({

                loggedIn:
                    true,

                user: {

                    ...profile,

                    avatar:
                        getAvatar(
                            profile.avatar
                        ),

                    role

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

                    upsert:
                        false

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
// USERS
// ==================================================

app.get(
    "/api/users",
    async (
        req,
        res
    ) => {

        try {

            const {
                data: users,
                error: usersError
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
                        last_seen
                    `)
                    .order(
                        "created_at",
                        {
                            ascending:
                                false
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
                error:
                    reactionsError
            } =
                await supabase
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

                        gyatt:
                            0,

                        cat:
                            0,

                        ogred:
                            0

                    };

                }


                if (
                    reaction.type ===
                    "gyatt"
                ) {

                    reactionCounts[userId]
                        .gyatt++;

                }


                if (
                    reaction.type ===
                    "cat"
                ) {

                    reactionCounts[userId]
                        .cat++;

                }


                if (
                    reaction.type ===
                    "ogred"
                ) {

                    reactionCounts[userId]
                        .ogred++;

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


            res.json(
                result
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
// ONE USER
// ==================================================

app.get(
    "/api/users/:id",
    async (
        req,
        res
    ) => {

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
            } =
                await supabase
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
                            ascending:
                                false
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
    async (
        req,
        res
    ) => {

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
            } =
                await supabase
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


            req.session.user
                .display_name =
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

                        success:
                            true,

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
    async (
        req,
        res
    ) => {

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

                            upsert:
                                true

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

                success:
                    true,

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
// POSTS
// ==================================================

app.get(
    "/api/posts",
    async (
        req,
        res
    ) => {

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
                            ascending:
                                false
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


            res.json(
                result
            );

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
    async (
        req,
        res
    ) => {

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


            let imageUrl =
                null;


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


            res.status(201).json(
                data
            );

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
    async (
        req,
        res
    ) => {

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


            res.json(
                result
            );

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
    async (
        req,
        res
    ) => {

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


            let imageUrl =
                null;


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


            res.status(201).json(
                data
            );

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

        if (
            !req.session.user
        ) {

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

            success:
                true,

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
    (
        req,
        res
    ) =>
        addReaction(
            req,
            res,
            "gyatt"
        )
);


app.post(
    "/api/users/:id/cat",
    (
        req,
        res
    ) =>
        addReaction(
            req,
            res,
            "cat"
        )
);


app.post(
    "/api/users/:id/ogred",
    (
        req,
        res
    ) =>
        addReaction(
            req,
            res,
            "ogred"
        )
);


// ==================================================
// HEARTBEAT
// ==================================================

async function heartbeat(
    req,
    res
) {

    try {

        if (!req.session.user) {

            return res.status(401).json({

                error:
                    "You must be logged in."

            });

        }


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

            success:
                true

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


// Original heartbeat route.
app.post(
    "/api/heartbeat",
    requireLogin,
    heartbeat
);


// ==================================================
// ONLINE COMPATIBILITY ROUTE
// ==================================================
// The frontend was requesting /api/online.
// Keep it as an alias to the heartbeat so the old
// frontend keeps working without changing anything
// else in the site.

app.post(
    "/api/online",
    requireLogin,
    heartbeat
);


// ==================================================
// ADMIN USERS
// ==================================================

app.get(
    "/api/admin/users",
    requireStaff,
    async (
        req,
        res
    ) => {

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


            res.json(
                result
            );

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
// CHANGE USER ROLE
// ==================================================

app.post(
    "/api/admin/role",
    requireOwner,
    async (
        req,
        res
    ) => {

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
                )
                    .trim()
                    .toLowerCase();


            const allowedRoles = [

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
                targetUserId ===
                process.env.OWNER_ID
            ) {

                return res.status(403).json({

                    error:
                        "The Owner cannot be modified."

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
                        "The Owner cannot be modified."

                });

            }


            if (
                newRole ===
                "peasant"
            ) {

                if (
                    existingAdmin
                ) {

                    const {
                        error:
                            deleteError
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

                }


                if (
                    oldRole !==
                    "peasant"
                ) {

                    const {
                        error:
                            revokeError
                    } =
                        await supabase
                            .from(
                                "staff_revocations"
                            )
                            .insert({

                                user_id:
                                    targetUserId,

                                previous_role:
                                    oldRole,

                                reason:
                                    "Staff role revoked.",

                                revoked_by:
                                    currentUserId,

                                active:
                                    true

                            });


                    if (
                        revokeError &&
                        !(
                            revokeError.code ===
                                "42P01" ||
                            revokeError.message
                                ?.toLowerCase()
                                .includes(
                                    "relation"
                                ) ||
                            revokeError.message
                                ?.toLowerCase()
                                .includes(
                                    "schema cache"
                                )
                        )
                    ) {

                        console.error(
                            "REVOCATION ERROR:",
                            revokeError
                        );

                    }

                }


                return res.json({

                    success:
                        true,

                    message:
                        `Role changed from ${oldRole} to peasant.`,

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

                success:
                    true,

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
// ADMIN STAFF LIST
// ==================================================

app.get(
    "/api/admin/staff",
    requireStaff,
    async (
        req,
        res
    ) => {

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


            if (
                process.env.OWNER_ID
            ) {

                const alreadyListed =
                    result.some(
                        member =>
                            member.user_id ===
                            process.env.OWNER_ID
                    );


                if (!alreadyListed) {

                    const {
                        data: ownerProfile
                    } =
                        await supabase
                            .from("profiles")
                            .select(`
                                id,
                                username,
                                display_name,
                                avatar,
                                created_at
                            `)
                            .eq(
                                "id",
                                process.env.OWNER_ID
                            )
                            .maybeSingle();


                    if (ownerProfile) {

                        result.unshift({

                            user_id:
                                ownerProfile.id,

                            role:
                                "owner",

                            created_at:
                                ownerProfile.created_at,

                            username:
                                ownerProfile.username,

                            display_name:
                                ownerProfile.display_name,

                            avatar:
                                getAvatar(
                                    ownerProfile.avatar
                                )

                        });

                    }

                }

            }


            res.json({

                success:
                    true,

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
// BAN LIST
// ==================================================

app.get(
    "/api/admin/bans",
    requireStaff,
    async (
        req,
        res
    ) => {

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

                console.error(
                    "GET BANS SUPABASE ERROR:",
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
                    "Server error while loading bans."

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
    async (
        req,
        res
    ) => {

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
                data: authData,
                error: authError
            } =
                await supabase.auth.admin
                    .getUserById(
                        userId
                    );


            if (authError) {

                return res.status(500).json({

                    error:
                        authError.message

                });

            }


            const email =
                normalizeEmail(
                    authData?.user?.email
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
                            email ||
                            null,

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

                success:
                    true,

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
    async (
        req,
        res
    ) => {

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

                success:
                    true,

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

app.get(
    "/api/admin/kicks",
    requireStaff,
    async (
        req,
        res
    ) => {

        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("kicks")
                    .select("*")
                    .order(
                        "kicked_at",
                        {
                            ascending:
                                false
                        }
                    );


            if (error) {

                if (
                    error.code ===
                        "42P01" ||
                    error.message
                        ?.toLowerCase()
                        .includes(
                            "relation"
                        ) ||
                    error.message
                        ?.toLowerCase()
                        .includes(
                            "schema cache"
                        )
                ) {

                    return res.json([]);

                }


                return res.status(500).json({

                    error:
                        error.message

                });

            }


            res.json(
                data || []
            );

        } catch (error) {

            console.error(
                "GET KICKS ERROR:",
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
// KICK USER
// ==================================================

app.post(
    "/api/admin/kick",
    requireStaff,
    async (
        req,
        res
    ) => {

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

                if (
                    error.code ===
                        "42P01" ||
                    error.message
                        ?.toLowerCase()
                        .includes(
                            "relation"
                        ) ||
                    error.message
                        ?.toLowerCase()
                        .includes(
                            "schema cache"
                        )
                ) {

                    return res.status(500).json({

                        error:
                            "The kicks table does not exist in Supabase yet."

                    });

                }


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
                "KICK USER ERROR:",
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
// UNKICK USER
// ==================================================

app.post(
    "/api/admin/unkick",
    requireStaff,
    async (
        req,
        res
    ) => {

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
                    .from("kicks")
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

                success:
                    true,

                message:
                    "Kick removed successfully."

            });

        } catch (error) {

            console.error(
                "UNKICK ERROR:",
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
// KICK HISTORY
// ==================================================

app.get(
    "/api/admin/kick-history",
    requireStaff,
    async (
        req,
        res
    ) => {

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
                "KICK HISTORY ERROR:",
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
// REVOKE STAFF
// ==================================================

app.post(
    "/api/admin/revokes",
    requireStaff,
    async (
        req,
        res
    ) => {

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


            const actorId =
                req.session.user.id;


            const actorRole =
                req.staffRole ||
                await getUserRole(
                    actorId
                );


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
                        "The owner cannot be revoked."

                });

            }


            if (
                actorRole !== "owner" &&
                targetRole ===
                    "administrator"
            ) {

                return res.status(403).json({

                    error:
                        "Only the owner can revoke an administrator."

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

                        previous_role:
                            targetRole,

                        reason:
                            reason ||
                            "Staff powers revoked.",

                        revoked_by:
                            actorId,

                        active:
                            true

                    });


            if (revokeError) {

                return res.status(500).json({

                    error:
                        revokeError.message

                });

            }


            const {
                error: deleteError
            } =
                await supabase
                    .from("admins")
                    .delete()
                    .eq(
                        "user_id",
                        userId
                    );


            if (deleteError) {

                return res.status(500).json({

                    error:
                        deleteError.message

                });

            }


            res.json({

                success:
                    true,

                message:
                    "Staff powers revoked."

            });

        } catch (error) {

            console.error(
                "REVOKE ERROR:",
                error
            );

            res.status(500).json({

                error:
                    "Could not revoke staff powers."

            });

        }

    }
);


// ==================================================
// RESTORE REVOCATION
// ==================================================

app.post(
    "/api/admin/revokes/:id/restore",
    requireStaff,
    async (
        req,
        res
    ) => {

        try {

            const id =
                req.params.id;


            const {
                data: revoke,
                error: revokeError
            } =
                await supabase
                    .from("staff_revocations")
                    .select(`
                        id,
                        user_id,
                        active
                    `)
                    .eq(
                        "id",
                        id
                    )
                    .maybeSingle();


            if (revokeError) {

                return res.status(500).json({

                    error:
                        revokeError.message

                });

            }


            if (!revoke) {

                return res.status(404).json({

                    error:
                        "Revocation not found."

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
                        id
                    );


            if (error) {

                return res.status(500).json({

                    error:
                        error.message

                });

            }


            res.json({

                success:
                    true

            });

        } catch (error) {

            console.error(
                "RESTORE REVOKE ERROR:",
                error
            );

            res.status(500).json({

                error:
                    "Could not restore revocation."

            });

        }

    }
);


// ==================================================
// GET REVOKES
// ==================================================

app.get(
    "/api/admin/revokes",
    requireStaff,
    async (
        req,
        res
    ) => {

        try {

            const {
                data: revocations,
                error
            } =
                await supabase
                    .from("staff_revocations")
                    .select(`
                        id,
                        user_id,
                        previous_role,
                        reason,
                        revoked_by,
                        created_at
                    `)
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


            const result = [];


            for (
                const revoke of
                revocations || []
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
                            revoke.user_id
                        )
                        .maybeSingle();


                result.push({

                    id:
                        revoke.id,

                    user_id:
                        revoke.user_id,

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
                        ),

                    previous_role:
                        revoke.previous_role ||
                        "Unknown",

                    reason:
                        revoke.reason ||
                        "No reason provided.",

                    revoked_by:
                        revoke.revoked_by,

                    created_at:
                        revoke.created_at

                });

            }


            res.json({

                success:
                    true,

                revokes:
                    result

            });

        } catch (error) {

            console.error(
                "GET REVOKES ERROR:",
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


// ==================================================
// ADMINISTRATORS COMPATIBILITY ROUTE
// ==================================================

app.get(
    "/api/admin/administrators",
    requireStaff,
    async (
        req,
        res
    ) => {

        try {

            const {
                data,
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


            const result = [];


            for (
                const admin of
                data || []
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
                            admin.user_id
                        )
                        .maybeSingle();


                result.push({

                    user_id:
                        admin.user_id,

                    role:
                        admin.role,

                    created_at:
                        admin.created_at,

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

                success:
                    true,

                administrators:
                    result

            });

        } catch (error) {

            console.error(
                "ADMINISTRATORS API ERROR:",
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
// STAFF LIST COMPATIBILITY ROUTE
// ==================================================

app.get(
    "/api/admin/staff-list",
    requireStaff,
    async (
        req,
        res
    ) => {

        try {

            const {
                data,
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

                staff:
                    data || []

            });

        } catch (error) {

            console.error(
                "STAFF LIST ERROR:",
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
// ADMIN API FALLBACK
// ==================================================

app.use(
    "/api/admin",
    (
        req,
        res
    ) => {

        res.status(404).json({

            error:
                "Admin API endpoint not found.",

            path:
                req.originalUrl,

            method:
                req.method

        });

    }
);


// ==================================================
// GENERAL API FALLBACK
// ==================================================

app.use(
    "/api",
    (
        req,
        res
    ) => {

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

