
"use strict";

const express = require("express");

const router = express.Router();

const supabase = require("../utils/supabase.js");


/* =========================================================
   LOGIN
   POST /api/login
========================================================= */

router.post("/login", async (req, res) => {

    console.log("");
    console.log("====================================");
    console.log("🔐 LOGIN REQUEST");
    console.log("====================================");

    try {

        console.log("📦 REQUEST BODY:", req.body);


        /* -------------------------------------------------
           GET LOGIN DATA
        ------------------------------------------------- */

        const email = String(
            req.body?.email ||
            req.body?.username ||
            ""
        ).trim();

        const password = String(
            req.body?.password ||
            ""
        );


        console.log("📧 EMAIL:", email);
        console.log(
            "🔑 PASSWORD RECEIVED:",
            password.length > 0
        );


        /* -------------------------------------------------
           VALIDATION
        ------------------------------------------------- */

        if (!email || !password) {

            console.log(
                "❌ LOGIN REJECTED: missing credentials"
            );

            return res.status(400).json({
                success: false,
                error: "Email and password are required."
            });

        }


        /* -------------------------------------------------
           SUPABASE AUTH
        ------------------------------------------------- */

        console.log(
            "🔑 Attempting Supabase login for:",
            email
        );


        const {
            data,
            error
        } = await supabase.auth.signInWithPassword({

            email: email,

            password: password

        });


        if (error) {

            console.error(
                "❌ SUPABASE LOGIN ERROR:",
                error
            );

            return res.status(401).json({
                success: false,
                error:
                    error.message ||
                    "Invalid email or password."
            });

        }


        if (!data || !data.user) {

            console.error(
                "❌ SUPABASE RETURNED NO USER"
            );

            return res.status(401).json({
                success: false,
                error: "Login failed."
            });

        }


        const authUser =
            data.user;


        console.log(
            "✅ SUPABASE USER:",
            authUser.id
        );


        /* -------------------------------------------------
           GET PROFILE
        ------------------------------------------------- */

        let profile = null;


        try {

            const profileResult =
                await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", authUser.id)
                    .maybeSingle();


            if (profileResult.error) {

                console.warn(
                    "⚠️ PROFILE LOOKUP ERROR:",
                    profileResult.error
                );

            } else {

                profile =
                    profileResult.data;

            }

        } catch (profileError) {

            console.warn(
                "⚠️ PROFILE LOOKUP FAILED:",
                profileError
            );

        }


        /* -------------------------------------------------
           CREATE EXPRESS SESSION
        ------------------------------------------------- */

        req.session.user = {

            id:
                authUser.id,

            username:
                profile?.username ||
                authUser.email ||
                email,

            display_name:
                profile?.display_name ||
                profile?.username ||
                authUser.email ||
                email

        };


        console.log(
            "✅ EXPRESS SESSION CREATED:",
            req.session.user
        );


        /* -------------------------------------------------
           SAVE SESSION
        ------------------------------------------------- */

        req.session.save(
            (sessionError) => {

                if (sessionError) {

                    console.error(
                        "❌ SESSION SAVE ERROR:",
                        sessionError
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Login succeeded but the session could not be saved."
                    });

                }


                console.log(
                    "✅ EXPRESS SESSION SAVED:"
                );

                console.log(
                    req.session.user
                );


                /* -----------------------------------------
                   SUCCESS RESPONSE
                ----------------------------------------- */

                return res.status(200).json({

                    success: true,

                    message:
                        "Login successful.",

                    user:
                        req.session.user

                });

            }
        );

    } catch (error) {

        console.error(
            "🔥 LOGIN ROUTE CRASH:",
            error
        );


        return res.status(500).json({

            success: false,

            error:
                error.message ||
                "Server error."

        });

    }

});


/* =========================================================
   SESSION
   GET /api/session
========================================================= */

router.get("/session", (req, res) => {

    console.log(
        "ME SESSION:",
        req.session?.user
    );


    if (
        req.session &&
        req.session.user
    ) {

        return res.json({

            loggedIn: true,

            authenticated: true,

            user:
                req.session.user

        });

    }


    return res.json({

        loggedIn: false,

        authenticated: false,

        user: null

    });

});


/* =========================================================
   LOGOUT
   POST /api/logout
========================================================= */

router.post("/logout", (req, res) => {

    console.log(
        "🚪 LOGOUT REQUEST"
    );


    if (!req.session) {

        return res.json({
            success: true
        });

    }


    req.session.destroy((error) => {

        if (error) {

            console.error(
                "❌ LOGOUT ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                error:
                    "Logout failed."

            });

        }


        res.clearCookie("connect.sid");


        return res.json({

            success: true,

            message:
                "Logged out."

        });

    });

});


module.exports = router;
