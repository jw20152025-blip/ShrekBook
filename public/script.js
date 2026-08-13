const express = require("express");
const path = require("path");
const session = require("express-session");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;

/* ==================================================
ENVIRONMENT
================================================== */

const SUPABASE_URL =
process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
process.env.SUPABASE_SERVICE_ROLE_KEY;

const SESSION_SECRET =
process.env.SESSION_SECRET;

if (
!SUPABASE_URL ||
!SUPABASE_SERVICE_ROLE_KEY
) {


console.error(
    "❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
);

process.exit(1);


}

if (!SESSION_SECRET) {


console.error(
    "❌ Missing SESSION_SECRET."
);

process.exit(1);


}

/* ==================================================
SUPABASE
================================================== */

const supabase =
createClient(
SUPABASE_URL,
SUPABASE_SERVICE_ROLE_KEY
);

/* ==================================================
EXPRESS
================================================== */

app.use(
express.json({
limit: "7mb"
})
);

app.use(
express.urlencoded({
extended: true
})
);

app.set(
"trust proxy",
1
);

/* ==================================================
SESSION
================================================== */

app.use(
session({

    secret:
        SESSION_SECRET,

    resave:
        false,

    saveUninitialized:
        false,

    cookie: {

        httpOnly:
            true,

        secure:
            process.env.NODE_ENV ===
            "production",

        sameSite:
            "lax",

        maxAge:
            1000 *
            60 *
            60 *
            24 *
            30

    }

})


);

/* ==================================================
STATIC FILES
================================================== */

app.use(
express.static(
path.join(
__dirname,
"public"
)
)
);

/* ==================================================
TEST
================================================== */

app.get(
"/api/test",
(req, res) => {


    res.json({

        success:
            true,

        message:
            "ShrekBook server is alive 🧌"

    });

}


);

/* ==================================================
HEALTH
================================================== */

app.get(
"/api/health",
(req, res) => {


    res.json({

        ok:
            true,

        loggedIn:
            !!req.session.user

    });

}


);

/* ==================================================
SIGNUP
================================================== */

