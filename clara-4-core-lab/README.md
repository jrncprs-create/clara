# Clara 4 Core Lab

Clara 4 begint niet als dashboard-app, maar als een kleine testomgeving voor Clara's intelligentie.

Doel:

> Input → Clara analyseert → Clara laat zien wat ze begrijpt, wat ze zou opslaan en wat ze op het dashboard zou tonen.

## Status

Versie: `0.1`

Deze map staat los van Clara 3. Clara 3 blijft geparkeerd als leerprototype.

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
