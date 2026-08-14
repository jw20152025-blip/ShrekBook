const express = require("express");

const router =
    express.Router();

const supabase =
    require("../utils/supabase.js");


/* ==================================================
   GET ALL USERS
================================================== */

router.get(
    "/users",
    async (req, res) => {

        try {

            console.log(
                "🔥 GET /api/users"
            );


            const {
                data,
                error
            } =
                await supabase
                    .from("profiles")
                    .select(
                        "id,username,display_name,avatar,bio"
                    )
                    .order(
                        "username",
                        {
                            ascending:
                                true
                        }
                    );


            if (error) {

                console.error(
                    "SUPABASE USERS ERROR:",
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
                    error.message ||
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
                data,
                error
            } =
                await supabase
                    .from("profiles")
                    .select("*")
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


            if (!data) {

                return res.status(404).json({
                    error:
                        "User not found."
                });

            }


            res.json({

                user:
                    data

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


module.exports =
    router;