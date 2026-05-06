# Changelog

## 0.15.4.10 — 2026-05-06

- Design: nieuwe `clara-core/design.css` toegevoegd als visuele Clara cockpit-laag bovenop de stabiele v0.15-shell.
- Design: rail, drawer, kalenderkaart, toolbar, daypart-toggle, chat en agenda-items krijgen een zachtere premium dark styling richting `design.png`.
- Veiligheid: geen AI/state/API-wijzigingen en geen Schedule-X DOM move/clone hacks; Schedule-X internals blijven op hun plek.
- Versie: zichtbare Clara Core-versie in rail naar `v0.15.4.10`.

## 0.15.4.7 — 2026-05-06

- Technisch: topbar/appbar verwijderd; branding + versie naar rail (`.side-brand`).
- Technisch: layout/scroll hard gefixt met `100dvh`, `overflow: hidden`, `min-height: 0` door de hele layout; drawer mag intern scrollen.
- Technisch: daypart-toggle (`.daypart-toggle`) alleen zichtbaar in Schedule‑X **Day** view; inline in `.calendar-toolbar` zonder overlap.
- Technisch: Schedule‑X header naar `.calendar-toolbar` verplaatst voor één stabiele control-zone.

## 0.15.4.5 — 2026-05-06

- UI-compactie: **geen globale composer**; chatinvoer + Analyze alleen in **Chat**-drawer.
- Rail: vereenvoudigd naar **Vandaag / Chat / Taken / Notities** (+ dev/state klein onderaan), met consistente line-icons.
- Kalender: dubbele topbar-controls verwijderd; **Schedule-X header** is de enige kalender-controlbar. **Overdag/Avond** verschijnt alleen in Dag-view.

## 0.15.4.4 — 2026-05-06

- Layout: kolommen omgedraaid naar **rail → uitleg/chat → kalender** (kalender blijft dominante breedte).
- Kalender UX: **dagdeel-tabs** (Overdag 09–18, Avond 18–00) zodat je niet hoeft te scrollen door een lange tijd-as.
- Uitlegkolom: nieuwe **Chat**-mode (sessie-in-memory) met user/Clara bubbles; Analyze blijft voorstellen tonen.

## 0.15.4.3 — 2026-05-06

- Clara Core: **vlakkere, donkerdere** shell (minder borders/radius, koelere tint i.p.v. paars-demo); topbar/rail/composer **lichter qua chrome**.
- **Viewport:** `html/body` + shell **zonder page-scroll**; grid-body `minmax(0,1fr)`; kalender **08:00–22:00** + compactere `weekOptions.gridHeight` zodat de weekgrid **binnen 100vh** blijft i.p.v. eindeloze tijd-as.
- Drawer: **minder kaarten** — secties via subtiele **scheiding** i.p.v. boxed zones; Schedule-X-wrapper **minder “kaart”** (geen zware rand/schaduw).

## 0.15.4.2 — 2026-05-06

- **Schedule-X:** agenda → events als `YYYY-MM-DD HH:mm` (geen Temporal/`[Europe/Amsterdam]`-string); kalender valideert weer; roundtrip DnD/resize → Clara State blijft via bestaande patchparser.
- **Tests:** `patch-smoke` uitgebreid met ZonedDateTime-string in Clara-tijd en asserts op afwezigheid `[Europe/Amsterdam]`.
- **UI:** lege kalender-overlay (“Nog niets gepland…”), vollere **Vandaag**-drawer (geen blokken vandaag, API vs seed, subtiele waarschuwing), iets compactere **composer**.

## 0.15.4.1 — 2026-05-06

- Clara Core: **UI-polish** op de calendar-first werkplek — rustigere contextdrawer (zones, lege staten, leesbare voorstelregels zonder JSON), **← Start** terug naar home, zachtere **Toepassen / Niet nu**.
- Composer: **textarea** + **Enter** = Analyze, **Shift+Enter** = nieuwe regel; visueel ingebed in de werkplek (afgeronde balk, schaduw).
- Schedule-X: **subtielere** gridlijnen en eventblokken; rail iets **secundairder**; drawer/kolombreedtes iets **laptop-vriendelijker**.

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
