-- Documentatie in de database (Supabase UI / introspectie).
-- Geen functionele wijzigingen aan tabellen.

comment on table public.projects is
  'Clara-projecten. Workshops hangen onder het LaLampe-project (project_id op public.workshops).';

comment on table public.workshops is
  'LaLampe workshop-sessies. Bron voor GET /api/workshops en dashboard.workshops.';

comment on table public.workshop_participants is
  'Inschrijvingen per workshop (naam, deelnemer- en betaalstatus).';
