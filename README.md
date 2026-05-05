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

---

→ Zie `CLARA_STATUS/` voor ontwerp- en statusdocumenten.
