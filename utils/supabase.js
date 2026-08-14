```js
"use strict";

const {
    createClient
} = require("@supabase/supabase-js");


/* =========================================================
   SUPABASE CONFIG
========================================================= */

const supabaseUrl =
    process.env.SUPABASE_URL;

const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;


/* =========================================================
   CHECK ENVIRONMENT
========================================================= */

if (!supabaseUrl) {

    console.error(
        "❌ SUPABASE_URL is missing."
    );

}


if (!supabaseKey) {

    console.error(
        "❌ SUPABASE_SERVICE_ROLE_KEY is missing."
    );

}


/* =========================================================
   CREATE CLIENT
========================================================= */

const supabase =
    createClient(
        supabaseUrl,
        supabaseKey,
        {

            auth: {

                autoRefreshToken:
                    false,

                persistSession:
                    false

            }

        }
    );


/* =========================================================
   EXPORT
========================================================= */

module.exports =
    supabase;
```
