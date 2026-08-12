
const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const PORT = process.env.PORT || 3000;

// ==========================================
// SUPABASE
// ==========================================

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("ERROR: Supabase environment variables are missing.");
    console.error("You need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
}

const supabase = createClient(
    supabaseUrl,
    supabaseKey
);

// ==========================================
// EXPRESS
// ==========================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve everything inside public/
app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// TEST
// ==========================================

app.get("/api/test", (req, res) => {

    res.json({
        success: true,
        message: "ShrekBook server is alive 🧌"
    });

});

// ==========================================
// GET ALL PROFILES
// ==========================================

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

            console.error("Supabase error:", error);

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

// ==========================================
// GET ONE PROFILE
// ==========================================

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

// ==========================================
// CREATE PROFILE
// ==========================================

app.post("/api/users", async (req, res) => {

    try {

        const {
            username,
            display_name,
            avatar,
            gyatt,
            cat,
            ogred
        } = req.body;

        if (!username || !display_name) {

            return res.status(400).json({
                error: "Username and display name are required."
            });

        }

        const { data, error } = await supabase
            .from("profiles")
            .insert({
                username: username,
                display_name: display_name,
                avatar: avatar || null,
                gyatt: Number(gyatt) || 0,
                cat: Number(cat) || 0,
                ogred: Number(ogred) || 0
            })
            .select()
            .single();

        if (error) {

            console.error("Supabase error:", error);

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

// ==========================================
// UPDATE PROFILE
// ==========================================

app.put("/api/users/:id", async (req, res) => {

    try {

        const id = req.params.id;

        const {
            username,
            display_name,
            avatar,
            gyatt,
            cat,
            ogred
        } = req.body;

        const { data, error } = await supabase
            .from("profiles")
            .update({
                username,
                display_name,
                avatar,
                gyatt: Number(gyatt) || 0,
                cat: Number(cat) || 0,
                ogred: Number(ogred) || 0
            })
            .eq("id", id)
            .select()
            .single();

        if (error) {

            console.error("Supabase error:", error);

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

// ==========================================
// SIGN UP
// ==========================================

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
                error: "Please fill in all required fields."
            });

        }

        // Create authentication account
        const {
            data: authData,
            error: authError
        } = await supabase.auth.admin.createUser({

            email: email,

            password: password,

            email_confirm: true

        });

        if (authError) {

            console.error(authError);

            return res.status(400).json({
                error: authError.message
            });

        }

        // Create profile
        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .insert({

                username: username,

                display_name: displayName,

                avatar: avatar || null,

                gyatt: 0,

                cat: 0,

                ogred: 0

            })
            .select()
            .single();

        if (profileError) {

            console.error(profileError);

            return res.status(400).json({
                error: profileError.message
            });

        }

        res.status(201).json({

            success: true,

            profile: profile

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Server error."
        });

    }

});


// ==========================================
// LOGIN
// ==========================================

app.post("/api/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        if (!email || !password) {

            return res.status(400).json({
                error: "Email and password are required."
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

        res.json({

            success: true,

            access_token:
                data.session.access_token,

            refresh_token:
                data.session.refresh_token,

            user:
                data.user

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Server error."
        });

    }

});


// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `🧌 ShrekBook running on port ${PORT}`
    );

});

