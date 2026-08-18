// ============================================================
// SHREKBOOK - UNIFIED SERVER
// Persistent Supabase sessions
// Login / Signup / Posts / Comments / Reactions / ShrekChat
// Admin / Kicks / Revokes / User deletion
// ============================================================

require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const PORT = process.env.PORT || 3000;

// ============================================================
// SUPABASE
// ============================================================

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.locals.supabase = supabase;

// ============================================================
// APP SETTINGS
// ============================================================

app.set("trust proxy", 1);

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

// ============================================================
// HELPERS
// ============================================================

function db() {
    return app.locals.supabase;
}

function cleanString(value) {
    return String(value ?? "").trim();
}

// ============================================================
// PERSISTENT SUPABASE SESSION STORE
// ============================================================

class SupabaseSessionStore extends session.Store {

    constructor() {
        super();

        this.table =
            "shrekbook_sessions";
    }

    async get(sid, callback) {

        try {

            const {
                data,
                error
            } = await db()
                .from(this.table)
                .select("sess,expire")
                .eq("sid", sid)
                .maybeSingle();

            if (error) {
                return callback(error);
            }

            if (!data) {
                return callback(null, null);
            }

            const expire =
                new Date(data.expire).getTime();

            if (
                Number.isFinite(expire) &&
                expire <= Date.now()
            ) {

                await db()
                    .from(this.table)
                    .delete()
                    .eq("sid", sid);

                return callback(null, null);
            }

            callback(
                null,
                data.sess
            );

        } catch (error) {

            callback(error);

        }
    }

    async set(sid, sess, callback) {

        try {

            let expire;

            if (
                sess &&
                sess.cookie &&
                sess.cookie.expires
            ) {

                expire =
                    new Date(
                        sess.cookie.expires
                    ).toISOString();

            } else {

                expire =
                    new Date(
                        Date.now() +
                        1000 * 60 * 60 * 24 * 30
                    ).toISOString();

            }

            const {
                error
            } = await db()
                .from(this.table)
                .upsert(
                    {
                        sid,
                        sess,
                        expire
                    },
                    {
                        onConflict: "sid"
                    }
                );

            if (error) {
                return callback(error);
            }

            callback(null);

        } catch (error) {

            callback(error);

        }
    }

    async destroy(sid, callback) {

        try {

            const {
                error
            } = await db()
                .from(this.table)
                .delete()
                .eq("sid", sid);

            callback(error || null);

        } catch (error) {

            callback(error);

        }
    }

    async touch(sid, sess, callback) {

        try {

            let expire;

            if (
                sess &&
                sess.cookie &&
                sess.cookie.expires
            ) {

                expire =
                    new Date(
                        sess.cookie.expires
                    ).toISOString();

            } else {

                expire =
                    new Date(
                        Date.now() +
                        1000 * 60 * 60 * 24 * 30
                    ).toISOString();

            }

            const {
                error
            } = await db()
                .from(this.table)
                .update({
                    expire
                })
                .eq("sid", sid);

            callback(error || null);

        } catch (error) {

            callback(error);

        }
    }

    async clear(callback) {

        try {

            const {
                error
            } = await db()
                .from(this.table)
                .delete()
                .lt(
                    "expire",
                    new Date().toISOString()
                );

            callback(error || null);

        } catch (error) {

            callback(error);

        }
    }
}

const sessionStore =
    new SupabaseSessionStore();

// ============================================================
// EXPRESS SESSION
// ============================================================

