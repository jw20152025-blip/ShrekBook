const express = require("express");

const router =
    express.Router();

const supabase =
    require("../utils/supabase.js");


/* ==================================================
   SIGNUP
================================================== */

router.post(
    "/signup",
    async (req, res) => {

        try {

            const username =
                String(
                    req.body.username || ""
                ).trim();

            const displayName =
                String(
                    req.body.display_name ||
                    username
                ).trim();

            const email =
                String(
                    req.body.email || ""
                ).trim();

            const password =
                String(
                    req.body.password || ""
                );


            if (
                !username ||
                !email ||
                !password
            ) {

                return res.status(400).json({
                    error:
                        "Username, email, and password are required."
                });

            }


            /* Check username */

            const {
                data: existing,
                error: usernameError
            } =
                await supabase
                    .from("profiles")
                    .select("id")
                    .eq(
                        "username",
                        username
                    )
                    .maybeSingle();


            if (usernameError) {

                console.error(
                    "USERNAME CHECK ERROR:",
                    usernameError
                );

                return res.status(500).json({
                    error:
                        usernameError.message
                });

            }


            if (existing) {

                return res.status(400).json({
                    error:
                        "That username is already taken."
                });

            }


            /* Create Supabase account */

            const {
                data: authData,
                error: authError
            } =
                await supabase.auth.admin.createUser({

                    email,

                    password,

                    email_confirm:
                        true

                });


            if (authError) {

                console.error(
                    "SUPABASE SIGNUP ERROR:",
                    authError
                );

                return res.status(400).json({
                    error:
                        authError.message
                });

            }


            const userId =
                authData.user.id;


            /* Create profile */

            const {
                data: profile,
                error: profileError
            } =
                await supabase
                    .from("profiles")
                    .insert({

                        id:
                            userId,

                        username,

                        display_name:
                            displayName,

                        avatar:
                            null,

                        bio:
                            ""

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


            res.status(201).json({

                success:
                    true,

                user:
                    profile

            });

        } catch (error) {

            console.error(
                "SIGNUP ERROR:",
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
   LOGIN
================================================== */

router.post(
    "/login",
    async (req, res) => {

        try {

            console.log(
                "🔐 LOGIN REQUEST"
            );


            const email =
                String(
                    req.body.email || ""
                ).trim();

            const password =
                String(
                    req.body.password || ""
                );


            if (
                !email ||
                !password
            ) {

                return res.status(400).json({
                    error:
                        "Email and password are required."
                });

            }


            console.log(
                "Attempting Supabase login for:",
                email
            );


            /*
             * Supabase password login
             */

            const {
                data: authData,
                error: authError
            } =
                await supabase.auth
                    .signInWithPassword({

                        email,

                        password

                    });


            if (authError) {

                console.error(
                    "SUPABASE LOGIN ERROR:",
                    authError
                );

                return res.status(401).json({
                    error:
                        authError.message
                });

            }


            if (!authData.user) {

                return res.status(401).json({
                    error:
                        "Login failed."
                });

            }


            const userId =
                authData.user.id;


            console.log(
                "✅ Supabase user:",
                userId
            );


            /*
             * Get profile
             */

            let {
                data: profile,
                error: profileError
            } =
                await supabase
                    .from("profiles")
                    .select("*")
                    .eq(
                        "id",
                        userId
                    )
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


            /*
             * Create missing profile
             */

            if (!profile) {

                let username =
                    (
                        authData.user.email ||
                        "user"
                    )
                    .split("@")[0]
                    .toLowerCase()
                    .replace(
                        /[^a-z0-9_]/g,
                        ""
                    )
                    .slice(
                        0,
                        20
                    );


                if (!username) {
                    username =
                        "user";
                }


                const original =
                    username;

                let number =
                    1;


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
                                userId,

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
                        "PROFILE CREATE ERROR:",
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


            /*
             * Create Express session
             */

            req.session.user = {

                id:
                    profile.id,

                username:
                    profile.username,

                display_name:
                    profile.display_name

            };


            /*
             * VERY IMPORTANT:
             * explicitly save the session before
             * sending the response.
             */

            req.session.save(
                error => {

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

                        success:
                            true,

                        user:
                            profile

                    });

                }
            );

        } catch (error) {

            console.error(
                "💥 LOGIN CRASH:",
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
   LOGOUT
================================================== */

router.post(
    "/logout",
    (req, res) => {

        req.session.destroy(
            error => {

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


                res.clearCookie(
                    "connect.sid"
                );


                res.json({
                    success:
                        true
                });

            }
        );

    }
);


/* ==================================================
   CURRENT USER
================================================== */

router.get(
    "/me",
    async (req, res) => {

        try {

            console.log(
                "ME SESSION:",
                req.session.user
            );


            if (!req.session.user) {

                return res.json({

                    loggedIn:
                        false

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

                return res.json({

                    loggedIn:
                        false

                });

            }


            res.json({

                loggedIn:
                    true,

                user:
                    data

            });

        } catch (error) {

            console.error(
                "ME ERROR:",
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


module.exports =
    router;