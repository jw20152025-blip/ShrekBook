require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");

const { createClient } =
    require("@supabase/supabase-js");

const app = express();

const PORT =
    process.env.PORT || 3000;

const SUPABASE_URL =
    process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

const SESSION_SECRET =
    process.env.SESSION_SECRET;


if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !SESSION_SECRET
) {

    console.error(
        "❌ Missing required environment variables."
    );

    process.exit(1);

}


const supabase =
    createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY
    );


/* ==================================================
EXPRESS
================================================== */

app.set(
    "trust proxy",
    1
);


app.use(
    express.json({
        limit: "10mb"
    })
);


app.use(
    express.urlencoded({
        extended: true
    })
);


app.use(
    session({

        secret:
            SESSION_SECRET,

        resave:
            false,

        saveUninitialized:
            false,

        cookie: {

            httpOnly:
                true,

            secure:
                process.env.NODE_ENV === "production",

            sameSite:
                "lax",

            maxAge:
                1000 *
                60 *
                60 *
                24 *
                30

        }

    })
);


/* ==================================================
STATIC FILES
================================================== */

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


/* ==================================================
HEALTH
================================================== */

app.get(
    "/api/test",
    (req, res) => {

        res.json({

            success:
                true,

            message:
                "ShrekBook server is alive 🧌"

        });

    }
);


app.get(
    "/api/health",
    (req, res) => {

        res.json({

            ok:
                true,

            loggedIn:
                !!req.session.user

        });

    }
);


/* ==================================================
SUPABASE EXPORT
================================================== */

module.exports = {
    app,
    supabase
};


/* ==================================================
START SERVER
================================================== */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🧌 ShrekBook running on port ${PORT}`
        );

    }
);