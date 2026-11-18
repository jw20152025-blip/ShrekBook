const express = require("express");

const DEFAULT_PREFERENCES = {
    social: true,
    announcements: true,
    security: true
};

function createEmailNotificationRouter({ supabase }) {
    const router = express.Router();

    function requireUser(req, res, next) {
        if (!req.session?.user?.id) {
            return res.status(401).json({ error: "You must be logged in." });
        }
        next();
    }

    router.get("/preferences", requireUser, async (req, res) => {
        const { data, error } = await supabase
            .from("email_notification_preferences")
            .select("social, announcements, security")
            .eq("user_id", req.session.user.id)
            .maybeSingle();

        if (error) {
            console.error("EMAIL PREFERENCES LOAD ERROR:", error);
            return res.status(500).json({ error: "Could not load email preferences." });
        }

        res.set("Cache-Control", "no-store");
        res.json({ preferences: { ...DEFAULT_PREFERENCES, ...(data || {}) } });
    });

    router.put("/preferences", requireUser, async (req, res) => {
        const body = req.body || {};
        const preferences = {
            social: body.social === true,
            announcements: body.announcements === true,
            // Security notifications cannot be disabled.
            security: true
        };

        const { data, error } = await supabase
            .from("email_notification_preferences")
            .upsert({
                user_id: req.session.user.id,
                ...preferences,
                updated_at: new Date().toISOString()
            }, { onConflict: "user_id" })
            .select("social, announcements, security")
            .single();

        if (error) {
            console.error("EMAIL PREFERENCES SAVE ERROR:", error);
            return res.status(500).json({ error: "Could not save email preferences." });
        }

        res.json({ success: true, preferences: data });
    });

    return router;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
}

async function enqueueEmail(supabase, { userId, type, subject, text, html }) {
    if (!userId || !type || !subject || !text) return false;

    const { error } = await supabase
        .from("email_notification_queue")
        .insert({
            user_id: userId,
            notification_type: type,
            subject: String(subject).slice(0, 180),
            text_body: String(text).slice(0, 12000),
            html_body: html ? String(html).slice(0, 30000) : null,
            status: "pending"
        });

    if (error) {
        console.error("EMAIL QUEUE INSERT ERROR:", error);
        return false;
    }
    return true;
}

async function sendQueuedEmails(supabase) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) return;

    const { data: jobs, error } = await supabase
        .from("email_notification_queue")
        .select("id, user_id, notification_type, subject, text_body, html_body, attempts")
        .eq("status", "pending")
        .lte("scheduled_at", new Date().toISOString())
        .order("created_at", { ascending: true })
        .limit(10);

    if (error) {
        console.error("EMAIL QUEUE READ ERROR:", error);
        return;
    }

    for (const job of jobs || []) {
        const { data: authResult, error: authError } =
            await supabase.auth.admin.getUserById(job.user_id);

        const recipient = authResult?.user?.email;
        if (authError || !recipient) {
            await supabase.from("email_notification_queue")
                .update({ status: "failed", last_error: "Recipient email unavailable." })
                .eq("id", job.id);
            continue;
        }

        if (job.notification_type !== "security" && job.notification_type !== "account") {
            const { data: prefs } = await supabase
                .from("email_notification_preferences")
                .select("social, announcements")
                .eq("user_id", job.user_id)
                .maybeSingle();

            const enabled = job.notification_type === "social"
                ? (prefs?.social ?? true)
                : job.notification_type === "announcements"
                    ? (prefs?.announcements ?? true)
                    : false;

            if (!enabled) {
                await supabase.from("email_notification_queue")
                    .update({ status: "skipped", last_error: "Disabled by user preference." })
                    .eq("id", job.id);
                continue;
            }
        }

        // Mark before sending so overlapping worker ticks do not normally pick it up.
        const { data: claimed, error: claimError } = await supabase
            .from("email_notification_queue")
            .update({ status: "sending", attempts: (job.attempts || 0) + 1 })
            .eq("id", job.id)
            .eq("status", "pending")
            .select("id")
            .maybeSingle();

        if (claimError || !claimed) continue;

        try {
            const response = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + apiKey,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    from,
                    to: [recipient],
                    subject: job.subject,
                    text: job.text_body,
                    ...(job.html_body ? { html: job.html_body } : {})
                })
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(result.message || result.name || "Email provider rejected the message.");
            }

            await supabase.from("email_notification_queue")
                .update({
                    status: "sent",
                    sent_at: new Date().toISOString(),
                    provider_message_id: result.id || null,
                    last_error: null
                })
                .eq("id", job.id);
        } catch (error) {
            const attempts = (job.attempts || 0) + 1;
            await supabase.from("email_notification_queue")
                .update({
                    status: attempts >= 5 ? "failed" : "pending",
                    scheduled_at: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60000).toISOString(),
                    last_error: String(error.message || error).slice(0, 1000)
                })
                .eq("id", job.id);
            console.error("EMAIL DELIVERY ERROR:", error.message || error);
        }
    }
}

module.exports = {
    createEmailNotificationRouter,
    enqueueEmail,
    sendQueuedEmails
};
