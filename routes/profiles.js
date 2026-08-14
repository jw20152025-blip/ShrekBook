const express = require("express");

const router =
    express.Router();

const {
    supabase
} = require("../utils/supabase.js");


// GET PROFILE

router.get(
    "/users/:id",
    async (req, res) => {

        try {

            const userId =
                req.params.id;

            const {
                data: user,
                error
            } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .maybeSingle();


            if (error) {

                console.error(
                    "PROFILE ERROR:",
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


            res.json({
                user
            });

        } catch (error) {

            console.error(
                "PROFILE ROUTE ERROR:",
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
   GET ALL USERS
================================================== */

router.get("/users", async (req, res) => {

    console.log("🔥 /api/users reached");

    try {

        const result = await supabase
            .from("profiles")
            .select("*");

        console.log(
            "SUPABASE RESULT:",
            result
        );

        if (result.error) {

            console.error(
                "❌ SUPABASE ERROR:",
                result.error
            );

            return res.status(500).json({
                error: result.error.message
            });

        }

        return res.json({
            success: true,
            users: result.data || []
        });

    } catch (error) {

        console.error(
            "❌ USERS CRASH:",
            error
        );

        return res.status(500).json({
            error:
                error.message ||
                "Server error."
        });

    }

});
module.exports =
    router;