
"use strict";

const express = require("express");

const router = express.Router();

const supabase =
    require("../utils/supabase.js");


/* =========================================================
   GET ALL PEOPLE
   GET /api/users
========================================================= */

router.get("/users", async (req, res) => {

    console.log("🔥 GET /api/users");

    try {

        const {
            data,
            error
        } = await supabase
            .from("profiles")
            .select("*")
            .order("created_at", {
                ascending: false
            });


        if (error) {

            console.error(
                "❌ PEOPLE SUPABASE ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                error: error.message,
                users: []
            });

        }


        return res.json({

            success: true,

            users:
                data || []

        });

    } catch (error) {

        console.error(
            "❌ PEOPLE CRASH:",
            error
        );

        return res.status(500).json({

            success: false,

            error:
                error.message,

            users: []

        });

    }

});


/* =========================================================
   GET ONE PROFILE
   GET /api/users/:id
========================================================= */

router.get(
    "/users/:id",
    async (req, res) => {

        try {

            const id =
                req.params.id;


            const {
                data,
                error
            } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", id)
                .maybeSingle();


            if (error) {

                console.error(
                    "❌ PROFILE ERROR:",
                    error
                );

                return res.status(500).json({

                    success: false,

                    error:
                        error.message

                });

            }


            if (!data) {

                return res.status(404).json({

                    success: false,

                    error:
                        "User not found."

                });

            }


            return res.json({

                success: true,

                user:
                    data

            });

        } catch (error) {

            console.error(
                "❌ PROFILE CRASH:",
                error
            );


            return res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }

    }
);


module.exports =
    router;

