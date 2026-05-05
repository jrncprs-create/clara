# Clara 4 Core Lab

Clara 4 begint niet als dashboard-app, maar als een kleine testomgeving voor Clara's intelligentie.

Doel:

> Input → Clara analyseert → Clara laat zien wat ze begrijpt, wat ze zou opslaan en wat ze op het dashboard zou tonen.

## Status

Versie: `0.14.41.3`

Deze map staat los van Clara 3. Clara 3 blijft geparkeerd als leerprototype.

## Werkregel (Core Lab)

1. Werk lokaal in Cursor.  
2. Geen commit of push tenzij Jeroen dat expliciet vraagt.  
3. Wijzigingen compact en gericht op het probleem.  
4. Primair `clara-4-core-lab/` en bijbehorende lab-API’s.  
5. Geen grote herbouw, geen nieuwe architectuur, geen opslaglaag tenzij expliciet gevraagd.  
6. **Versie:** kleine fix → patch (`0.12.8` → `0.12.9`); grotere werkende stap → minor (`0.12.x` → `0.13.0`).  
7. Alle versieplekken gelijk trekken: zichtbare UI (`app.js` / `index.html`), `package.json`, `package-lock.json` (root), `version.txt` / `version-label.txt` als die bestaan.  
8. **`CHANGELOG.md`:** per release versie, datum, korte regel.  
9. Test: `node --check` op gewijzigde JS + relevante lab-testzin(nen) waar mogelijk.  
10. Kort rapport: oude→nieuwe versie, bestanden, test, geen commit/push.

Wijzigingslog: zie `CHANGELOG.md`.

## Wat zit hierin

- `index.html` — simpele lab-interface
- `api/analyze.js` — AI-analyse endpoint
- `docs/clara-core-spec.md` — eerste gedrags- en outputspec
- `docs/test-inputs.md` — startset met testzinnen

## Lokaal draaien

Vanuit deze map:

```bash
npm install
OPENAI_API_KEY="jouw_key" npm run dev
```

`npm run dev` laadt lokaal `.env.local` vóór `vercel dev` start. Zet daarin bijvoorbeeld `OPENAI_API_KEY`, `OPENAI_MODEL_ANALYZE` en `OPENAI_MODEL_ACE`. `.env*.local` blijft genegeerd door git.

Open daarna de lokale Vercel-url en test met losse input.

## Online bekijken (thuis / Vercel)

De app staat in **`clara-4-core-lab/`** binnen de GitHub-repo. Vercel moet die map als project-root gebruiken, anders deploy je de verkeerde map of faalt de build.

1. **Vercel** → jouw project (gekoppeld aan deze GitHub-repo) → **Settings** → **General** → **Root Directory** = **`clara-4-core-lab`** (exact deze naam, zonder slash aan het eind).
2. **Settings** → **Environment Variables** (minstens **Production**): zet **`OPENAI_API_KEY`** (zelfde als lokaal). Optioneel: **`OPENAI_MODEL_ANALYZE`** voor Clara planning/dagregie (default `gpt-5.5`) en **`OPENAI_MODEL_ACE`** voor ACE-router/export (default `gpt-4.1-mini`). **`OPENAI_MODEL`** blijft fallback voor allebei.
3. **Deployments**: na elke push naar **`main`** hoort een nieuwe deployment te starten. Open de **Production**-URL onder **Domains** (bijv. `https://<projectnaam>.vercel.app`) — daar laad je de lab-UI (`index.html`); analyse gaat via **`/api/analyze`** op hetzelfde domein.
4. Werkt de site niet: controleer Root Directory, of de laatste deployment **Succeeded** is, en of env-vars voor Production gezet zijn (herdeploy na wijziging).

Optioneel:

```bash
OPENAI_MODEL="gpt-4.1-mini" OPENAI_API_KEY="jouw_key" npm run dev
```

Modelconfig:

