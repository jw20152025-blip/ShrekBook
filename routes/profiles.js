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


module.exports =
    router;