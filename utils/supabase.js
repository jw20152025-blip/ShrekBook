require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
    throw new Error("Missing SUPABASE_URL");
}

if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

console.log("SUPABASE URL:", true);
console.log("SUPABASE KEY:", true);

const supabase = createClient(url, key, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
    }
});

module.exports = supabase;