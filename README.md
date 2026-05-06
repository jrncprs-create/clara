## Clara (repo)

### Clara Core v0.15.4.5 — Compact calendar-first werkplek (UI)

- **Layout:** compacte topbar (brand + sync), smalle **rail** (Vandaag/Chat/Taken/Notities), **kalender** als hoofdcanvas, **uitleg/chat-drawer** (midden). **Geen globale composer** meer; chatinvoer zit alleen in de **Chat**-drawer.
- **Functionaliteit (v0.15.x):** ongewijzigd — `GET/POST /api/clara-state`, `POST /api/clara-analyze`, Schedule-X DnD/resize → patches, expliciet **Toepassen** op analyze-voorstellen.
- **Dev:** state JSON en test **+30 min** zitten in een modal achter het rail-icoon **State (dev)**.

### Clara Core v0.15.3 — Analyze → patchvoorstellen (expliciet toepassen)

- **Clara State** blijft de bron van waarheid. **Schedule-X** blijft view/interactie (DnD/resize → directe patch + POST).
- **API (contract):**
  - `GET /api/clara-state` — volledige state JSON.
  - `POST /api/clara-state/patch` — patches toepassen + (lokaal) naar `CLARA_STATE/core.json` schrijven.
  - **`POST /api/clara-analyze`** — `{ "input": "…", "state": {…} optioneel, "source": "clara-core"|"chatgpt" }` → `{ ok, summary, patches, questions, warnings }`. **Geen automatische state-mutatie**; Clara Core toont voorstel en gebruikt **Toepassen** → `POST /api/clara-state/patch`.
- **AI:** met `OPENAI_API_KEY` (optioneel `OPENAI_MODEL`, default `gpt-4o-mini`) gebruikt de server een minimale JSON-prompt; zonder key → **rule-based fallback** (documenteert dev-gedrag).
- **Implementatie:** o.a. `scripts/clara-analyze.mjs`, `scripts/clara-analyze-validate.mjs`, `scripts/clara-analyze-fallback.mjs`, `scripts/clara-analyze-openai.mjs`, `api/clara-analyze.js`, uitbreiding Vite-middleware in `scripts/clara-state-api-middleware.mjs`.
- **Checks:** `npm run test:patch` · `npm run test:api` · `npm run test:analyze` · `npm run build`.

**Runtime-beperkingen**

- `vite preview` serveert **geen** API-middleware — alleen statische build; patches vallen dan terug op rollback + waarschuwing. Gebruik `npm run dev` of `vercel dev` / productie met serverless.
- **Vercel:** serverless heeft vaak **geen schrijfbare** projectmap; `POST` kan falen (`EROFS` / `EACCES`). Zet desnoods `CLARA_REPO_ROOT` naar een schrijfbaar pad of kies later object-storage/Supabase. Geen secrets in deze stap.

### Ontwerpdocumenten

`CLARA_STATUS/core-truth.md`, `CLARA_STATUS/clara-core-v015-breakthrough.md`, `CLARA_STATUS/clara-core-v015-history-and-principles.md`

### Dev / build

- `npm run dev` — Vite + lokale `/api/clara-state` (middleware).
- `npm run build` → `clara-core/dist/` · `npm run preview` (zonder API).

### Later

- Betrouwbare centrale persistence (o.a. Supabase) + externe ChatGPT-flow die hetzelfde analyze-contract aanroept.

---

→ Zie `CHANGELOG.md` voor releases.
