// ==================================================
// SHREKBOOK ADMIN ROUTES
// ==================================================

const express = require("express");

const router = express.Router();


// ==================================================
// HELPERS
// ==================================================

function getSupabase(req) {

    return req.app.locals.supabase;

}


function getRequireAdmin(req) {

    return req.app.locals.requireAdmin;

}


// ==================================================
// ADMIN CHECK
// ==================================================

router.get(
    "/me",
    async (req, res) => {

        try {

            if (
                !req.session ||
                !req.session.user
            ) {

                return res.json({
                    isAdmin: false
                });

            }


            const supabase =
                getSupabase(req);


            const {
                data: admin,
                error
            } = await supabase
                .from("admins")
                .select("id, user_id")
                .eq(
                    "user_id",
                    req.session.user.id
                )
                .maybeSingle();


            if (error) {

                console.error(
                    "ADMIN ME ERROR:",
                    error
                );

                return res.status(500).json({
                    error:
                        "Could not check administrator status."
                });

            }


            res.json({
                isAdmin:
                    !!admin
            });

        } catch (error) {

            console.error(
                "ADMIN ME ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "Server error."
            });

        }

    }
);


// ==================================================
// GET BANS
// ==================================================

router.get(
    "/bans",
    async (req, res) => {

        const requireAdmin =
            getRequireAdmin(req);

        return requireAdmin(
            req,
            res,
            async () => {

                try {

                    const supabase =
                        getSupabase(req);


                    const {
                        data: bans,
                        error
                    } = await supabase
                        .from("bans")
                        .select(`
                            id,
                            user_id,
                            email,
                            reason,
                            banned_at,
                            banned_by,
                            active
                        `)
                        .order(
                            "banned_at",
                            {
                                ascending: false
                            }
                        );


                    if (error) {

                        console.error(
                            "GET BANS ERROR:",
                            error
                        );

                        return res.status(500).json({
                            error:
                                error.message
                        });

                    }


                    res.json({
                        bans:
                            bans || []
                    });

                } catch (error) {

                    console.error(
                        "GET BANS ERROR:",
                        error
                    );

                    res.status(500).json({
                        error:
                            "Server error."
                    });

                }

            }
        );

    }
);


// ==================================================
// CREATE BAN
// ==================================================

router.post(
    "/bans",
    async (req, res) => {

        const requireAdmin =
            getRequireAdmin(req);

        return requireAdmin(
            req,
            res,
            async () => {

                try {

                    const supabase =
                        getSupabase(req);


                    let email =
                        String(
                            req.body.email ||
                            ""
                        )
                        .trim()
                        .toLowerCase();


                    let userId =
                        String(
                            req.body.user_id ||
                            ""
                        )
                        .trim();


                    const reason =
                        String(
                            req.body.reason ||
                            ""
                        )
                        .trim();


                    if (
                        !email &&
                        !userId
                    ) {

                        return res.status(400).json({
                            error:
                                "Provide an email or user ID."
                        });

                    }


                    // --------------------------------
                    // FIND USER BY USER ID
                    // --------------------------------

                    if (userId) {

                        const {
                            data: authResult,
                            error: authError
                        } =
                            await supabase.auth.admin
                                .getUserById(
                                    userId
                                );


                        if (
                            authError ||
                            !authResult ||
                            !authResult.user
                        ) {

                            return res.status(404).json({
                                error:
                                    "User ID not found."
                            });

                        }


                        if (!email) {

                            email =
                                String(
                                    authResult.user.email ||
                                    ""
                                )
                                .trim()
                                .toLowerCase();

                        }

                    }


                    // --------------------------------
                    // FIND USER BY EMAIL
                    // --------------------------------

                    if (
                        email &&
                        !userId
                    ) {

                        let foundUser =
                            null;

                        let page =
                            1;


                        while (
                            page <= 20 &&
                            !foundUser
                        ) {

                            const {
                                data,
                                error
                            } =
                                await supabase.auth.admin
                                    .listUsers({
                                        page,
                                        perPage: 1000
                                    });


                            if (error) {

                                console.error(
                                    "LIST USERS ERROR:",
                                    error
                                );

                                break;

                            }


                            const users =
                                data?.users ||
                                [];


                            foundUser =
                                users.find(
                                    user =>
                                        String(
                                            user.email ||
                                            ""
                                        )
                                        .trim()
                                        .toLowerCase() ===
                                        email
                                );


                            if (
                                users.length < 1000
                            ) {

                                break;

                            }


                            page++;

                        }


                        if (foundUser) {

                            userId =
                                foundUser.id;

                        }

                    }


                    // --------------------------------
                    // DON'T BAN YOURSELF
                    // --------------------------------

                    if (
                        userId &&
                        req.session.user.id ===
                        userId
                    ) {

                        return res.status(400).json({
                            error:
                                "You cannot ban yourself."
                        });

                    }


                    // --------------------------------
                    // CHECK EXISTING ACTIVE BAN
                    // --------------------------------

                    let existingQuery;


                    if (userId) {

                        existingQuery =
                            supabase
                                .from("bans")
                                .select("id")
                                .eq(
                                    "user_id",
                                    userId
                                )
                                .eq(
                                    "active",
                                    true
                                )
                                .limit(1);

                    } else {

                        existingQuery =
                            supabase
                                .from("bans")
                                .select("id")
                                .eq(
                                    "email",
                                    email
                                )
                                .eq(
                                    "active",
                                    true
                                )
                                .limit(1);

                    }


                    const {
                        data: existingBans,
                        error: existingError
                    } =
                        await existingQuery;


                    if (existingError) {

                        return res.status(500).json({
                            error:
                                existingError.message
                        });

                    }


                    if (
                        existingBans &&
                        existingBans.length > 0
                    ) {

                        return res.status(400).json({
                            error:
                                "That user/email is already banned."
                        });

                    }


                    // --------------------------------
                    // CREATE BAN
                    // --------------------------------

                    const {
                        data: ban,
                        error
                    } =
                        await supabase
                            .from("bans")
                            .insert({

                                user_id:
                                    userId ||
                                    null,

                                email:
                                    email ||
                                    null,

                                reason:
                                    reason ||
                                    null,

                                banned_by:
                                    req.session.user.id,

                                active:
                                    true

                            })
                            .select()
                            .single();


                    if (error) {

                        console.error(
                            "CREATE BAN ERROR:",
                            error
                        );

                        return res.status(500).json({
                            error:
                                error.message
                        });

                    }


                    res.status(201).json({

                        success:
                            true,

                        ban

                    });

                } catch (error) {

                    console.error(
                        "BAN ERROR:",
                        error
                    );

                    res.status(500).json({
                        error:
                            "Server error."
                    });

                }

            }
        );

    }
);


