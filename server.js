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

aapp.get("/api/posts", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("posts")
            .select(`
                id,
                content,
                created_at,
                user_id
            `)
            .order("created_at", {
                ascending: false
            });

        if (error) {
            console.error("❌ Supabase posts error:", error);

            return res.status(500).json({
                error: error.message
            });
        }

        console.log("✅ Loaded posts:", data);

        res.json(data);

    } catch (error) {

        console.error("❌ GET POSTS ERROR:", error);

        res.status(500).json({
            error: error.message
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