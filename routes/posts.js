
"use strict";

const express = require("express");

const router = express.Router();

const supabase =
    require("../utils/supabase.js");


/* =========================================================
   GET POSTS
   GET /api/posts
========================================================= */

router.get("/posts", async (req, res) => {

    console.log("🔥 GET /api/posts");


    try {

        const {
            data,
            error
        } = await supabase
            .from("posts")
            .select("*")
            .order("created_at", {
                ascending: false
            });


        if (error) {

            console.error(
                "❌ POSTS ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                error:
                    error.message,

                posts: []

            });

        }


        return res.json({

            success: true,

            posts:
                data || []

        });


    } catch (error) {

        console.error(
            "❌ POSTS CRASH:",
            error
        );


        return res.status(500).json({

            success: false,

            error:
                error.message,

            posts: []

        });

    }

});


/* =========================================================
   CREATE POST
   POST /api/posts
========================================================= */

router.post("/posts", async (req, res) => {

    console.log("📝 CREATE POST");


    try {

        if (
            !req.session ||
            !req.session.user
        ) {

            return res.status(401).json({

                success: false,

                error:
                    "You must be logged in."

            });

        }


        const userId =
            req.session.user.id;


        const content =
            String(
                req.body?.content ||
                ""
            ).trim();


        const imageUrl =
            String(
                req.body?.image_url ||
                req.body?.imageUrl ||
                ""
            ).trim();


        if (
            !content &&
            !imageUrl
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "Post cannot be empty."

            });

        }


        /*
         * Try the common ShrekBook post columns.
         */

        const post = {

            user_id:
                userId,

            content:
                content

        };


        if (imageUrl) {

            post.image_url =
                imageUrl;

        }


        const {
            data,
            error
        } = await supabase
            .from("posts")
            .insert(post)
            .select("*")
            .single();


        if (error) {

            console.error(
                "❌ CREATE POST ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }


        return res.status(201).json({

            success: true,

            post:
                data

        });


    } catch (error) {

        console.error(
            "❌ CREATE POST CRASH:",
            error
        );


        return res.status(500).json({

            success: false,

            error:
                error.message

        });

    }

});


module.exports =
    router;

