# Changelog

## 0.15.1 — 2026-05-06

- Clara Core: `applyClaraStatePatch` + `updateAgendaItemById` / `buildShiftAgendaItemMinutesPatch` voor runtime Clara State (in-memory; seed blijft `CLARA_STATE/core.json`).
- Schedule-X blijft viewlaag: drag-and-drop + resize plugins; `onEventUpdate` → `scheduleXEventToAgendaItemUpdatePatch` → state → opnieuw `events.set` vanuit Clara State.
- Testactie “+30 min (eerste item)” gebruikt dezelfde patchlaag (fallback/QA zonder op DnD te vertrouwen).
- UI: versie `v0.15.1`, compacte metrics (aantal agenda-items, `updated_at`, laatste patch).
- Script: `npm run test:patch` — lichte sanity-check op de patchfuncties.

Nog niet: persistente opslag, Supabase, ChatGPT/analyze-koppeling.

## 0.15.0 — eerder

- Minimale Clara Core shell met Schedule-X en read-only Clara State.
