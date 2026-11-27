-- Erin board: pull requests reported by the GitHub webhook (supabase/functions/github-webhook).
-- One row per (work item key, repo, PR number). The Edge Function (service role) is the only writer.
create table if not exists public.github_prs (
  issue_key    text not null,          -- LMS-6555, EEA-45
  repo         text not null,          -- erinsystemsllc/lms-cloud-client
  number       int  not null,
  title        text,
  state        text,                   -- open | closed
  draft        boolean default false,
  merged       boolean default false,
  url          text,
  author       text,
  head_ref     text,
  checks       text,                   -- success | failure | pending
  review_state text,                   -- approved | changes_requested
  updated_at   timestamptz not null default now(),
  primary key (issue_key, repo, number)
);

create index if not exists github_prs_updated on public.github_prs (updated_at desc);

-- No policies on purpose: anon/authenticated clients can't read or write.
-- The board reads through the sharer's Supabase connector; the webhook writes with the service role.
alter table public.github_prs enable row level security;
-- Newer Supabase projects don't grant table privileges to API roles by default.
-- The webhook (service role) needs these, or PostgREST answers 403.
grant select, insert, update on public.github_prs to service_role;
