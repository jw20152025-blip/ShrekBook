
"use strict";

const supabase = require("./supabase.js");

/* =========================================================
   SHREKBOOK IMAGE UPLOADER
========================================================= */

/*
 * IMPORTANT:
 *
 * Create a Supabase Storage bucket named:
 *
 *     avatars
 *
 * and make the bucket public.
 *
 * This uploader is intended for profile avatars.
 */


/* =========================================================
   CONFIG
========================================================= */

const BUCKET_NAME =
    process.env.SUPABASE_AVATAR_BUCKET ||
    "avatars";


/* =========================================================
   UPLOAD IMAGE
========================================================= */

async function uploadImage(
    fileBuffer,
    fileName,
    mimeType
) {

    if (!fileBuffer) {

        throw new Error(
            "No image data was provided."
        );

    }


    if (!fileName) {

        throw new Error(
            "No image filename was provided."
        );

    }


    /*
     * Clean the filename.
     */

    const safeName =
        String(fileName)
            .replace(
                /[^a-zA-Z0-9._-]/g,
                "_"
            );


    /*
     * Give every upload a unique path.
     */

    const uniqueName =
        `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 10)}-${safeName}`;


    const filePath =
        `profiles/${uniqueName}`;


    console.log(
        "🖼️ Uploading image:",
        filePath
    );


    /* =====================================================
       UPLOAD TO SUPABASE STORAGE
    ===================================================== */

    const {
        data,
        error
    } = await supabase
        .storage
        .from(BUCKET_NAME)
        .upload(
            filePath,
            fileBuffer,
            {

                contentType:
                    mimeType ||
                    "application/octet-stream",

                upsert:
                    false

            }
        );


    if (error) {

        console.error(
            "❌ SUPABASE IMAGE UPLOAD ERROR:",
            error
        );

        throw new Error(
            error.message ||
            "Image upload failed."
        );

    }


    /* =====================================================
       GET PUBLIC URL
    ===================================================== */

    const {
        data: publicData
    } =
        supabase
            .storage
            .from(BUCKET_NAME)
            .getPublicUrl(
                data.path
            );


    if (
        !publicData ||
        !publicData.publicUrl
    ) {

        throw new Error(
            "Image uploaded but a public URL could not be generated."
        );

    }


    console.log(
        "✅ IMAGE UPLOADED:",
        publicData.publicUrl
    );


    return {

        path:
            data.path,

        url:
            publicData.publicUrl

    };

}


/* =========================================================
   DELETE IMAGE
========================================================= */

async function deleteImage(
    imagePath
) {

    if (!imagePath) {
        return;
    }


    console.log(
        "🗑️ Deleting image:",
        imagePath
    );


    const {
        error
    } = await supabase
        .storage
        .from(BUCKET_NAME)
        .remove([
            imagePath
        ]);


    if (error) {

        console.error(
            "❌ IMAGE DELETE ERROR:",
            error
        );

        throw new Error(
            error.message ||
            "Image deletion failed."
        );

    }


    console.log(
        "✅ IMAGE DELETED"
    );

}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {

    uploadImage,

    deleteImage

};

