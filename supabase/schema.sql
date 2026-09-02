create table if not exists public.cms_pages (
    page_key text primary key check (page_key ~ '^[a-z0-9_-]+\\.html$'),
    content jsonb not null default '{"nodes": {}, "customSections": {}}'::jsonb,
    updated_at timestamptz not null default now()
);

alter table public.cms_pages enable row level security;

-- The site reads and writes through the Edge Function, never directly from browsers.
revoke all on table public.cms_pages from anon, authenticated;
