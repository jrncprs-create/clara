-- Clara 3.0 Schema
-- Run in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists clara_spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  summary text,
  focus text,
  created_at timestamptz default now()
);

create table if not exists clara_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text,
  created_at timestamptz default now()
);

create table if not exists clara_projects (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references clara_spaces(id) on delete cascade,
  name text not null,
  summary text,
  status text default 'active',
  priority text default 'medium',
  momentum text default 'medium',
  health text default 'watch',
  bottleneck text,
  risk text,
  next_step text,
  owner_id uuid references clara_profiles(id),
  participant_ids uuid[] default '{}',
  created_at timestamptz default now()
);

create table if not exists clara_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references clara_projects(id) on delete cascade,
  title text not null,
  description text,
  status text default 'open',
  priority text default 'medium',
  due_date date,
  created_by uuid references clara_profiles(id),
  assigned_to uuid references clara_profiles(id),
  created_at timestamptz default now()
);

create table if not exists clara_waiting_for (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references clara_projects(id) on delete cascade,
  waiting_on text,
  reason text,
  owner_id uuid references clara_profiles(id),
  since text,
  follow_up_date text,
  status text default 'open',
  created_at timestamptz default now()
);

create table if not exists clara_decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references clara_projects(id) on delete cascade,
  title text,
  description text,
  impact text,
  decision_date date,
  created_at timestamptz default now()
);

create table if not exists clara_timeline (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references clara_projects(id) on delete cascade,
  author_id uuid references clara_profiles(id),
  title text,
  description text,
  created_at timestamptz default now()
);

alter table clara_spaces enable row level security;
alter table clara_profiles enable row level security;
alter table clara_projects enable row level security;
alter table clara_tasks enable row level security;
alter table clara_waiting_for enable row level security;
alter table clara_decisions enable row level security;
alter table clara_timeline enable row level security;

create policy "authenticated read spaces" on clara_spaces
for select using (auth.role() = 'authenticated');

create policy "authenticated read profiles" on clara_profiles
for select using (auth.role() = 'authenticated');

create policy "authenticated read projects" on clara_projects
for select using (auth.role() = 'authenticated');

create policy "authenticated read tasks" on clara_tasks
for select using (auth.role() = 'authenticated');

create policy "authenticated read waiting" on clara_waiting_for
for select using (auth.role() = 'authenticated');

create policy "authenticated read decisions" on clara_decisions
for select using (auth.role() = 'authenticated');

create policy "authenticated read timeline" on clara_timeline
for select using (auth.role() = 'authenticated');

create policy "authenticated insert tasks" on clara_tasks
for insert with check (auth.role() = 'authenticated');

create policy "authenticated insert projects" on clara_projects
for insert with check (auth.role() = 'authenticated');

create policy "authenticated insert decisions" on clara_decisions
for insert with check (auth.role() = 'authenticated');

create policy "authenticated insert waiting" on clara_waiting_for
for insert with check (auth.role() = 'authenticated');

create policy "authenticated insert timeline" on clara_timeline
for insert with check (auth.role() = 'authenticated');
