const express = require("express");

const router = express.Router();

const {
    supabase
} = require("../server");

const {
    uploadImage
} = require("../utils/uploadImage");


/* ==================================================
GET POSTS
================================================== */

router.get(
    "/posts",
    async (req, res) => {

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
                    );


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            const result = [];


            for (
                const post
                of posts || []
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
                        profile?.avatar ||
                        null,

                    image:
                        post.image_url ||
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
                error:
                    "Server error."
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


            let imageUrl =
                null;


            const image =
                req.body.image;


            if (
                image &&
                image.data &&
                image.type &&
                image.name
            ) {

                imageUrl =
                    await uploadImage(
                        image.data,
                        image.type,
                        image.name,
                        req.session.user.id
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


            if (
                content.length >
                5000
            ) {

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

                        content:
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


            res.status(201).json(data);


        } catch (error) {

            console.error(
                "CREATE POST ERROR:",
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


/* ==================================================
GET COMMENTS
================================================== */

router.get(
    "/posts/:postId/comments",
    async (req, res) => {

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
                const comment
                of comments || []
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
                        profile?.avatar ||
                        null,

                    image:
                        comment.image_url ||
                        null

                });

            }


            res.json(result);


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


/* ==================================================
CREATE COMMENT
================================================== */

router.post(
    "/posts/:postId/comments",
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


            let imageUrl =
                null;


            const image =
                req.body.image;


            if (
                image &&
                image.data &&
                image.type &&
                image.name
            ) {

                imageUrl =
                    await uploadImage(
                        image.data,
                        image.type,
                        image.name,
                        req.session.user.id
                    );

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
            } =
                await supabase
                    .from("comments")
                    .insert({

                        post_id:
                            req.params.postId,

                        user_id:
                            req.session.user.id,

                        content:
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


            res.status(201).json(data);


        } catch (error) {

            console.error(
                "COMMENT ERROR:",
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