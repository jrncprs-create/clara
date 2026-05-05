# Changelog

## 0.15.2 — 2026-05-06

- Clara State API: `GET /api/clara-state` (volledige state) en `POST /api/clara-state/patch` (`patch` of `patches`, optioneel `source`). Server gebruikt `applyClaraStatePatch` en schrijft `CLARA_STATE/core.json`.
- Vite dev: middleware in `clara-core/vite.config.js` serveert dezelfde routes lokaal.
- Clara Core: laadt via API als beschikbaar, anders `/core.json`; na wijziging optimistic patch + POST, bij succes `response.state`, bij fout rollback + compacte API-waarschuwing in metrics.
- Script: `npm run test:api` — tijdelijke map + disk-write smoke.

Beperking: op Vercel kan schrijven naar de repo-root mislukken (read-only build); gebruik `CLARA_REPO_ROOT` of een schrijfbare deploy-strategie. Geen Supabase in deze stap.

## 0.15.1 — 2026-05-06

- Clara Core: `applyClaraStatePatch` + `updateAgendaItemById` / `buildShiftAgendaItemMinutesPatch` voor runtime Clara State (in-memory; seed blijft `CLARA_STATE/core.json`).
- Schedule-X blijft viewlaag: drag-and-drop + resize plugins; `onEventUpdate` → `scheduleXEventToAgendaItemUpdatePatch` → state → opnieuw `events.set` vanuit Clara State.
- Testactie “+30 min (eerste item)” gebruikt dezelfde patchlaag (fallback/QA zonder op DnD te vertrouwen).
- UI: versie `v0.15.1`, compacte metrics (aantal agenda-items, `updated_at`, laatste patch).
- Script: `npm run test:patch` — lichte sanity-check op de patchfuncties.

Nog niet: Supabase, ChatGPT/analyze-koppeling (API-contract is wél voorbereid).

## 0.15.0 — eerder

- Minimale Clara Core shell met Schedule-X en read-only Clara State.
