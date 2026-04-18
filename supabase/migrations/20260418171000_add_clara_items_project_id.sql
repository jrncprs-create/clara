alter table public.clara_items
  add column project_id uuid references public.projects (id) on delete set null;
