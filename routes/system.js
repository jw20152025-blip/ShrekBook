// ==================================================
// SHREKBOOK SYSTEM ROUTES
// ==================================================

const express = require("express");

const router = express.Router();


// ==================================================
// TEST
// ==================================================

router.get(
    "/test",
    (req, res) => {

        res.json({

            success:
                true,

            message:
                "ShrekBook API is working 🧌"

        });

    }
);


// ==================================================
// HEALTH
// ==================================================

router.get(
    "/health",
    (req, res) => {

        res.json({

            status:
                "ok",

            uptime:
                process.uptime(),

            timestamp:
                new Date().toISOString()

        });

    }
);


// ==================================================
// ONLINE STATUS
// ==================================================

router.get(
    "/online",
    async (req, res) => {

        try {

            const {
                count,
                error
            } = await req.supabase
                .from("profiles")
                .select(
                    "id",
                    {
                        count: "exact",
                        head: true
                    }
                );


            if (error) {

                return res.status(500).json({
                    error:
                        error.message
                });

            }


            res.json({

                online:
                    0,

                registered:
                    count || 0

            });

        } catch (error) {

            console.error(
                "ONLINE ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);


module.exports = router;