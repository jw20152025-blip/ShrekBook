/* ==================================================
   SHREKBOOK AUTH ROUTES
================================================== */

const express = require("express");
const router = express.Router();

const supabase = require("../utils/supabase.js");


/* ==================================================
   SIGNUP
================================================== */

router.post("/signup", async (req, res) => {

    try {

        const username =
            String(req.body.username || "").trim();

        const display_name =
            String(
                req.body.display_name ||
                username
            ).trim();

        const email =
            String(req.body.email || "").trim();

        const password =
            String(req.body.password || "");


        if (!username || !email || !password) {

            return res.status(400).json({
                error:
                    "Username, email, and password are required."
            });

        }


        /* ------------------------------------------
           CHECK USERNAME
        ------------------------------------------ */

        const {
            data: existing,
            error: usernameError
        } = await supabase
            .from("profiles")
            .select("id")
            .eq("username", username)
            .maybeSingle();


        if (usernameError) {

            console.error(
                "USERNAME CHECK ERROR:",
                usernameError
            );

            return res.status(500).json({
                error: usernameError.message
            });

        }


        if (existing) {

            return res.status(400).json({
                error:
                    "That username is already taken."
            });

        }


        /* ------------------------------------------
           CREATE SUPABASE AUTH USER
        ------------------------------------------ */

        const {
            data: authData,
            error: authError
        } =
            await supabase.auth.admin.createUser({

                email,

                password,

                email_confirm: true

            });


        if (authError) {

            console.error(
                "SUPABASE SIGNUP ERROR:",
                authError
            );

            return res.status(400).json({
                error: authError.message
            });

        }


        const userId =
            authData.user.id;


        /* ------------------------------------------
           CREATE PROFILE
        ------------------------------------------ */

        const {
            data: profile,
            error: profileError
        } =
            await supabase
                .from("profiles")
                .insert({

                    id: userId,

                    username,

                    display_name:
                        display_name || username,

                    avatar: null,

                    bio: ""

                })
                .select()
                .single();


        if (profileError) {

            console.error(
                "PROFILE CREATE ERROR:",
                profileError
            );


            await supabase.auth.admin
                .deleteUser(userId);


            return res.status(500).json({
                error:
                    profileError.message
            });

        }


        return res.status(201).json({

            success: true,

            user: profile

        });

    }

    catch (error) {

        console.error(
            "SIGNUP ERROR:",
            error
        );

        return res.status(500).json({
            error:
                error.message ||
                "Server error."
        });

    }

});


/* ==================================================
   LOGIN
================================================== */

router.post("/login", async (req, res) => {

    console.log("🔐 LOGIN REQUEST");

    try {

        const email =
            String(req.body.email || "").trim();

        const password =
            String(req.body.password || "");


        if (!email || !password) {

            return res.status(400).json({
                error:
                    "Email and password are required."
            });

        }


        console.log(
            "Attempting Supabase login for:",
            email
        );


        /* ------------------------------------------
           SUPABASE LOGIN
        ------------------------------------------ */

        const {
            data,
            error
        } =
            await supabase.auth.signInWithPassword({

                email,

                password

            });


        if (error) {

            console.error(
                "SUPABASE LOGIN ERROR:",
                error
            );

            return res.status(401).json({
                error:
                    error.message
            });

        }


        if (!data || !data.user) {

            return res.status(401).json({
                error:
                    "Login failed."
            });

        }


        console.log(
            "✅ Supabase user:",
            data.user.id
        );


        /* ------------------------------------------
           GET PROFILE
        ------------------------------------------ */

        let {
            data: profile,
            error: profileError
        } =
            await supabase
                .from("profiles")
                .select("*")
                .eq("id", data.user.id)
                .maybeSingle();


        if (profileError) {

            console.error(
                "PROFILE LOOKUP ERROR:",
                profileError
            );

            return res.status(500).json({
                error:
                    profileError.message
            });

        }


        /* ------------------------------------------
           CREATE PROFILE IF MISSING
        ------------------------------------------ */

        if (!profile) {

            let username =
                (
                    email
                        .split("@")[0]
                        .toLowerCase()
                        .replace(
                            /[^a-z0-9_]/g,
                            ""
                        )
                        .slice(0, 20)
                ) || "user";


            const original =
                username;

            let number = 1;


            while (true) {

                const {
                    data: taken
                } =
                    await supabase
                        .from("profiles")
                        .select("id")
                        .eq(
                            "username",
                            username
                        )
                        .maybeSingle();


                if (!taken) {
                    break;
                }


                username =
                    `${original}${number}`;

                number++;

            }


            const {
                data: created,
                error: createError
            } =
                await supabase
                    .from("profiles")
                    .insert({

                        id:
                            data.user.id,

                        username,

                        display_name:
                            username,

                        avatar:
                            null,

                        bio:
                            ""

                    })
                    .select()
                    .single();


            if (createError) {

                console.error(
                    "PROFILE CREATION ERROR:",
                    createError
                );

                return res.status(500).json({
                    error:
                        createError.message
                });

            }


            profile =
                created;

        }


        /* ------------------------------------------
           EXPRESS SESSION
        ------------------------------------------ */

        req.session.user = {

            id:
                profile.id,

            username:
                profile.username,

            display_name:
                profile.display_name

        };


        console.log(
            "💾 Saving session:",
            req.session.user
        );


        req.session.save(error => {

            if (error) {

                console.error(
                    "SESSION SAVE ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        "Could not save login session."
                });

            }


            console.log(
                "✅ EXPRESS SESSION SAVED:",
                req.session.user
            );


            return res.json({

                success: true,

                user: profile

            });

        });

    }

    catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );

        return res.status(500).json({
            error:
                error.message ||
                "Server error."
        });

    }

});


/* ==================================================
   LOGOUT
================================================== */

router.post("/logout", (req, res) => {

    req.session.destroy(error => {

        if (error) {

            console.error(
                "LOGOUT ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    "Logout failed."
            });

        }


        res.clearCookie("connect.sid");


        return res.json({
            success: true
        });

    });

});


/* ==================================================
   CURRENT USER
================================================== */

router.get("/me", async (req, res) => {

    console.log(
        "ME SESSION:",
        req.session.user
    );


    try {

        if (!req.session.user) {

            return res.json({

                loggedIn: false

            });

        }


        const {
            data,
            error
        } =
            await supabase
                .from("profiles")
                .select("*")
                .eq(
                    "id",
                    req.session.user.id
                )
                .maybeSingle();


        if (error) {

            console.error(
                "ME PROFILE ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    error.message
            });

        }


        if (!data) {

            req.session.destroy(() => {});

            return res.json({
                loggedIn: false
            });

        }


        return res.json({

            loggedIn: true,

            user: data

        });

    }

    catch (error) {

        console.error(
            "ME ERROR:",
            error
        );

        return res.status(500).json({
            error:
                error.message ||
                "Server error."
        });

    }

});


module.exports = router;