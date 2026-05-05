## Clara (repo)

### Clara Core v0.15 (Schedule-X shell)

- **Ontwerpwaarheid:** `CLARA_STATUS/core-truth.md`, `CLARA_STATUS/clara-core-v015-breakthrough.md`, `CLARA_STATUS/clara-core-v015-history-and-principles.md`
- **State (bron):** `CLARA_STATE/core.json` — de app leest dit; Schedule-X toont alleen een **gemapte** weergave (`clara-core/src/mapClaraAgendaToScheduleX.js`).
- **Dev:** `npm install` → `npm run dev` (Vite draait met `--configLoader native` zodat een lege `package.json` hoger in de mapstructuur de config niet breekt).
- **Build / preview:** `npm run build` → `clara-core/dist/` · `npm run preview`

**Later aansluiten (nog niet in deze stap):**

- Drag-and-drop / reschedule in de kalender → updates naar Clara State.
- ChatGPT / analyze → gestructureerde patches op Clara State.
- Gedeelde persistentie → centrale opslag van Clara State.

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

→ Zie `CLARA_STATUS/` voor ontwerp- en statusdocumenten.
