/* ==================================================
   SHREKBOOK POSTS
================================================== */

const express = require("express");

const router = express.Router();

const supabase =
    require("../utils/supabase");

/* ==================================================
   GET FEED
================================================== */

router.get(
    "/posts",
    async (req, res) => {

        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("posts")
                    .select(`
                        id,
                        user_id,
                        content,
                        created_at
                    `)
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    )
                    .limit(100);

            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }

            const posts =
                data || [];

            const userIds =
                [
                    ...new Set(
                        posts.map(
                            post =>
                                post.user_id
                        )
                    )
                ];

            let profiles = [];

            if (userIds.length) {

                const result =
                    await supabase
                        .from("profiles")
                        .select("*")
                        .in(
                            "id",
                            userIds
                        );

                if (!result.error) {
                    profiles =
                        result.data || [];
                }

            }

            const profileMap =
                new Map();

            for (
                const profile
                of profiles
            ) {

                profileMap.set(
                    profile.id,
                    profile
                );

            }

            const output =
                posts.map(
                    post => ({

                        ...post,

                        user:
                            profileMap.get(
                                post.user_id
                            ) || null

                    })
                );

            res.json({

                success: true,

                posts: output

            });

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

    }
);

/* ==================================================
   CREATE POST
================================================== */

router.post(
    "/posts",
    async (req, res) => {

        if (!req.session.user) {

            return res.status(401).json({
                error:
                    "You must be logged in."
            });

        }

        try {

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

            if (content.length > 5000) {

                return res.status(400).json({
                    error:
                        "Post is too long."
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

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

/* ==================================================
   DELETE POST
================================================== */

router.delete(
    "/posts/:id",
    async (req, res) => {

        if (!req.session.user) {

            return res.status(401).json({
                error:
                    "You must be logged in."
            });

        }

        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("posts")
                    .delete()
                    .eq(
                        "id",
                        req.params.id
                    )
                    .eq(
                        "user_id",
                        req.session.user.id
                    )
                    .select();

            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }

            if (!data || !data.length) {

                return res.status(404).json({
                    error:
                        "Post not found."
                });

            }

            res.json({
                success: true
            });

        } catch (error) {

            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);

module.exports = router;