// ==================================================
// UNBAN
// ==================================================

router.post(
    "/bans/:banId/unban",
    async (req, res) => {

        const requireAdmin =
            getRequireAdmin(req);

        return requireAdmin(
            req,
            res,
            async () => {

                try {

                    const supabase =
                        getSupabase(req);


                    const banId =
                        String(
                            req.params.banId ||
                            ""
                        )
                        .trim();


                    if (!banId) {

                        return res.status(400).json({
                            error:
                                "Missing ban ID."
                        });

                    }


                    // --------------------------------
                    // FIND BAN
                    // --------------------------------

                    const {
                        data: existingBan,
                        error: findError
                    } =
                        await supabase
                            .from("bans")
                            .select("*")
                            .eq(
                                "id",
                                banId
                            )
                            .maybeSingle();


                    if (findError) {

                        console.error(
                            "FIND BAN ERROR:",
                            findError
                        );

                        return res.status(500).json({
                            error:
                                findError.message
                        });

                    }


                    if (!existingBan) {

                        return res.status(404).json({
                            error:
                                "Ban not found."
                        });

                    }


                    if (
                        existingBan.active !== true
                    ) {

                        return res.status(400).json({
                            error:
                                "This ban is already inactive."
                        });

                    }


                    // --------------------------------
                    // DEACTIVATE BAN
                    // --------------------------------

                    const {
                        data: updatedBan,
                        error
                    } =
                        await supabase
                            .from("bans")
                            .update({
                                active:
                                    false
                            })
                            .eq(
                                "id",
                                banId
                            )
                            .select()
                            .single();


                    if (error) {

                        console.error(
                            "UNBAN UPDATE ERROR:",
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

                        ban:
                            updatedBan

                    });

                } catch (error) {

                    console.error(
                        "UNBAN ERROR:",
                        error
                    );

                    res.status(500).json({
                        error:
                            "Server error."
                    });

                }

            }
        );

    }
);


// ==================================================
// GET ADMINISTRATORS
// ==================================================

router.get(
    "/admins",
    async (req, res) => {

        const requireAdmin =
            getRequireAdmin(req);

        return requireAdmin(
            req,
            res,
            async () => {

                try {

                    const supabase =
                        getSupabase(req);


                    const {
                        data: admins,
                        error
                    } =
                        await supabase
                            .from("admins")
                            .select("*");


                    if (error) {

                        console.error(
                            "GET ADMINS ERROR:",
                            error
                        );

                        return res.status(500).json({
                            error:
                                error.message
                        });

                    }


                    // --------------------------------
                    // GET PROFILE INFORMATION
                    // --------------------------------

                    const result =
                        [];


                    for (
                        const admin
                        of admins || []
                    ) {

                        let profile =
                            null;


                        if (admin.user_id) {

                            const {
                                data
                            } =
                                await supabase
                                    .from("profiles")
                                    .select(`
                                        id,
                                        username,
                                        display_name
                                    `)
                                    .eq(
                                        "id",
                                        admin.user_id
                                    )
                                    .maybeSingle();


                            profile =
                                data;

                        }


                        result.push({

                            id:
                                admin.user_id,

                            user_id:
                                admin.user_id,

                            username:
                                profile?.username ||
                                null,

                            display_name:
                                profile?.display_name ||
                                null

                        });

                    }


                    res.json({
                        admins:
                            result
                    });

                } catch (error) {

                    console.error(
                        "GET ADMINS ERROR:",
                        error
                    );

                    res.status(500).json({
                        error:
                            "Server error."
                    });

                }

            }
        );

    }
);


