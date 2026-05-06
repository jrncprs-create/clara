# Changelog

## 0.15.4 — 2026-05-06

- Clara Core UI: **calendar-first** werkplek (Reclaim-achtige hiërarchie, donker Clara-thema): topbar, smalle rail, dominant Schedule-X-middenpaneel, rechter **context-drawer**, compacte **composer**-invoer (geen drie kolommen v0.14).
- Drawer: start (vandaag/focus/voorstellen/context), secties Taken/Notities/Clara, detail bij kalenderklik, **Analyze** met leesbare voorstellen + Toepassen/Niet nu.
- Debug/state: alleen in **modal (dev)**; testknop **+30 min** verplaatst naar dev-tools.
- Schedule-X: donkere theme-tokens via wrapper-CSS voor rustiger, minder “demo”-aanzicht.

## 0.15.3 — 2026-05-06

- `POST /api/clara-analyze`: `{ input, state?, source? }` → `{ ok, summary, patches, questions, warnings, engine? }`. Patches zijn **voorstellen**; Clara Core past ze pas toe na expliciete actie (POST `/api/clara-state/patch`).
- **OpenAI** (optioneel): `OPENAI_API_KEY` + optioneel `OPENAI_MODEL`; strikt JSON via Chat Completions. Faalt de call → **rule-based fallback** (dev) met waarschuwing.
- **Patch uitbreiding:** `note.create` in `applyClaraStatePatch`; **sanitize** in `scripts/clara-analyze-validate.mjs` (geen vage agenda, `agenda_item.update` alleen voor bekende id’s).
- UI: Analyze-knop, compact voorstel-paneel met **Toepassen** / **Niet nu**.
- Script: `npm run test:analyze`.

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

Nog niet: Supabase, volledige externe ChatGPT-koppeling buiten dit analyze-endpoint.

## 0.15.0 — eerder

- Minimale Clara Core shell met Schedule-X en read-only Clara State.
