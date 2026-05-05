## Clara (repo)

### Clara Core v0.15.1 (Clara State patches + Schedule-X roundtrip)

- **Clara State** is de bron van waarheid; wijzigingen lopen via `applyClaraStatePatch` in `clara-core/src/claraStatePatch.js` (runtime in-memory; seed: `CLARA_STATE/core.json`).
- **Schedule-X** blijft een **view** op `agenda_items` (`clara-core/src/mapClaraAgendaToScheduleX.js`). Drag/resize gebruikt `@schedule-x/drag-and-drop` en `@schedule-x/resize`; `callbacks.onEventUpdate` zet events om met `clara-core/src/scheduleXToClaraPatch.js` en past daarna dezelfde patchlaag toe. Daarna wordt de kalender opnieuw vanuit Clara State gesynchroniseerd (geen Schedule-X als waarheid).
- **Testactie:** knop “+30 min (eerste item)” —zelfde patchfundament, handig als DnD even niet nodig is.
- **Checks:** `npm run build` · `npm run test:patch` · `node --check` op de gewijzigde JS-bestanden.
- **Dev:** `npm run dev` (Vite met `--configLoader native` i.v.m. een lege `package.json` hoger in de mapstructuur).
- **Build / preview:** `npm run build` → `clara-core/dist/` · `npm run preview`

### Ontwerpdocumenten

`CLARA_STATUS/core-truth.md`, `CLARA_STATUS/clara-core-v015-breakthrough.md`, `CLARA_STATUS/clara-core-v015-history-and-principles.md`

### Later

- Persistente Clara State + gedeelde opslag
- ChatGPT / analyze → gestructureerde patches (zelfde `applyClaraStatePatch`-contract)

**Gewenste ChatGPT → Clara Core sync-flow:**

Een gesprek met ChatGPT verandert Clara Core niet automatisch zolang er nog geen gedeelde patch/write-route is. v0.15 moet hier wel expliciet op voorbereid worden:

```text
ChatGPT-gesprek
→ Clara State patch
→ gedeelde opslag/API
→ Clara Core ontvangt update via refresh, polling, realtime of een handmatige sync-knop
→ Schedule-X rendert opnieuw vanuit Clara State
```

Afspraken:

- ChatGPT blijft de denklaag en gesprekspartner.
- Clara Core blijft de werkplek/UI.
- Clara State is de gedeelde operationele bron van waarheid.
- Schedule-X is alleen de calendar-view; state blijft leidend.
- Mogelijke latere routes: handmatige sync-knop, polling, websocket/realtime of API-trigger vanuit ChatGPT/Action.

---

→ Zie `CHANGELOG.md` voor releases.
