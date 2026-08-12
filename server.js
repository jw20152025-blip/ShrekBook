require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");

const {
    createClient
} = require("@supabase/supabase-js");


const app = express();

const PORT = process.env.PORT || 3000;


if (
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
    console.error("❌ Missing Supabase environment variables.");

    process.exit(1);
}


const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);


// ============================================
// MIDDLEWARE
// ============================================

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));


app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "change-this-secret",

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            secure: false,
            maxAge: 1000 * 60 * 60 * 24 * 7
        }
    })
);


app.use(express.static(
    path.join(__dirname, "public")
));


// ============================================
// TEST SUPABASE
// ============================================

app.get("/api/test-supabase", async (req, res) => {

    try {

        const { data, error } =
            await supabase
                .from("profiles")
                .select("*")
                .limit(5);


        if (error) {

            console.error(
                "Supabase test error:",
                error
            );

            return res.status(500).json({
                success: false,
                error: error.message
            });
        }


        res.json({
            success: true,
            users: data
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// ============================================
// USERS
// ============================================

app.get("/api/users", async (req, res) => {

    try {

        const { data, error } =
            await supabase
                .from("profiles")
                .select(`
                    id,
                    username,
                    display_name,
                    avatar,
                    gyatt,
                    cat,
                    ogred
                `)
                .order("username");


        if (error) {

            console.error(
                "Users error:",
                error
            );

            return res.status(500).json({
                error: error.message
            });
        }


        res.json(data);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Server error"
        });
    }
});


// ============================================
// GET PROFILE
// ============================================

app.get("/api/profile/:id", async (req, res) => {

    try {

        const { id } = req.params;


        const { data, error } =
            await supabase
                .from("profiles")
                .select(`
                    id,
                    username,
                    display_name,
                    avatar,
                    gyatt,
                    cat,
                    ogred
                `)
                .eq("id", id)
                .single();


        if (error) {

            return res.status(404).json({
                error: error.message
            });
        }


        res.json(data);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Server error"
        });
    }
});


// ============================================
// SIGNUP
// ============================================

app.post("/api/signup", async (req, res) => {

    try {

        const {
            username,
            displayName,
            email,
            password,
            avatar
        } = req.body;


        if (
            !username ||
            !displayName ||
            !email ||
            !password
        ) {

            return res.status(400).json({
                error: "All fields are required."
            });
        }


        // Create Supabase Auth account

        const {
            data: authData,
            error: authError
        } = await supabase.auth.admin.createUser({

            email: email,

            password: password,

            email_confirm: true
        });


        if (authError) {

            return res.status(400).json({
                error: authError.message
            });
        }


        const userId =
            authData.user.id;


        // Create profile

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .insert({

                id: userId,

                username: username,

                display_name: displayName,

                avatar:
                    avatar ||
                    "https://placehold.co/150",

                gyatt: 0,

                cat: 0,

                ogred: 0

            })
            .select()
            .single();


        if (profileError) {

            // Remove Auth account if
            // profile creation failed.

            await supabase.auth.admin
                .deleteUser(userId);


            return res.status(400).json({
                error:
                    profileError.message
            });
        }


        res.status(201).json({
            success: true,
            user: profile
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Server error"
        });
    }
});


// ============================================
// LOGIN
// ============================================

app.post("/api/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        if (!email || !password) {

            return res.status(400).json({
                error:
                    "Email and password are required."
            });
        }


        const {
            data,
            error
        } = await supabase.auth.signInWithPassword({

            email: email,

            password: password
        });


        if (error) {

            return res.status(401).json({
                error: error.message
            });
        }


        req.session.userId =
            data.user.id;


        res.json({

            success: true,

            user: {
                id: data.user.id,
                email: data.user.email
            },

            access_token:
                data.session.access_token

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Server error"
        });
    }
});


// ============================================
// LOGOUT
// ============================================

app.post("/api/logout", (req, res) => {

    req.session.destroy(() => {

        res.json({
            success: true
        });

    });

});


// ============================================
// POSTS
// ============================================

app.get("/api/posts", async (req, res) => {

    try {

        const { data, error } =
            await supabase
                .from("posts")
                .select(`
                    id,
                    user_id,
                    content,
                    created_at
                `)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error) {

            return res.status(500).json({
                error: error.message
            });
        }


        res.json(data);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Server error"
        });
    }
});


app.post("/api/posts", async (req, res) => {

    try {

        const {
            user_id,
            content
        } = req.body;


        if (!user_id || !content?.trim()) {

            return res.status(400).json({
                error:
                    "User ID and content are required."
            });
        }


        const { data, error } =
            await supabase
                .from("posts")
                .insert({

                    user_id: user_id,

                    content: content.trim()

                })
                .select()
                .single();


        if (error) {

            return res.status(400).json({
                error: error.message
            });
        }


        res.status(201).json(data);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Server error"
        });
    }
});


// ============================================
// COMMENTS
// ============================================

app.get(
    "/api/posts/:id/comments",
    async (req, res) => {

        try {

            const { data, error } =
                await supabase
                    .from("comments")
                    .select(`
                        id,
                        post_id,
                        user_id,
                        content,
                        created_at
                    `)
                    .eq(
                        "post_id",
                        req.params.id
                    )
                    .order(
                        "created_at",
                        {
                            ascending: true
                        }
                    );


            if (error) {

                return res.status(500).json({
                    error: error.message
                });
            }


            res.json(data);

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error: "Server error"
            });
        }
    }
);


app.post(
    "/api/posts/:id/comments",
    async (req, res) => {

        try {

            const {
                user_id,
                content
            } = req.body;


            if (
                !user_id ||
                !content?.trim()
            ) {

                return res.status(400).json({
                    error:
                        "User ID and content are required."
                });
            }


            const { data, error } =
                await supabase
                    .from("comments")
                    .insert({

                        post_id:
                            req.params.id,

                        user_id:
                            user_id,

                        content:
                            content.trim()

                    })
                    .select()
                    .single();


            if (error) {

                return res.status(400).json({
                    error: error.message
                });
            }


            res.status(201).json(data);

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error: "Server error"
            });
        }
    }
);


// ============================================
// LIKES
// ============================================

app.post(
    "/api/posts/:id/like",
    async (req, res) => {

        try {

            const {
                user_id
            } = req.body;


            if (!user_id) {

                return res.status(400).json({
                    error:
                        "User ID is required."
                });
            }


            const { data, error } =
                await supabase
                    .from("likes")
                    .insert({

                        post_id:
                            req.params.id,

                        user_id:
                            user_id

                    })
                    .select()
                    .single();


            if (error) {

                return res.status(400).json({
                    error: error.message
                });
            }


            res.status(201).json(data);

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error: "Server error"
            });
        }
    }
);


app.delete(
    "/api/posts/:id/like",
    async (req, res) => {

        try {

            const {
                user_id
            } = req.body;


            const { error } =
                await supabase
                    .from("likes")
                    .delete()
                    .eq(
                        "post_id",
                        req.params.id
                    )
                    .eq(
                        "user_id",
                        user_id
                    );


            if (error) {

                return res.status(400).json({
                    error: error.message
                });
            }


            res.json({
                success: true
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error: "Server error"
            });
        }
    }
);


// ============================================
// START SERVER
// ============================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🧌 ShrekBook running on port ${PORT}`
        );

    }
);