// ==================================================
// ADD ADMIN
// ==================================================

router.post(
    "/admins",
    async (req, res) => {

        const requireAdmin =
            getRequireAdmin(req);

        return requireAdmin(
            req,
            res,
            async () => {

                try {

                    const supabase =
                        getSupabase(req);


                    const userId =
                        String(
                            req.body.user_id ||
                            ""
                        )
                        .trim();


                    if (!userId) {

                        return res.status(400).json({
                            error:
                                "User ID is required."
                        });

                    }


                    // Don't add duplicate
                    const {
                        data: existing
                    } =
                        await supabase
                            .from("admins")
                            .select("id")
                            .eq(
                                "user_id",
                                userId
                            )
                            .maybeSingle();


                    if (existing) {

                        return res.status(400).json({
                            error:
                                "User is already an administrator."
                        });

                    }


                    const {
                        data: admin,
                        error
                    } =
                        await supabase
                            .from("admins")
                            .insert({

                                user_id:
                                    userId

                            })
                            .select()
                            .single();


                    if (error) {

                        console.error(
                            "ADD ADMIN ERROR:",
                            error
                        );

                        return res.status(500).json({
                            error:
                                error.message
                        });

                    }


                    res.status(201).json({

                        success:
                            true,

                        admin

                    });

                } catch (error) {

                    console.error(
                        "ADD ADMIN ERROR:",
                        error
                    );

                    res.status(500).json({
                        error:
                            "Server error."
                    });

                }

            }
        );

    }
);


// ==================================================
// REVOKE ADMIN
// ==================================================

router.delete(
    "/admins/:userId",
    async (req, res) => {

        const requireAdmin =
            getRequireAdmin(req);

        return requireAdmin(
            req,
            res,
            async () => {

                try {

                    const supabase =
                        getSupabase(req);


                    const userId =
                        req.params.userId;


                    // Don't revoke yourself
                    if (
                        userId ===
                        req.session.user.id
                    ) {

                        return res.status(400).json({
                            error:
                                "You cannot revoke your own administrator access."
                        });

                    }


                    const {
                        data,
                        error
                    } =
                        await supabase
                            .from("admins")
                            .delete()
                            .eq(
                                "user_id",
                                userId
                            )
                            .select()
                            .maybeSingle();


                    if (error) {

                        console.error(
                            "REVOKE ADMIN ERROR:",
                            error
                        );

                        return res.status(500).json({
                            error:
                                error.message
                        });

                    }


                    if (!data) {

                        return res.status(404).json({
                            error:
                                "Administrator not found."
                        });

                    }


                    res.json({

                        success:
                            true

                    });

                } catch (error) {

                    console.error(
                        "REVOKE ADMIN ERROR:",
                        error
                    );

                    res.status(500).json({
                        error:
                            "Server error."
                    });

                }

            }
        );

    }
);


// ==================================================
// KICK USER
// ==================================================
//
// This destroys their current Supabase Auth session.
// It does NOT ban them.
// They can log in again afterward.
//

router.post(
    "/kick/:userId",
    async (req, res) => {

        const requireAdmin =
            getRequireAdmin(req);

        return requireAdmin(
            req,
            res,
            async () => {

                try {

                    const supabase =
                        getSupabase(req);


                    const userId =
                        req.params.userId;


                    if (!userId) {

                        return res.status(400).json({
                            error:
                                "User ID is required."
                        });

                    }


                    if (
                        userId ===
                        req.session.user.id
                    ) {

                        return res.status(400).json({
                            error:
                                "You cannot kick yourself."
                        });

                    }


                    const {
                        error
                    } =
                        await supabase.auth.admin
                            .signOut(
                                userId
                            );


                    if (error) {

                        console.error(
                            "KICK ERROR:",
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

                        message:
                            "User kicked."

                    });

                } catch (error) {

                    console.error(
                        "KICK ERROR:",
                        error
                    );

                    res.status(500).json({
                        error:
                            "Server error."
                    });

                }

            }
        );

    }
);


// ==================================================
// EXPORT
// ==================================================

module.exports =
    router;