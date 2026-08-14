"use strict";

const express =
require("express");

const router =
express.Router();

const supabase =
require("../utils/supabase.js");

/* =========================================================
AUTH CHECK
========================================================= */

function requireLogin(
req,
res,
next
) {


if (
    !req.session ||
    !req.session.user
) {

    return res.status(401).json({

        success:
            false,

        error:
            "You must be logged in."

    });

}


next();


}

/* =========================================================
GET ALL USERS
========================================================= */

router.get(
"/users",
async (req, res) => {


    try {

        const {
            data,
            error
        } =
            await supabase
                .from("profiles")
                .select(
                    "id,created_at,display_name,username,bio,avatar"
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                );


        if (error) {

            console.error(
                "❌ GET USERS:",
                error
            );


            return res.status(500).json({

                success:
                    false,

                error:
                    error.message

            });

        }


        return res.json({

            success:
                true,

            users:
                data || []

        });

    } catch (error) {

        console.error(
            "❌ USERS CRASH:",
            error
        );


        return res.status(500).json({

            success:
                false,

            error:
                error.message

        });

    }

}


);

/* =========================================================
GET ONE USER
========================================================= */

router.get(
"/users/:id",
async (req, res) => {


    try {

        const {
            data,
            error
        } =
            await supabase
                .from("profiles")
                .select(
                    "id,created_at,display_name,username,bio,avatar"
                )
                .eq(
                    "id",
                    req.params.id
                )
                .maybeSingle();


        if (error) {

            console.error(
                "❌ GET PROFILE:",
                error
            );


            return res.status(500).json({

                success:
                    false,

                error:
                    error.message

            });

        }


        if (!data) {

            return res.status(404).json({

                success:
                    false,

                error:
                    "Profile not found."

            });

        }


        return res.json({

            success:
                true,

            user:
                data

        });

    } catch (error) {

        console.error(
            "❌ PROFILE CRASH:",
            error
        );


        return res.status(500).json({

            success:
                false,

            error:
                error.message

        });

    }

}


);

/* =========================================================
UPDATE PROFILE
========================================================= */

router.put(
"/users/:id",
requireLogin,
async (req, res) => {


    try {

        const requestedId =
            String(
                req.params.id
            );


        const loggedInId =
            String(
                req.session.user.id
            );


        /*
         * You can ONLY edit your own profile.
         */

        if (
            requestedId !==
            loggedInId
        ) {

            return res.status(403).json({

                success:
                    false,

                error:
                    "You can only edit your own profile."

            });

        }


        const {

            display_name,
            username,
            bio,
            avatar

        } =
            req.body || {};


        const updates = {

            display_name:
                typeof display_name ===
                "string"
                    ?
                    display_name.trim()
                    :
                    "",

            username:
                typeof username ===
                "string"
                    ?
                    username.trim()
                    :
                    "",

            bio:
                typeof bio ===
                "string"
                    ?
                    bio.trim()
                    :
                    "",

            avatar:
                typeof avatar ===
                "string"
                    ?
                    avatar.trim()
                    :
                    ""

        };


        /*
         * Basic length protection.
         */

        if (
            updates.display_name.length >
            100
        ) {

            return res.status(400).json({

                success:
                    false,

                error:
                    "Display name is too long."

            });

        }


        if (
            updates.username.length >
            50
        ) {

            return res.status(400).json({

                success:
                    false,

                error:
                    "Username is too long."

            });

        }


        if (
            updates.bio.length >
            500
        ) {

            return res.status(400).json({

                success:
                    false,

                error:
                    "Bio is too long."

            });

        }


        if (
            updates.avatar.length >
            1000
        ) {

            return res.status(400).json({

                success:
                    false,

                error:
                    "Avatar URL is too long."

            });

        }


        /*
         * Check username uniqueness.
         */

        if (
            updates.username
        ) {

            const {
                data:
                    existingUser,
                error:
                    usernameError
            } =
                await supabase
                    .from("profiles")
                    .select("id")
                    .eq(
                        "username",
                        updates.username
                    )
                    .neq(
                        "id",
                        requestedId
                    )
                    .maybeSingle();


            if (usernameError) {

                console.error(
                    "❌ USERNAME CHECK:",
                    usernameError
                );


                return res.status(500).json({

                    success:
                        false,

                    error:
                        usernameError.message

                });

            }


            if (
                existingUser
            ) {

                return res.status(409).json({

                    success:
                        false,

                    error:
                        "That username is already taken."

                });

            }

        }


        /*
         * Update ONLY the four editable fields.
         *
         * id and created_at remain untouched.
         */

        const {
            data,
            error
        } =
            await supabase
                .from("profiles")
                .update(
                    updates
                )
                .eq(
                    "id",
                    requestedId
                )
                .select(
                    "id,created_at,display_name,username,bio,avatar"
                )
                .single();


        if (error) {

            console.error(
                "❌ UPDATE PROFILE:",
                error
            );


            return res.status(500).json({

                success:
                    false,

                error:
                    error.message

            });

        }


        /*
         * Keep the Express session's user info
         * synchronized with the updated profile.
         */

        req.session.user = {

            ...req.session.user,

            id:
                data.id,

            username:
                data.username ||
                req.session.user.username,

            display_name:
                data.display_name ||
                data.username ||
                req.session.user.display_name,

            avatar:
                data.avatar ||
                ""

        };


        req.session.save(
            saveError => {

                if (saveError) {

                    console.error(
                        "❌ SESSION SAVE:",
                        saveError
                    );

                }

            }
        );


        return res.json({

            success:
                true,

            user:
                data

        });

    } catch (error) {

        console.error(
            "🔥 UPDATE PROFILE CRASH:",
            error
        );


        return res.status(500).json({

            success:
                false,

            error:
                error.message ||
                "Could not update profile."

        });

    }

}


);

/* =========================================================
PROFILE POSTS
========================================================= */

router.get(
"/users/:id/posts",
async (req, res) => {


    try {

        const {
            data,
            error
        } =
            await supabase
                .from("posts")
                .select("*")
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

            /*
             * If your posts table uses a different
             * author column, the frontend profile
             * still loads without crashing.
             */

            console.error(
                "❌ PROFILE POSTS:",
                error
            );


            return res.json({

                success:
                    true,

                posts:
                    []

            });

        }


        return res.json({

            success:
                true,

            posts:
                data || []

        });

    } catch (error) {

        console.error(
            "❌ PROFILE POSTS CRASH:",
            error
        );


        return res.json({

            success:
                true,

            posts:
                []

        });

    }

}


);

module.exports =
router;