- `OPENAI_MODEL_ANALYZE` — model voor `/api/analyze` (planning/dagregie), default `gpt-5.5`.
- `OPENAI_MODEL_ACE` — model voor `/api/ace` (ACE-router/export), default `gpt-4.1-mini`.
- `OPENAI_MODEL` — fallback wanneer een specifieke modelvariabele ontbreekt.

## ACE als ChatGPT Action

ChatGPT Actions kunnen niet naar `localhost`; deploy Clara Core Lab eerst naar Vercel en gebruik de Vercel-url als server in `docs/ace-action-openapi.yaml`.

1. Zet `ACE_ACTION_SECRET` in Vercel Environment Variables.
2. Zet hetzelfde secret in de GPT Action authentication als API key met custom header `X-ACE-SECRET`.
3. Plak `docs/ace-action-openapi.yaml` in het GPT Action schema en vervang `https://YOUR-VERCEL-DOMAIN.vercel.app`.
4. Begin met `mode: "check"`; gebruik `mode: "write"` pas wanneer routing betrouwbaar genoeg is.

Productie helpers:

```bash
scripts/ace-prod-check.sh
scripts/ace-prod-write-test.sh
```

Beide scripts vragen stil om `ACE_ACTION_SECRET`, tonen de secret niet en gebruiken `https://clara-4-core-lab.vercel.app/api/ace`. Gebruik de write-test alleen bewust: die doet een echte `mode: "write"` naar Projectbrain.

In production schrijft ACE via de GitHub Contents API naar de allowlisted Projectbrain-bestanden. Daarvoor is `PROJECTBRAIN_GITHUB_TOKEN` of `GITHUB_TOKEN` nodig; lokaal zonder GitHub-token blijft filesystem-append alleen voor dev/test mogelijk.

Routingtest:

```bash
node scripts/ace-routing-test.mjs
```

Deze test bewaakt onder andere dat `ACE test: LaLampe ...` naar `projectbrain/raw/lalampe.md` routeert en niet naar Clara Core Lab.

## BIU / Back it up

ACE is het systeem. BIU / Back it up is de methode of trigger waarmee Jeroen een gespreksextract bewust voorbereidt en daarna via ACE laat checken of schrijven. Schrijf `B I U` met spaties wanneer je alleen over de methode praat en de trigger niet wilt activeren.

BIU v1 was single-target. BIU v2 is een dunne multi-target scriptlaag bovenop ACE:

```bash
scripts/biu-check.sh
scripts/biu-write.sh
```

`biu-check.sh` splitst BIU-input met sectiekoppen in losse ACE-check-calls; `biu-write.sh` doet hetzelfde met `mode: "write"`. ACE blijft single-target, maar BIU v2 mag meerdere secties/targets in één extract verwerken. Check eerst, write bewust. Zie `docs/biu.md`.

Parser-only test zonder API-call of secret:

```bash
scripts/biu-check.sh --dry-run
```

## Clara-principe

Clara is de assistent. Het dashboard is niet de bron, maar haar spoor.

Bronnen zoals chat, mail en agenda worden uiteindelijk gelezen door Clara. Clara bepaalt wat betekenisvol is en vult daarmee het dashboard.

De rechterkolom is Clara's lichte regiepaneel:

- **Agenda suggesties** — concrete voorstellen die je als **Plan** (potloodblok) kunt zetten of met **Weg** verbergt.
- **Open items** — prangende vragen bovenaan in rood, daarna maximaal een paar compacte punten met antwoord, opslaan en weg.

Voor demo-inputs zoals “Maak een dagplanning” gebruikt Clara een snelle compacte 1-dagroute: meerdere potloodblokken over relevante projecten, geen overlap en wat niet past bij open items. Rechtsonder staat een knop om suggesties opnieuw op te bouwen (zonder chatbericht of reset van verborgen open items).

## Niet in deze versie

Nog geen:

- echte mailkoppeling
- echte agendakoppeling
- Supabase
- login
- opslag
- mooie dashboard-UI

Eerst testen we of Clara goed denkt.
