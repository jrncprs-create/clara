## Clara (repo)

### Clara Core v0.15.2 — Clara State API (eerste persistente patch-route)

- **Clara State** blijft de bron van waarheid. **Schedule-X** is view/interactie (DnD/resize → patch).
- **API (contract):**
  - `GET /api/clara-state` — response body = volledige Clara State (JSON zoals `CLARA_STATE/core.json`).
  - `POST /api/clara-state/patch` — body `{ "patch": { ... }, "source": "clara-core" }` of `{ "patches": [ ... ], "source": "..." }`. Bij succes: `{ "ok": true, "state": { ... }, "applied": [ ... ] }`.
- **Implementatie:** gedeelde logica in `scripts/clara-state-repo-api.mjs`; Vercel-handlers `api/clara-state.js` en `api/clara-state/patch.js`; in **dev** idem routes via Vite-plugin in `clara-core/vite.config.js` (schrijft naar `CLARA_STATE/core.json` onder repo-root).
- **Frontend:** `clara-core/src/main.js` — probeert GET `/api/clara-state`, faalt dat → `/core.json`; na wijziging optimistic `applyClaraStatePatch`, daarna POST; bij fout **rollback** + waarschuwing in metrics (geen crash).
- **Checks:** `npm run test:patch` · `npm run test:api` · `npm run build` · `node --check` op gewijzigde JS (zie CI/handmatig).

**Runtime-beperkingen**

- `vite preview` serveert **geen** API-middleware — alleen statische build; patches vallen dan terug op rollback + waarschuwing. Gebruik `npm run dev` of `vercel dev` / productie met serverless.
- **Vercel:** serverless heeft vaak **geen schrijfbare** projectmap; `POST` kan falen (`EROFS` / `EACCES`). Zet desnoods `CLARA_REPO_ROOT` naar een schrijfbaar pad of kies later object-storage/Supabase. Geen secrets in deze stap.

### Ontwerpdocumenten

`CLARA_STATUS/core-truth.md`, `CLARA_STATUS/clara-core-v015-breakthrough.md`, `CLARA_STATUS/clara-core-v015-history-and-principles.md`

### Dev / build

- `npm run dev` — Vite + lokale `/api/clara-state` (middleware).
- `npm run build` → `clara-core/dist/` · `npm run preview` (zonder API).

### Later

- Betrouwbare centrale persistence (o.a. Supabase) + ChatGPT/analyze → dezelfde patch-types.

---

→ Zie `CHANGELOG.md` voor releases.