app.post(
"/api/signup",
async (req, res) => {

    try {

        const {
            username,
            display_name,
            email,
            password
        } = req.body;


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


        const {
            data: existingProfile,
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


        if (existingProfile) {

            return res.status(400).json({

                error:
                    "That username is already taken."

            });

        }


        const {
            data: authData,
            error: authError
        } = await supabase.auth.admin.createUser({

            email:
                email,

            password:
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

                username:
                    username,

                display_name:
                    display_name ||
                    username,

                avatar:
                    null,

                bio:
                    "",

                cat:
                    0,

                gyatt:
                    0,

                ogres:
                    0

            })
            .select()
            .single();


        if (profileError) {

            await supabase.auth.admin.deleteUser(
                userId
            );


            return res.status(500).json({

                error:
                    profileError.message

            });

        }


        res.status(201).json({

            success:
                true,

            user:
                profile

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

/* ==================================================
LOGIN
================================================== */

app.post(
"/api/login",
async (req, res) => {


    try {

        const {
            email,
            password
        } = req.body;


        if (
            !email ||
            !password
        ) {

            return res.status(400).json({

                error:
                    "Email and password are required."

            });

        }


        const {
            data,
            error
        } = await supabase.auth.signInWithPassword({

            email:
                email,

            password:
                password

        });


        if (error) {

            return res.status(401).json({

                error:
                    error.message

            });

        }


        const authUser =
            data.user;


        let {
            data: profile,
            error: profileError
        } = await supabase
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


        /*
         * Create a missing profile automatically.
         */

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
                    .slice(
                        0,
                        20
                    );


            if (!username) {

                username =
                    "user";

            }


            const originalUsername =
                username;

            let number =
                1;


            while (true) {

                const {
                    data: existing
                } = await supabase
                    .from("profiles")
                    .select("id")
                    .eq(
                        "username",
                        username
                    )
                    .maybeSingle();


                if (!existing) {
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

                    cat:
                        0,

                    gyatt:
                        0,

                    ogres:
                        0

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
                newProfile;

        }


        req.session.user = {

            id:
                profile.id,

            username:
                profile.username,

            display_name:
                profile.display_name

        };


        await new Promise(
            (resolve, reject) => {

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
                profile

        });


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

/* ==================================================
LOGOUT
================================================== */

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


            res.json({

                success:
                    true

            });

        }
    );

}


);

/* ==================================================
CURRENT USER
================================================== */

app.get(
"/api/me",
async (req, res) => {


    try {

        if (!req.session.user) {

            return res.json({

                loggedIn:
                    false

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

            loggedIn:
                true,

            user:
                data

        });


    } catch (error) {

        res.status(500).json({

            error:
                error.message

        });

    }

}


);

/* ==================================================
GET ALL USERS
================================================== */

app.get(
"/api/users",
async (req, res) => {


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
                cat,
                gyatt,
                ogres,
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


        res.json(
            data || []
        );


    } catch (error) {

        res.status(500).json({

            error:
                "Server error."

        });

    }

}

);

/* ==================================================
GET ONE USER
================================================== */

app.get(
"/api/users/:id",
async (req, res) => {


    try {

        const userId =
            req.params.id;


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


        if (
            profileError ||
            !profile
        ) {

            return res.status(404).json({

                error:
                    "User not found."

            });

        }


        res.json(
            profile
        );


    } catch (error) {

        res.status(500).json({

            error:
                "Server error."

        });

    }

}


);

/* ==================================================
UPDATE OWN PROFILE
================================================== */

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


        const {
            display_name,
            bio
        } = req.body;


        const userId =
            req.session.user.id;


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
                    ).trim()

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


        req.session.user.display_name =
            data.display_name;


        res.json({

            success:
                true,

            user:
                data

        });


    } catch (error) {

        res.status(500).json({

            error:
                error.message

        });

    }

}


);

/* ==================================================
AVATAR UPLOAD
================================================== */

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


        const allowedTypes = [

            "image/png",
            "image/jpeg",
            "image/webp",
            "image/gif"

        ];


        if (
            !allowedTypes.includes(
                fileType
            )
        ) {

            return res.status(400).json({

                error:
                    "Unsupported image type."

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
                    "Avatar must be under 5MB."

            });

        }


        const extensions = {

            "image/png":
                "png",

            "image/jpeg":
                "jpg",

            "image/webp":
                "webp",

            "image/gif":
                "gif"

        };


        const extension =
            extensions[fileType];


        const userId =
            req.session.user.id;


        const storagePath =
            `${userId}/avatar-${Date.now()}.${extension}`;


        const {
            error: uploadError
        } = await supabase.storage
            .from("avatars")
            .upload(
                storagePath,
                buffer,
                {

                    contentType:
                        fileType,

                    upsert:
                        true

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
        } = supabase.storage
            .from("avatars")
            .getPublicUrl(
                storagePath
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
                userId
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

/* ==================================================
REACTIONS
================================================== */

const reactionColumns = {


cat:
    "cat",

gyatt:
    "gyatt",

ogre:
    "ogres"


};

async function giveReaction(
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


    const recipientId =
        req.params.id;


    const giverId =
        req.session.user.id;


    if (
        recipientId ===
        giverId
    ) {

        return res.status(400).json({

            error:
                "You cannot give yourself a reaction."

        });

    }


    const column =
        reactionColumns[type];


    if (!column) {

        return res.status(400).json({

            error:
                "Invalid reaction."

        });

    }


    const {
        data: recipient,
        error: lookupError
    } = await supabase
        .from("profiles")
        .select("*")
        .eq(
            "id",
            recipientId
        )
        .maybeSingle();


    if (
        lookupError ||
        !recipient
    ) {

        return res.status(404).json({

            error:
                "User not found."

        });

    }


    const currentValue =
        Number(
            recipient[column] || 0
        );


    const {
        data: updated,
        error: updateError
    } = await supabase
        .from("profiles")
        .update({

            [column]:
                currentValue + 1

        })
        .eq(
            "id",
            recipientId
        )
        .select()
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

        reaction:
            type,

        user:
            updated

    });


} catch (error) {

    console.error(
        "REACTION ERROR:",
        error
    );


    res.status(500).json({

        error:
            error.message

    });

}


}

app.post(
"/api/users/:id/cat",
async (req, res) => {


    await giveReaction(
        req,
        res,
        "cat"
    );

}

);

app.post(
"/api/users/:id/gyatt",
async (req, res) => {


    await giveReaction(
        req,
        res,
        "gyatt"
    );

}


);

app.post(
"/api/users/:id/ogre",
async (req, res) => {


    await giveReaction(
        req,
        res,
        "ogre"
    );

}


);

/* ==================================================
POSTS
================================================== */

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
            const post of posts
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
                    "Unknown"

            });

        }


        res.json(
            result
        );


    } catch (error) {

        res.status(500).json({

            error:
                error.message

        });

    }

}


);

/* ==================================================
CREATE POST
================================================== */

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

                content:
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


        res.status(201).json(
            data
        );


    } catch (error) {

        res.status(500).json({

            error:
                error.message

        });

    }

}


);

/* ==================================================
COMMENTS
================================================== */

app.get(
"/api/posts/:postId/comments",
async (req, res) => {

    try {

        const {
            postId
        } = req.params;


        const {
            data,
            error
        } = await supabase
            .from("comments")
            .select("*")
            .eq(
                "post_id",
                postId
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


        res.json(
            data || []
        );


    } catch (error) {

        res.status(500).json({

            error:
                error.message

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


        const {
            postId
        } = req.params;


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


        if (
            content.length >
            500
        ) {

            return res.status(400).json({

                error:
                    "Comment is too long."

            });

        }


        const {
            data,
            error
        } = await supabase
            .from("comments")
            .insert({

                post_id:
                    postId,

                user_id:
                    req.session.user.id,

                content:
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


        res.status(201).json(
            data
        );


    } catch (error) {

        res.status(500).json({

            error:
                error.message

        });

    }

}


);

/* ==================================================
START SERVER
================================================== */

app.listen(
PORT,
"0.0.0.0",
() => {


    console.log(
        `🧌 ShrekBook running on port ${PORT}`
    );

}


);
