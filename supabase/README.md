# Supabase (Clara)

Korte leidraad om de database **consistent** te houden met de app (`/api/dashboard`, `/api/workshops`).

## Migraties (volgorde)

Bestanden onder `migrations/` worden op **bestandsnaam-tijdstempel** toegepast:

| Bestand | Doel |
|--------|------|
| `20260418143414_remote_schema.sql` | Leeg placeholder; geen wijzigingen. Niet verwijderen als hij al op een omgeving gedraaid is. |
| `20260418160000_create_projects.sql` | Maakt `public.projects` (eerste stap). |
| `20260418171000_add_clara_items_project_id.sql` | Voegt `project_id` toe aan **`public.clara_items`** — vereist dat `clara_items` en `projects` al bestaan. |
| `20260419130000_workshops_and_participants.sql` | `projects` (IF NOT EXISTS), LaLampe-seed, `workshops`, `workshop_participants`. |

**Let op:** workshop-data voor het Workshops-scherm zit in **`public.workshops`**, niet in `clara_items`. Alleen `clara_items` vullen geeft dus **geen** kaarten op `#/workshops`.

## Cloud (bv. `supabase-teal-jacket`)

1. **Alle migraties** op dat project toepassen (`supabase db push` vanaf repo, of SQL handmatig plakken in de editor — dan de **volledige** inhoud van `20260419130000_…` in één keer).
2. **Vercel / API:** `SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` (of anon) moeten naar **dezelfde** project-ref wijzen.
3. **Controleren na deploy:**

```sql
select count(*) as projects from public.projects;
select count(*) as workshops from public.workshops;
select id, name from public.projects where lower(trim(name)) = 'lalampe';
```

## Lokale CLI (optioneel)

```bash
supabase link   # koppel aan remote project-ref
supabase db pull   # schema diff (indien nodig)
supabase db push   # migraties naar gekoppeld project
```

`config.toml` staat in deze map voor een minimale lokale stack (`supabase start`).
