-- Vereist voor workshops; op sommige omgevingen bestond alleen clara_items nog zonder projects.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- LaLampe main project (idempotent)
insert into public.projects (name, type, status)
select 'LaLampe', 'workshop_main', 'active'
where not exists (
  select 1 from public.projects p where lower(trim(p.name)) = 'lalampe'
);

create table public.workshops (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null references public.projects (id) on delete restrict,

  title text not null,
  workshop_type text not null default 'lalampe',

  workshop_date date not null,
  start_time time,
  end_time time,

  location text,

  max_participants int not null default 4
    check (max_participants > 0),

  status text not null default 'draft'
    check (status in (
      'draft', 'planned', 'open', 'full', 'completed', 'cancelled'
    )),

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workshops_time_order check (
    start_time is null
    or end_time is null
    or end_time > start_time
  )
);

create index workshops_project_id_idx on public.workshops (project_id);
create index workshops_date_idx on public.workshops (workshop_date);
create index workshops_status_idx on public.workshops (status);
create index workshops_project_date_idx on public.workshops (project_id, workshop_date desc);

create table public.workshop_participants (
  id uuid primary key default gen_random_uuid(),

  workshop_id uuid not null references public.workshops (id) on delete cascade,

  contact_id uuid,

  name text not null,
  email text,
  phone text,

  participant_status text not null default 'interested'
    check (participant_status in (
      'interested', 'invited', 'confirmed', 'paid', 'attended', 'cancelled', 'no_show'
    )),

  payment_status text not null default 'unpaid'
    check (payment_status in (
      'unpaid', 'pending', 'paid', 'refunded'
    )),

  object_description text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workshop_participants_workshop_id_idx
  on public.workshop_participants (workshop_id);

create index workshop_participants_status_idx
  on public.workshop_participants (workshop_id, participant_status);
