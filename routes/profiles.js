const express = require("express");

const router = express.Router();

const supabase = require("../utils/supabase.js");


console.log(
    "🧌 PROFILES SUPABASE:",
    !!supabase,
    typeof supabase?.from
);


/* ==================================================
   GET ALL USERS
================================================== */

router.get(
    "/users",
    async (req, res) => {

        console.log("🔥 GET /api/users");

        console.log(
            "SUPABASE INSIDE ROUTE:",
            !!supabase,
            typeof supabase?.from
        );

        try {

            if (
                !supabase ||
                typeof supabase.from !== "function"
            ) {

                console.error(
                    "❌ SUPABASE CLIENT IS UNDEFINED"
                );

                return res.status(500).json({
                    error:
                        "Supabase client is unavailable."
                });

            }


            const {
                data,
                error
            } = await supabase
                .from("profiles")
                .select("*");


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


            console.log(
                "✅ USERS LOADED:",
                data?.length || 0
            );


            return res.json({

                success:
                    true,

                users:
                    data || [],

                data:
                    data || []

            });

        } catch (error) {

            console.error(
                "❌ USERS ROUTE CRASH:",
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
   GET ONE USER
================================================== */

router.get(
    "/users/:id",
    async (req, res) => {

        try {

            const userId =
                req.params.id;


            if (
                !supabase ||
                typeof supabase.from !== "function"
            ) {

                return res.status(500).json({
                    error:
                        "Supabase client is unavailable."
                });

            }


            const {
                data: user,
                error
            } = await supabase
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