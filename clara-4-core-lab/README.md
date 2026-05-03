# Clara 4 Core Lab

Clara 4 begint niet als dashboard-app, maar als een kleine testomgeving voor Clara's intelligentie.

Doel:

> Input → Clara analyseert → Clara laat zien wat ze begrijpt, wat ze zou opslaan en wat ze op het dashboard zou tonen.

## Status

Versie: `0.14.3`

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

Open daarna de lokale Vercel-url en test met losse input.

## Online bekijken (thuis / Vercel)

De app staat in **`clara-4-core-lab/`** binnen de GitHub-repo. Vercel moet die map als project-root gebruiken, anders deploy je de verkeerde map of faalt de build.

1. **Vercel** → jouw project (gekoppeld aan deze GitHub-repo) → **Settings** → **General** → **Root Directory** = **`clara-4-core-lab`** (exact deze naam, zonder slash aan het eind).
2. **Settings** → **Environment Variables** (minstens **Production**): zet **`OPENAI_API_KEY`** (zelfde als lokaal). Optioneel: **`OPENAI_MODEL`** (bijv. `gpt-4.1-mini`).
3. **Deployments**: na elke push naar **`main`** hoort een nieuwe deployment te starten. Open de **Production**-URL onder **Domains** (bijv. `https://<projectnaam>.vercel.app`) — daar laad je de lab-UI (`index.html`); analyse gaat via **`/api/analyze`** op hetzelfde domein.
4. Werkt de site niet: controleer Root Directory, of de laatste deployment **Succeeded** is, en of env-vars voor Production gezet zijn (herdeploy na wijziging).

Optioneel:

```bash
OPENAI_MODEL="gpt-4.1-mini" OPENAI_API_KEY="jouw_key" npm run dev
```

## Clara-principe

Clara is de assistent. Het dashboard is niet de bron, maar haar spoor.

Bronnen zoals chat, mail en agenda worden uiteindelijk gelezen door Clara. Clara bepaalt wat betekenisvol is en vult daarmee het dashboard.

## Niet in deze versie

Nog geen:

- echte mailkoppeling
- echte agendakoppeling
- Supabase
- login
- opslag
- mooie dashboard-UI

Eerst testen we of Clara goed denkt.
