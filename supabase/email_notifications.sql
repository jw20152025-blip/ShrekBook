-- ShrekBook email notification system
-- Run this entire file once in Supabase SQL Editor.
-- These tables are accessed only by the trusted Node.js server using the service-role key.

create table if not exists public.email_notification_preferences (
    user_id uuid primary key references auth.users(id) on delete cascade,
    social boolean not null default true,
    announcements boolean not null default true,
    security boolean not null default true,
    updated_at timestamptz not null default now()
);

create table if not exists public.email_notification_queue (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    notification_type text not null check (notification_type in ('account', 'security', 'social', 'announcements')),
    subject text not null,
    text_body text not null,
    html_body text,
    status text not null default 'pending'
        check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
    attempts integer not null default 0,
    scheduled_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    sent_at timestamptz,
    provider_message_id text,
    last_error text
);

create index if not exists email_notification_queue_pending_idx
    on public.email_notification_queue (scheduled_at, created_at)
    where status = 'pending';

create index if not exists email_notification_queue_user_idx
    on public.email_notification_queue (user_id, created_at desc);

alter table public.email_notification_preferences enable row level security;
alter table public.email_notification_queue enable row level security;

-- No client policies are created. The application server accesses these tables
-- through SUPABASE_SERVICE_ROLE_KEY; browser clients cannot read queued email content.
