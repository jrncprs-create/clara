create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
