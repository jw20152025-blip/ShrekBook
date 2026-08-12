
const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const PORT = process.env.PORT || 3000;

// ==================================================
// SUPABASE
// ==================================================

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase environment variables.");
    console.error("You need:");
    console.error("SUPABASE_URL");
    console.error("SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(
    supabaseUrl,
    supabaseKey
);


// ==================================================
// EXPRESS SETUP
// ==================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve HTML/CSS/JS from public/
app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ==================================================
// SERVER TEST
// ==================================================

app.get("/api/test", (req, res) => {

    res.json({
        success: true,
        message: "ShrekBook server is alive 🧌"
    });

});


// ==================================================
// GET ALL USERS
// ==================================================

app.get("/api/users", async (req, res) => {

    try {

        const { data, error } = await supabase
            .from("profiles")
            .select(`
                id,
                username,
                display_name,
                avatar,
                gyatt,
                cat,
                ogred,
                created_at
            `)
            .order("created_at", {
                ascending: false
            });

        if (error) {

            console.error(
                "Supabase users error:",
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


// ==================================================
// GET ONE PROFILE
// ==================================================

app.get("/api/users/:id", async (req, res) => {

    try {

        const id = req.params.id;

        const { data, error } = await supabase
            .from("profiles")
            .select(`
                id,
                username,
                display_name,
                avatar,
                gyatt,
                cat,
                ogred,
                created_at
            `)
            .eq("id", id)
            .single();

        if (error || !data) {

            return res.status(404).json({
                error: "User not found"
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


// ==================================================
// SIGN UP
// ==================================================

app.post("/api/signup", async (req, res) => {

    try {

        const {
            username,
            displayName,
            email,
            password,
            avatar
        } = req.body;


        // ------------------------------
        // Check required fields
        // ------------------------------

        if (
            !username ||
            !displayName ||
            !email ||
            !password
        ) {

            return res.status(400).json({
                error:
                    "Username, display name, email, and password are required."
            });

        }


        // ------------------------------
        // Check username
        // ------------------------------

        const {
            data: existingProfile,
            error: usernameCheckError
        } = await supabase
            .from("profiles")
            .select("id")
            .eq("username", username)
            .maybeSingle();

        if (usernameCheckError) {

            console.error(
                usernameCheckError
            );

            return res.status(500).json({
                error: "Could not check username."
            });

        }

        if (existingProfile) {

            return res.status(400).json({
                error: "That username is already taken."
            });

        }


        // ------------------------------
        // Create Supabase Auth user
        // ------------------------------

        const {
            data: authData,
            error: authError
        } = await supabase.auth.admin.createUser({

            email: email,

            password: password,

            email_confirm: true

        });


        if (authError) {

            console.error(
                "Auth signup error:",
                authError
            );

            return res.status(400).json({
                error: authError.message
            });

        }


        // ------------------------------
        // Get Auth UUID
        // ------------------------------

        const userId =
            authData.user.id;


        // ------------------------------
        // Create profile
        // ------------------------------

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .insert({

                // IMPORTANT:
                // This is the SAME UUID
                // as the Supabase Auth user.

                id: userId,

                username: username,

                display_name: displayName,

                avatar:
                    avatar || null,

                gyatt: 0,

                cat: 0,

                ogred: 0

            })
            .select()
            .single();


        if (profileError) {

            console.error(
                "Profile creation error:",
                profileError
            );


            // If profile creation fails,
            // remove the Auth account too.

            await supabase.auth.admin.deleteUser(
                userId
            );


            return res.status(400).json({
                error: profileError.message
            });

        }


        // ------------------------------
        // Success
        // ------------------------------

        res.status(201).json({

            success: true,

            message:
                "Account created successfully!",

            profile: profile

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Server error"
        });

    }

});


// ==================================================
// LOGIN
// ==================================================

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


        // Supabase Auth login

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


        // Return session to browser

        res.json({

            success: true,

            access_token:
                data.session.access_token,

            refresh_token:
                data.session.refresh_token,

            user: data.user

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Server error"
        });

    }

});


// ==================================================
// UPDATE PROFILE
// ==================================================

app.put("/api/users/:id", async (req, res) => {

    try {

        const id = req.params.id;

        const {
            username,
            displayName,
            avatar,
            gyatt,
            cat,
            ogred
        } = req.body;


        const { data, error } = await supabase
            .from("profiles")
            .update({

                username:
                    username,

                display_name:
                    displayName,

                avatar:
                    avatar,

                gyatt:
                    Number(gyatt) || 0,

                cat:
                    Number(cat) || 0,

                ogred:
                    Number(ogred) || 0

            })
            .eq("id", id)
            .select()
            .single();


        if (error) {

            console.error(
                "Profile update error:",
                error
            );

            return res.status(400).json({
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


// ==================================================
// START SERVER
// ==================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🧌 ShrekBook running on port ${PORT}`
        );

    }
);

