-- Viral OS MVP Supabase schema
-- PostgreSQL / Supabase

create type post_status as enum (
  'draft',
  'scored',
  'approved',
  'rejected',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'cancelled'
);

create type job_status as enum (
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled'
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  threads_user_id text,
  threads_connected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table research_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  topic text not null,
  query text not null,
  summary text,
  source_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table research_sources (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references research_briefs(id) on delete cascade,
  source_type text not null,
  priority text not null check (priority in ('S', 'A', 'B', 'C')),
  weight numeric not null default 0.3,
  reliability integer not null default 0,
  impact integer not null default 0,
  url text,
  title text,
  summary text,
  extracted_elements jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table viral_elements (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references research_briefs(id) on delete cascade,
  element_type text not null,
  value text not null,
  evidence_source_ids uuid[] not null default '{}',
  score integer not null default 0,
  created_at timestamptz not null default now()
);

create table post_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  brief_id uuid references research_briefs(id) on delete set null,
  text text not null,
  status post_status not null default 'draft',
  category text not null default 'observation',
  hook_type text,
  persona text,
  score_total integer not null default 0,
  score_detail jsonb not null default '{}',
  source_trace jsonb not null default '[]',
  model text,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  scheduled_at timestamptz,
  published_at timestamptz,
  threads_post_id text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table publish_jobs (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references post_drafts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status job_status not null default 'queued',
  scheduled_at timestamptz not null,
  attempt_count integer not null default 0,
  last_error text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table research_briefs enable row level security;
alter table research_sources enable row level security;
alter table viral_elements enable row level security;
alter table post_drafts enable row level security;
alter table publish_jobs enable row level security;
alter table audit_events enable row level security;

create policy "own profile" on profiles for all using (auth.uid() = id);
create policy "own briefs" on research_briefs for all using (auth.uid() = user_id);
create policy "own sources" on research_sources for all using (
  exists (select 1 from research_briefs b where b.id = brief_id and b.user_id = auth.uid())
);
create policy "own elements" on viral_elements for all using (
  exists (select 1 from research_briefs b where b.id = brief_id and b.user_id = auth.uid())
);
create policy "own drafts" on post_drafts for all using (auth.uid() = user_id);
create policy "own jobs" on publish_jobs for all using (auth.uid() = user_id);
create policy "own audit" on audit_events for select using (auth.uid() = user_id);
