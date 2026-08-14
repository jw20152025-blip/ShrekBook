/* ==================================================
   SHREKBOOK PROFILE ROUTES
================================================== */

const express = require("express");

const router = express.Router();

const supabase =
    require("../utils/supabase");

/* ==================================================
   ALL USERS
================================================== */

router.get(
    "/users",
    async (req, res) => {

        console.log(
            "🔥 GET /api/users"
        );

        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("profiles")
                    .select("*")
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );

            if (error) {

                console.error(
                    "USERS SUPABASE ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        error.message
                });

            }

            return res.json({

                success: true,

                users:
                    data || []

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

/* ==================================================
   SINGLE PROFILE
================================================== */

router.get(
    "/users/:id",
    async (req, res) => {

        try {

            const userId =
                req.params.id;

            const {
                data: user,
                error
            } =
                await supabase
                    .from("profiles")
                    .select("*")
                    .eq(
                        "id",
                        userId
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

            const {
                data: reactions
            } =
                await supabase
                    .from("reactions")
                    .select("type")
                    .eq(
                        "to_user_id",
                        userId
                    );

            const counts = {

                gyatt: 0,

                cat: 0,

                ogred: 0

            };

            for (
                const reaction
                of reactions || []
            ) {

                if (
                    Object.prototype
                        .hasOwnProperty
                        .call(
                            counts,
                            reaction.type
                        )
                ) {

                    counts[
                        reaction.type
                    ]++;

                }

            }

            res.json({

                user,

                counts

            });

        } catch (error) {

            console.error(
                "PROFILE ERROR:",
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
   UPDATE PROFILE
================================================== */

router.put(
    "/users/me",
    async (req, res) => {

        if (!req.session.user) {

            return res.status(401).json({
                error:
                    "You must be logged in."
            });

        }

        try {

            const {
                display_name,
                username,
                bio,
                avatar
            } = req.body;

            const updates = {};

            if (
                display_name !== undefined
            ) {
                updates.display_name =
                    String(
                        display_name
                    ).trim();
            }

            if (
                username !== undefined
            ) {
                updates.username =
                    String(
                        username
                    )
                    .trim()
                    .toLowerCase();
            }

            if (
                bio !== undefined
            ) {
                updates.bio =
                    String(
                        bio
                    );
            }

            if (
                avatar !== undefined
            ) {
                updates.avatar =
                    avatar;
            }

            const {
                data,
                error
            } =
                await supabase
                    .from("profiles")
                    .update(updates)
                    .eq(
                        "id",
                        req.session.user.id
                    )
                    .select()
                    .single();

            if (error) {

                return res.status(400).json({
                    error:
                        error.message
                });

            }

            req.session.user.username =
                data.username;

            req.session.user.display_name =
                data.display_name;

            req.session.save(() => {

                res.json({

                    success: true,

                    user: data

                });

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