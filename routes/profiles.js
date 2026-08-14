const express = require("express");

const router = express.Router();

const {
    supabase
} = require("../server");

const {
    uploadImage
} = require("../utils/uploadImage");


/* ==================================================
GET ALL USERS
================================================== */

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
                    .select(`
                        id,
                        username,
                        display_name,
                        avatar,
                        bio,
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

            console.error(
                "GET USERS ERROR:",
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
GET ONE USER
================================================== */

router.get(
    "/users/:id",
    async (req, res) => {

        try {

            const id =
                req.params.id;


            const {
                data: profile,
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
                        created_at
                    `)
                    .eq(
                        "id",
                        id
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


            const {
                data: reactions,
                error: reactionError
            } =
                await supabase
                    .from("reactions")
                    .select("type")
                    .eq(
                        "to_user_id",
                        id
                    );


            if (reactionError) {

                return res.status(500).json({
                    error:
                        reactionError.message
                });

            }


            const counts = {

                gyatt:
                    0,

                cat:
                    0,

                ogred:
                    0

            };


            for (
                const reaction
                of reactions || []
            ) {

                if (
                    counts[
                        reaction.type
                    ] !== undefined
                ) {

                    counts[
                        reaction.type
                    ]++;

                }

            }


            res.json({

                ...profile,

                posts:
                    posts || [],

                reactions:
                    counts

            });


        } catch (error) {

            console.error(
                "GET USER ERROR:",
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
UPDATE PROFILE
================================================== */

router.put(
    "/profile",
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
                    req.body.display_name || ""
                ).trim();


            const bio =
                String(
                    req.body.bio || ""
                ).trim();


            const {
                data,
                error
            } =
                await supabase
                    .from("profiles")
                    .update({

                        display_name:
                            display_name,

                        bio:
                            bio

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


            req.session.user.display_name =
                data.display_name;


            res.json({

                success:
                    true,

                user:
                    data

            });


        } catch (error) {

            console.error(
                "PROFILE UPDATE ERROR:",
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
AVATAR UPLOAD
================================================== */

router.post(
    "/profile/avatar",
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


            const avatarUrl =
                await uploadImage(
                    fileData,
                    fileType,
                    fileName,
                    req.session.user.id
                );


            const {
                data: profile,
                error
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


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
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
                    error.message ||
                    "Server error."
            });

        }

    }
);


module.exports = router;