app.use(
    session({

        store:
            sessionStore,

        secret:
            process.env.SESSION_SECRET ||
            "CHANGE_THIS_SESSION_SECRET",

        resave:
            false,

        saveUninitialized:
            false,

        rolling:
            true,

        cookie: {

            httpOnly:
                true,

            secure:
                process.env.NODE_ENV === "production",

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

// ============================================================
// STATIC FILES
// ============================================================

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);

// ============================================================
// USER HELPERS
// ============================================================

function currentUser(req) {

    if (
        req.session &&
        req.session.user
    ) {

        return req.session.user;

    }

    return null;
}

function safeUser(profile) {

    if (!profile) {
        return null;
    }

    return {

        id:
            profile.id || null,

        username:
            profile.username || "",

        display_name:
            profile.display_name ||
            profile.username ||
            "",

        avatar_url:
            profile.avatar_url ||
            null,

        is_admin:
            profile.is_admin === true ||
            profile.role === "admin",

        role:
            profile.role ||
            null,

        is_revoked:
            profile.is_revoked === true ||
            profile.revoked === true,

        kick_until:
            profile.kick_until ||
            null

    };
}

async function getProfile(userId) {

    const {
        data,
        error
    } = await db()
        .from("profiles")
        .select("*")
        .eq(
            "id",
            userId
        )
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}

function isAdminUser(user) {

    return !!(
        user &&
        (
            user.is_admin === true ||
            user.role === "admin"
        )
    );
}

function isKicked(user) {

    if (
        !user ||
        !user.kick_until
    ) {

        return false;

    }

    const timestamp =
        new Date(
            user.kick_until
        ).getTime();

    if (
        Number.isNaN(timestamp)
    ) {

        return false;

    }

    return timestamp > Date.now();
}

// ============================================================
// REFRESH USER FROM DATABASE
// ============================================================

async function refreshSessionUser(req) {

    const sessionUser =
        currentUser(req);

    if (!sessionUser) {
        return null;
    }

    const profile =
        await getProfile(
            sessionUser.id
        );

    if (!profile) {

        await new Promise(
            resolve => {

                req.session.destroy(
                    () => resolve()
                );

            }
        );

        return null;
    }

    const user =
        safeUser(profile);

    if (
        user.is_revoked ||
        isKicked(user)
    ) {

        await new Promise(
            resolve => {

                req.session.destroy(
                    () => resolve()
                );

            }
        );

        return null;
    }

    req.session.user =
        user;

    return user;
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

async function requireLogin(
    req,
    res,
    next
) {

    try {

        const user =
            await refreshSessionUser(
                req
            );

        if (!user) {

            return res.status(401).json({
                error:
                    "You must be logged in."
            });

        }

        req.currentUser =
            user;

        next();

    } catch (error) {

        console.error(
            "AUTH CHECK ERROR:",
            error
        );

        res.status(500).json({
            error:
                "Authentication check failed."
        });

    }
}

async function requireAdmin(
    req,
    res,
    next
) {

    try {

        const user =
            await refreshSessionUser(
                req
            );

        if (!user) {

            return res.status(401).json({
                error:
                    "You must be logged in."
            });

        }

        if (
            !isAdminUser(user)
        ) {

            return res.status(403).json({
                error:
                    "Admin access required."
            });

        }

        req.currentUser =
            user;

        next();

    } catch (error) {

        console.error(
            "ADMIN AUTH ERROR:",
            error
        );

        res.status(500).json({
            error:
                "Admin authentication failed."
        });

    }
}

// ============================================================
// HEALTH
// ============================================================

app.get(
    "/api/health",
    (req, res) => {

        res.json({
            success: true,
            message:
                "ShrekBook is alive 🧌"
        });

    }
);

app.get(
    "/api/test",
    (req, res) => {

        res.json({
            success: true,
            message:
                "Unified ShrekBook server works."
        });

    }
);

// ============================================================
// SIGNUP
// ============================================================

app.post(
    "/api/signup",
    async (req, res) => {

        try {

            const username =
                cleanString(
                    req.body.username
                );

            const displayName =
                cleanString(
                    req.body.display_name
                );

            const email =
                cleanString(
                    req.body.email
                ).toLowerCase();

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

            if (
                username.length > 30
            ) {

                return res.status(400).json({
                    error:
                        "Username is too long."
                });

            }

            if (
                password.length < 6
            ) {

                return res.status(400).json({
                    error:
                        "Password must be at least 6 characters."
                });

            }

            const {
                data: existing,
                error: existingError
            } = await db()
                .from("profiles")
                .select("id,username")
                .ilike(
                    "username",
                    username
                )
                .maybeSingle();

            if (existingError) {

                return res.status(500).json({
                    error:
                        existingError.message
                });

            }

            if (existing) {

                return res.status(409).json({
                    error:
                        "That username is already taken."
                });

            }

            const {
                data: authData,
                error: authError
            } = await db()
                .auth
                .admin
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
            } = await db()
                .from("profiles")
                .insert({

                    id:
                        userId,

                    username,

                    display_name:
                        displayName ||
                        username

                })
                .select("*")
                .single();

            if (profileError) {

                await db()
                    .auth
                    .admin
                    .deleteUser(
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
                    safeUser(profile)

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

// ============================================================
// LOGIN
// ============================================================

app.post(
    "/api/login",
    async (req, res) => {

        try {

            const email =
                cleanString(
                    req.body.email
                ).toLowerCase();

            const password =
                String(
                    req.body.password || ""
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

            const {
                data,
                error
            } = await db()
                .auth
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

            const profile =
                await getProfile(
                    data.user.id
                );

            if (!profile) {

                return res.status(500).json({
                    error:
                        "Your account exists but your profile could not be found."
                });

            }

            const user =
                safeUser(profile);

            if (
                user.is_revoked
            ) {

                return res.status(403).json({
                    error:
                        "Your ShrekBook account has been revoked."
                });

            }

            if (
                isKicked(user)
            ) {

                return res.status(403).json({
                    error:
                        "You are currently kicked from ShrekBook."
                });

            }

            req.session.user =
                user;

            req.session.userId =
                user.id;

            req.session.supabaseUserId =
                data.user.id;

            // Explicitly save before responding.
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

            console.log(
                "LOGIN SESSION SAVED:",
                req.sessionID
            );

            res.json({

                success:
                    true,

                loggedIn:
                    true,

                user

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

// ============================================================
// CURRENT USER
// ============================================================

app.get(
    "/api/me",
    async (req, res) => {

        try {

            const user =
                await refreshSessionUser(
                    req
                );

            if (!user) {

                return res.json({

                    loggedIn:
                        false,

                    user:
                        null

                });

            }

            res.json({

                loggedIn:
                    true,

                user

            });

        } catch (error) {

            console.error(
                "ME ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Could not load current user."
            });

        }

    }
);

// ============================================================
// LOGOUT
// ============================================================

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
                    "connect.sid",
                    {
                        httpOnly:
                            true,

                        secure:
                            process.env.NODE_ENV === "production",

                        sameSite:
                            "lax"
                    }
                );

                res.json({
                    success:
                        true
                });

            }
        );

    }
);

// ============================================================
// USERS
// ============================================================

app.get(
    "/api/users",
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await db()
                .from("profiles")
                .select("*")
                .limit(100);

            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }

            res.json({

                users:
                    (data || [])
                        .map(safeUser)
                        .filter(Boolean)

            });

        } catch (error) {

            console.error(
                "USERS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

// ============================================================
// SINGLE USER
// ============================================================

app.get(
    "/api/users/:id",
    async (req, res) => {

        try {

            const profile =
                await getProfile(
                    req.params.id
                );

            if (!profile) {

                return res.status(404).json({
                    error:
                        "User not found."
                });

            }

            const {
                data: posts,
                error
            } = await db()
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
                    req.params.id
                )
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

                user:
                    safeUser(profile),

                posts:
                    posts || []

            });

        } catch (error) {

            console.error(
                "USER PROFILE ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

// ============================================================
// PROFILE UPDATE
// ============================================================

app.put(
    "/api/profile",
    requireLogin,
    async (req, res) => {

        try {

            const updates = {};

            const username =
                cleanString(
                    req.body.username
                );

            const displayName =
                cleanString(
                    req.body.display_name
                );

            if (username) {
                updates.username =
                    username;
            }

            if (displayName) {
                updates.display_name =
                    displayName;
            }

            if (
                Object.keys(updates).length === 0
            ) {

                return res.status(400).json({
                    error:
                        "Nothing to update."
                });

            }

            const {
                data,
                error
            } = await db()
                .from("profiles")
                .update(updates)
                .eq(
                    "id",
                    req.currentUser.id
                )
                .select("*")
                .single();

            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }

            req.session.user =
                safeUser(data);

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
                    safeUser(data)

            });

        } catch (error) {

            console.error(
                "PROFILE UPDATE ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

// ============================================================
// AVATAR UPLOAD
// ============================================================

app.post(
    "/api/profile/avatar",
    requireLogin,
    async (req, res) => {

        try {

            const image =
                String(
                    req.body.image || ""
                );

            if (!image) {

                return res.status(400).json({
                    error:
                        "No image supplied."
                });

            }

            const match =
                image.match(
                    /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/
                );

            if (!match) {

                return res.status(400).json({
                    error:
                        "Invalid image format."
                });

            }

            const mimeType =
                match[1] === "image/jpg"
                    ? "image/jpeg"
                    : match[1];

            const buffer =
                Buffer.from(
                    match[2],
                    "base64"
                );

            if (
                buffer.length >
                10 * 1024 * 1024
            ) {

                return res.status(400).json({
                    error:
                        "Image must be smaller than 10 MB."
                });

            }

            const extension =
                mimeType === "image/png"
                    ? "png"
                    : mimeType === "image/gif"
                        ? "gif"
                        : mimeType === "image/webp"
                            ? "webp"
                            : "jpg";

            const filename =
                `avatars/${req.currentUser.id}-${crypto.randomUUID()}.${extension}`;

            const {
                error: uploadError
            } = await db()
                .storage
                .from("images")
                .upload(
                    filename,
                    buffer,
                    {
                        contentType:
                            mimeType,

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
                data:
                    publicData
            } =
                db()
                    .storage
                    .from("images")
                    .getPublicUrl(
                        filename
                    );

            const imageUrl =
                publicData.publicUrl;

            const {
                data,
                error
            } = await db()
                .from("profiles")
                .update({
                    avatar_url:
                        imageUrl
                })
                .eq(
                    "id",
                    req.currentUser.id
                )
                .select("*")
                .single();

            if (error) {

                return res.status(500).json({
                    error:
                        "Image uploaded, but avatar_url could not be saved. Make sure profiles has an avatar_url column."
                });

            }

            req.session.user =
                safeUser(data);

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

                image_url:
                    imageUrl,

                avatar_url:
                    imageUrl

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

// ============================================================
// POSTS - GET
// ============================================================

app.get(
    "/api/",
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await db()
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
                );

            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }

            res.json({

                posts:
                    data || []

            });

        } catch (error) {

            console.error(
                "GET POSTS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

// ============================================================
// POSTS - CREATE
// ============================================================

app.post(
    "/api/",
    requireLogin,
    async (req, res) => {

        try {

            const content =
                cleanString(
                    req.body.content
                );

            const imageUrl =
                cleanString(
                    req.body.image_url
                );

            if (
                !content &&
                !imageUrl
            ) {

                return res.status(400).json({
                    error:
                        "Post cannot be empty."
                });

            }

            if (
                content.length > 5000
            ) {

                return res.status(400).json({
                    error:
                        "Post is too long."
                });

            }

            const {
                data,
                error
            } = await db()
                .from("posts")
                .insert({

                    user_id:
                        req.currentUser.id,

                    content:
                        content || null,

                    image_url:
                        imageUrl || null

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

                success:
                    true,

                post:
                    data

            });

        } catch (error) {

            console.error(
                "CREATE POST ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

// ============================================================
// COMMENTS - GET
// ============================================================

app.get(
    "/api/posts/:postId/comments",
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await db()
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

            res.json({

                comments:
                    data || []

            });

        } catch (error) {

            console.error(
                "GET COMMENTS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

// ============================================================
// COMMENTS - CREATE
// ============================================================

app.post(
    "/api/posts/:postId/comments",
    requireLogin,
    async (req, res) => {

        try {

            const content =
                cleanString(
                    req.body.content
                );

            if (!content) {

                return res.status(400).json({
                    error:
                        "Comment cannot be empty."
                });

            }

            if (
                content.length > 2000
            ) {

                return res.status(400).json({
                    error:
                        "Comment is too long."
                });

            }

            const {
                data,
                error
            } = await db()
                .from("comments")
                .insert({

                    post_id:
                        req.params.postId,

                    user_id:
                        req.currentUser.id,

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

                success:
                    true,

                comment:
                    data

            });

        } catch (error) {

            console.error(
                "ADD COMMENT ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

// ============================================================
// COMMENTS - DELETE
// ============================================================

app.delete(
    "/api/comments/:id",
    requireLogin,
    async (req, res) => {

        try {

            const {
                data: comment,
                error: findError
            } = await db()
                .from("comments")
                .select(
                    "id,user_id"
                )
                .eq(
                    "id",
                    req.params.id
                )
                .maybeSingle();

            if (findError) {

                return res.status(500).json({
                    error:
                        findError.message
                });

            }

            if (!comment) {

                return res.status(404).json({
                    error:
                        "Comment not found."
                });

            }

            if (
                comment.user_id !==
                req.currentUser.id
            ) {

                return res.status(403).json({
                    error:
                        "You can only delete your own comments."
                });

            }

            const {
                error
            } = await db()
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
                success:
                    true
            });

        } catch (error) {

            console.error(
                "DELETE COMMENT ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

// ============================================================
// REACTIONS - GET
// ============================================================

app.get(
    "/api/posts/:postId/reactions",
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await db()
                .from("reactions")
                .select(`
                    id,
                    post_id,
                    user_id,
                    reaction_type
                `)
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
                    reaction.reaction_type;

                counts[type] =
                    (
                        counts[type] ||
                        0
                    ) + 1;

            }

            let userReaction =
                null;

            const user =
                currentUser(req);

            if (user) {

                const own =
                    (data || []).find(
                        reaction =>
                            reaction.user_id ===
                            user.id
                    );

                if (own) {

                    userReaction =
                        own.reaction_type;

                }

            }

            res.json({

                counts,

                userReaction

            });

        } catch (error) {

            console.error(
                "GET REACTIONS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

// ============================================================
// REACTIONS - ADD / CHANGE
// ============================================================

app.post(
    "/api/posts/:postId/reactions",
    requireLogin,
    async (req, res) => {

        try {

            const reactionType =
                cleanString(
                    req.body.reaction_type ||
                    req.body.reaction
                ).toLowerCase();

            const allowed = [

                "like",
                "love",
                "laugh",
                "angry",
                "sad",
                "gyatt"

            ];

            if (
                !allowed.includes(
                    reactionType
                )
            ) {

                return res.status(400).json({
                    error:
                        "Invalid reaction type."
                });

            }

            const {
                data: existing,
                error: findError
            } = await db()
                .from("reactions")
                .select(
                    "id,reaction_type"
                )
                .eq(
                    "post_id",
                    req.params.postId
                )
                .eq(
                    "user_id",
                    req.currentUser.id
                )
                .maybeSingle();

            if (findError) {

                return res.status(500).json({
                    error:
                        findError.message
                });

            }

            if (existing) {

                const {
                    data,
                    error
                } = await db()
                    .from("reactions")
                    .update({

                        reaction_type:
                            reactionType

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

                    success:
                        true,

                    reaction:
                        data

                });

            }

            const {
                data,
                error
            } = await db()
                .from("reactions")
                .insert({

                    post_id:
                        req.params.postId,

                    user_id:
                        req.currentUser.id,

                    reaction_type:
                        reactionType

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

                success:
                    true,

                reaction:
                    data

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
);

// ============================================================
// REACTIONS - REMOVE
// ============================================================

app.delete(
    "/api/posts/:postId/reactions",
    requireLogin,
    async (req, res) => {

        try {

            const {
                error
            } = await db()
                .from("reactions")
                .delete()
                .eq(
                    "post_id",
                    req.params.postId
                )
                .eq(
                    "user_id",
                    req.currentUser.id
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
                "REMOVE REACTION ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

// ============================================================
// SHREKCHAT - GET
// ============================================================

app.get(
    "/api/shrekchat/messages",
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await db()
                .from(
                    "shrekchat_messages"
                )
                .select(`
                    id,
                    user_id,
                    message,
                    created_at
                `)
                .order(
                    "created_at",
                    {
                        ascending:
                            true
                    }
                )
                .limit(100);

            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }

            res.json({

                messages:
                    data || []

            });

        } catch (error) {

            console.error(
                "SHREKCHAT GET ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

// ============================================================
// SHREKCHAT - SEND
// ============================================================

app.post(
    "/api/shrekchat/messages",
    requireLogin,
    async (req, res) => {

        try {

            const message =
                cleanString(
                    req.body.message
                );

            if (!message) {

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

            const {
                data,
                error
            } = await db()
                .from(
                    "shrekchat_messages"
                )
                .insert({

                    user_id:
                        req.currentUser.id,

                    message

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

                success:
                    true,

                message:
                    data

            });

        } catch (error) {

            console.error(
                "SHREKCHAT SEND ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

// ============================================================
// SHREKCHAT - DELETE
// ============================================================

app.delete(
    "/api/shrekchat/messages/:id",
    requireLogin,
    async (req, res) => {

        try {

            const {
                data: message,
                error: findError
            } = await db()
                .from(
                    "shrekchat_messages"
                )
                .select(
                    "id,user_id"
                )
                .eq(
                    "id",
                    req.params.id
                )
                .maybeSingle();

            if (findError) {

                return res.status(500).json({
                    error:
                        findError.message
                });

            }

            if (!message) {

                return res.status(404).json({
                    error:
                        "Message not found."
                });

            }

            if (
                message.user_id !==
                req.currentUser.id
            ) {

                return res.status(403).json({
                    error:
                        "You can only delete your own messages."
                });

            }

            const {
                error
            } = await db()
                .from(
                    "shrekchat_messages"
                )
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
                success:
                    true
            });

        } catch (error) {

            console.error(
                "SHREKCHAT DELETE ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

// ============================================================
// ADMIN - CHECK
// ============================================================

app.get(
    "/api/admin/me",
    requireAdmin,
    (req, res) => {

        res.json({

            isAdmin:
                true,

            user:
                req.currentUser

        });

    }
);

// ============================================================
// ADMIN - USERS
// ============================================================

app.get(
    "/api/admin/users",
    requireAdmin,
    async (req, res) => {

        try {

            const {
                data,
                error
            } = await db()
                .from("profiles")
                .select("*")
                .order(
                    "username",
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

            res.json({

                users:
                    (data || [])
                        .map(safeUser)

            });

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

// ============================================================
// ADMIN - KICK
// ============================================================

app.post(
    "/api/admin/users/:id/kick",
    requireAdmin,
    async (req, res) => {

        try {

            const targetId =
                req.params.id;

            if (
                targetId ===
                req.currentUser.id
            ) {

                return res.status(400).json({
                    error:
                        "You cannot kick yourself."
                });

            }

            let minutes =
                Number(
                    req.body.minutes
                );

            if (
                !Number.isFinite(minutes)
            ) {

                minutes = 60;

            }

            minutes =
                Math.max(
                    1,
                    Math.min(
                        minutes,
                        43200
                    )
                );

            const kickUntil =
                new Date(
                    Date.now() +
                    minutes *
                    60 *
                    1000
                ).toISOString();

            const {
                data,
                error
            } = await db()
                .from("profiles")
                .update({

                    kick_until:
                        kickUntil

                })
                .eq(
                    "id",
                    targetId
                )
                .select("*")
                .single();

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
                    `User kicked for ${minutes} minutes.`,

                user:
                    safeUser(data)

            });

        } catch (error) {

            console.error(
                "ADMIN KICK ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

// ============================================================
// ADMIN - REVOKE
// ============================================================

app.post(
    "/api/admin/users/:id/revoke",
    requireAdmin,
    async (req, res) => {

        try {

            const targetId =
                req.params.id;

            if (
                targetId ===
                req.currentUser.id
            ) {

                return res.status(400).json({
                    error:
                        "You cannot revoke yourself."
                });

            }

            const {
                data,
                error
            } = await db()
                .from("profiles")
                .update({

                    is_revoked:
                        true

                })
                .eq(
                    "id",
                    targetId
                )
                .select("*")
                .single();

            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }

            // Disable Supabase authentication.
            await db()
                .auth
                .admin
                .updateUserById(
                    targetId,
                    {
                        ban_duration:
                            "876000h"
                    }
                );

            // Remove persistent sessions.
            await db()
                .from(
                    "shrekbook_sessions"
                )
                .delete()
                .filter(
                    "sess->>userId",
                    "eq",
                    targetId
                );

            res.json({

                success:
                    true,

                message:
                    "User revoked.",

                user:
                    safeUser(data)

            });

        } catch (error) {

            console.error(
                "ADMIN REVOKE ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

// ============================================================
// ADMIN - UNREVOKE
// ============================================================

app.post(
    "/api/admin/users/:id/unrevoke",
    requireAdmin,
    async (req, res) => {

        try {

            const targetId =
                req.params.id;

            const {
                data,
                error
            } = await db()
                .from("profiles")
                .update({

                    is_revoked:
                        false,

                    kick_until:
                        null

                })
                .eq(
                    "id",
                    targetId
                )
                .select("*")
                .single();

            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }

            await db()
                .auth
                .admin
                .updateUserById(
                    targetId,
                    {
                        ban_duration:
                            "none"
                    }
                );

            res.json({

                success:
                    true,

                message:
                    "User restored.",

                user:
                    safeUser(data)

            });

        } catch (error) {

            console.error(
                "ADMIN UNREVOKE ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

// ============================================================
// ADMIN - DELETE USER
// ============================================================

app.delete(
    "/api/admin/users/:id",
    requireAdmin,
    async (req, res) => {

        try {

            const targetId =
                req.params.id;

            if (
                targetId ===
                req.currentUser.id
            ) {

                return res.status(400).json({
                    error:
                        "You cannot delete yourself."
                });

            }

            await db()
                .from(
                    "shrekbook_sessions"
                )
                .delete()
                .filter(
                    "sess->>userId",
                    "eq",
                    targetId
                );

            const {
                error
            } = await db()
                .auth
                .admin
                .deleteUser(
                    targetId
                );

            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }

            await db()
                .from("profiles")
                .delete()
                .eq(
                    "id",
                    targetId
                );

            res.json({
                success:
                    true
            });

        } catch (error) {

            console.error(
                "ADMIN DELETE ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

// ============================================================
// API 404
// ============================================================

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({

            error:
                "API endpoint not found."

        });

    }
);

// ============================================================
// FRONTEND FALLBACK
// Express 5 compatible
// ============================================================

app.use(
    (req, res) => {

        if (
            req.method !== "GET"
        ) {

            return res.status(404).end();

        }

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );

    }
);

// ============================================================
// START
// ============================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🧌 ShrekBook running on port ${PORT}`
        );

        console.log(
            "💾 Persistent Supabase sessions enabled."
        );

    }
);