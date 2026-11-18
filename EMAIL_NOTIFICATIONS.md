# ShrekBook Email Notifications

## What is included

- A persistent Supabase-backed email queue.
- A server-side worker that sends queued messages through Resend.
- Per-account preferences for social and announcement emails.
- Security/account messages that cannot be disabled.
- A welcome email queued after successful signup.
- A settings page at \`/email-settings.html\`.

## 1. Apply the database migration

In the Supabase dashboard, open **SQL Editor**, paste the complete contents of
\`supabase/email_notifications.sql\`, and run it once.

The tables intentionally have RLS enabled and no browser-facing policies.
The Node server accesses them with the existing Supabase service-role key.
Never put that key in browser JavaScript.

## 2. Configure the sending provider

Create a Resend account and add the domain you control. Complete the DNS
verification records shown by Resend (typically SPF and DKIM; configure DMARC
as recommended by the provider). Do not guess or substitute DNS record values:
copy the exact values from the provider dashboard.

Add these environment variables to the ShrekBook hosting service:

- \`RESEND_API_KEY\`: the private Resend API key.
- \`EMAIL_FROM\`: a verified sender, for example
  \`ShrekBook <notifications@shrekbook.bbroot.com>\`.

Keep \`RESEND_API_KEY\` private. Do not commit it to GitHub or expose it to
client-side code. The existing \`SUPABASE_URL\` and
\`SUPABASE_SERVICE_ROLE_KEY\` are reused.

## 3. Deploy and use

Deploy this branch after reviewing/merging it. Once the migration and provider
configuration are complete, new signups enqueue a welcome email. The worker
checks the queue every 15 seconds and retries transient failures with
increasing delays, up to five attempts.

Users can manage optional email categories at:

\`https://shrekbook.bbroot.com/email-settings.html\`

If provider credentials are absent, the application continues to run but
does not attempt delivery. Existing account creation and login do not depend
on the email provider.

## Notes

- This initial version provides the delivery foundation and preferences UI.
  Social and announcement event producers should call the exported
  \`enqueueEmail(supabase, ...)\` helper when those events are implemented.
- Security/account email categories are always enabled. The sender must still
  be configured and verified before mail can be delivered.
- Review provider sending limits and acceptable-use requirements before
  enabling production mail.
