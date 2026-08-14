const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function uploadImage(image, folder = "uploads") {

    if (!image || !image.data) {
        throw new Error("No image provided.");
    }

    const buffer = Buffer.from(
        image.data,
        "base64"
    );

    const safeName =
        String(image.name || "image")
            .replace(/[^a-zA-Z0-9._-]/g, "_");

    const fileName =
        `${folder}/${Date.now()}-${safeName}`;

    const contentType =
        image.type || "image/png";

    const { error } =
        await supabase.storage
            .from("images")
            .upload(
                fileName,
                buffer,
                {
                    contentType: contentType,
                    upsert: false
                }
            );

    if (error) {
        console.error(
            "UPLOAD ERROR:",
            error
        );

        throw new Error(
            error.message
        );
    }

    const { data } =
        supabase.storage
            .from("images")
            .getPublicUrl(fileName);

    return data.publicUrl;
}

module.exports = {
    uploadImage
};