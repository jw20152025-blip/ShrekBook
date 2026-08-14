/* ==================================================
   SHREKBOOK SUPABASE CLIENT
================================================== */

const {
    createClient
} = require("@supabase/supabase-js");

const SUPABASE_URL =
    process.env.SUPABASE_URL;

const SUPABASE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
    throw new Error(
        "Missing SUPABASE_URL"
    );
}

if (!SUPABASE_KEY) {
    throw new Error(
        "Missing SUPABASE_SERVICE_ROLE_KEY"
    );
}

console.log(
    "SUPABASE URL:",
    !!SUPABASE_URL
);

console.log(
    "SUPABASE KEY:",
    !!SUPABASE_KEY
);

const supabase =
    createClient(
        SUPABASE_URL,
        SUPABASE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );

module.exports = supabase;