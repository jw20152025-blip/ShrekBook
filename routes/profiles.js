const express = require("express");

const router = express.Router();

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
                    .select("*")
                    .order(
                        "username",
                        {
                            ascending: true
                        }
                    );


            if (error) {

                console.error(
                    "❌ SUPABASE USERS ERROR:",
                    error
                );

                return res.status(500).json({

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
                "❌ USERS ERROR:",
                error
            );

            return res.status(500).json({

                error:
                    error.message ||
                    "Server error."

            });

        }

    }
);


/* ==================================================
   GET ONE PROFILE
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

                console.error(
                    "❌ PROFILE ERROR:",
                    error
                );

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


            return res.json({

                success:
                    true,

                user:
                    user

            });

        } catch (error) {

            console.error(
                "❌ PROFILE ROUTE ERROR:",
                error
            );

            return res.status(500).json({

                error:
                    error.message ||
                    "Server error."

            });

        }

    }
);


module.exports =
    router;