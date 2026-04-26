# CLARA 3.0 REPO ANALYSIS

Analyse op basis van de huidige GitHub-repo `jrncprs-create/clara`.

Datum: 2026-04-26

---

## Korte conclusie

De repo bevat al een werkende Clara 2.x-achtige applicatie met:

- een grote single-file frontend in `index.html`
- backendlogica in `api/chat.js`
- Supabase-koppeling
- Vercel-deployment
- bestaande dashboard/chat/review/workshop/agenda-logica

Voor Clara 3.0 is dit waardevol, maar het moet niet direct worden overschreven.

Beste route:

> Clara 3.0 naast de bestaande Clara bouwen, met duidelijke scheiding tussen legacy en nieuwe structuur.

---

## Huidige repo-observaties

### Root

Aanwezige hoofdonderdelen zichtbaar in GitHub:

```text
CLARA_STATUS/
UX/
api/
supabase/
.gitignore
README.md
index.html
package.json
privacy.html
```

---

## Belangrijke bestanden

### `README.md`

De README verwijst naar `CLARA_STATUS.md` als actuele statusbron.

Huidige inhoud is minimaal:

```text
→ Zie CLARA_STATUS.md voor actuele status
```

Actiepunt:

- README later vervangen of uitbreiden met Clara 3.0-startpunt.
- Niet nu doen als eerste stap.

---

### `package.json`

Huidige dependencies zijn extreem beperkt:

```json
{
  "name": "clara",
  "version": "1.0.0",
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0"
  }
}
```

Interpretatie:

- Clara is technisch licht opgezet.
- Geen zware frontend buildstack zichtbaar.
- Waarschijnlijk bewust simpel gehouden.
- Goed voor Clara 3.0, want een eenvoudige V1 kan zonder zware herbouw.

---

### `index.html`

`index.html` is een zeer groot single-file frontendbestand.

Het bevat onder andere:

- bestaande UI
- oude Clara dashboard/panelen
- chatinterface
- notities
- LaLampe/workshop-onderdelen
- review-pane
- nieuwe/legacy UI toggles
- veel inline CSS
- waarschijnlijk ook veel inline JavaScript

Belangrijk detail:

Er zijn al termen aanwezig zoals:

```text
legacy-app-shell
new-app-shell
new-sidebar
new-views
dash-grid
dash-card
```

Interpretatie:

- Er is al een overgangsfase begonnen tussen oude en nieuwe UI.
- De frontend is bruikbaar als referentie.
- Maar als basis voor Clara 3.0 is dit bestand te zwaar en te risicovol.

Risico:

> Direct verder bouwen in `index.html` vergroot de kans dat oude Clara 2.0-logica en Clara 3.0 door elkaar blijven lopen.

Advies:

- `index.html` voorlopig beschouwen als legacy/stable.
- Niet leegmaken.
- Niet herschrijven zonder aparte branch.
- Clara 3.0 dashboard liever eerst in een nieuw apart bestand of aparte map bouwen.

---

### `api/chat.js`

`api/chat.js` bevat veel backendlogica.

Herkenbare onderdelen:

- Supabase client
- OpenAI modelkeuze
- tabel `clara_items`
- grote `CLARA_MASTER_PROMPT`
- parsing van taken, afspraken, notities, ideeën, projecten, beslissingen en workshops
- datum- en tijdnormalisatie
- Nederlandse datumlogica
- review-output
- workshoplogica
- deduplicatie/similarity-logica

Belangrijk:

De huidige backend is sterk gericht op Clara 2.0:

```text
menselijke input → AI parser → JSON review → opslag in clara_items
```

Dit is precies de laag die voor Clara 3.0 niet verder uitgebreid moet worden.

Interpretatie:

- Deze file bevat waardevolle bewezen logica.
- Maar deze file is niet de nieuwe kern van Clara 3.0.
- Voor Clara 3.0 moet `api/chat.js` voorlopig legacy blijven.

Advies:

- Niet verwijderen.
- Niet direct refactoren.
- Niet verder uitbreiden met Clara 3.0-logica.
- Alleen gebruiken als referentie voor bestaande werkende flows.

---

## Wat hoort bij Clara 2.0 / legacy?

Voorlopig legacy:

```text
index.html
api/chat.js
bestaande clara_items-flow
bestaande review-flow
bestaande workshop-flow
oude dashboard/panel structuur
```

Niet omdat het slecht is.

Wel omdat het te veel bestaande aannames bevat.

---

## Wat is bruikbaar voor Clara 3.0?

Bruikbaar:

```text
Supabase-koppeling
Vercel-deployment
GitHub-repo
bestaande UI-stijl
ervaring met review/dashboard
bestaande project/workshopkennis
```

Ook bruikbaar als inhoudelijke lessen:

- notities moeten simpel blijven
- parsing wordt snel complex
- dashboard geeft pas waarde als het echt overzicht geeft
- projectcontext is belangrijker dan losse items

---

## Wat moet Clara 3.0 anders doen?

Clara 2.0 denkt vanuit losse items:

```text
taak
afspraak
notitie
idee
project
beslissing
workshop
```

Clara 3.0 moet denken vanuit projecten:

```text
PROJECT
  TASKS
  DECISIONS
  NOTES
  WAITING_FOR
  TIMELINE
  USERS
```

Belangrijk verschil:

> In Clara 3.0 is het project de kern. Niet de parser.

---

## Aanbevolen veilige route

### Stap 1 — Documentatie vastzetten

Gedaan:

```text
docs/CLARA_3_PLAN.md
```

Nieuwe waarheid voor Clara 3.0.

---

### Stap 2 — Repo-analyse vastzetten

Dit document:

```text
docs/CLARA_3_REPO_ANALYSIS.md
```

---

### Stap 3 — Maak aparte Clara 3.0 werkruimte

Aanbevolen nieuwe structuur:

```text
clara-3/
  index.html
  README.md
  data-model.md
```

Of, als we dichter bij Vercel willen blijven:

```text
v3/
  index.html
```

Niet meteen de root `index.html` vervangen.

---

### Stap 4 — Maak Dashboard V1 statisch

Eerst zonder Supabase.

Doel:

- layout testen
- inhoud testen
- kijken of dit voor Jeroen/Marlon/Joep logisch voelt

Blokken:

```text
Vandaag
Projecten
Waiting For
Team Activity
Focus
```

---

### Stap 5 — Daarna pas datamodel

Pas na statische dashboard-check:

```text
users
projects
tasks
decisions
notes
waiting_for
timeline
```

---

### Stap 6 — Daarna pas Supabase-migraties

Niet eerder.

Anders wordt het opnieuw backend-first.

---

### Stap 7 — Daarna pas AI/contextlaag

AI leest dan bestaande projectdata.

Niet andersom.

---

## Codex-regels voor dit project

Codex mag:

- nieuwe documenten aanmaken
- analyse doen
- nieuwe V3-map maken
- statisch dashboard maken
- voorstellen doen

Codex mag niet zonder expliciete bevestiging:

- `index.html` vervangen
- `api/chat.js` refactoren
- bestaande Supabase-tabellen aanpassen
- legacy-code verwijderen
- review-flow slopen
- workshop-flow slopen
- root deployment omzetten

---

## Eerste concrete volgende bouwstap

Maak een nieuwe map:

```text
clara-3/
```

Met daarin:

```text
clara-3/index.html
clara-3/README.md
```

In `clara-3/index.html` komt een statisch Dashboard V1 met mockdata:

- Vandaag
- Projecten
- Waiting For
- Team Activity
- Focus

Geen backend.
Geen API.
Geen Supabase.
Geen AI.

Doel:

> Voelen of Clara 3.0 als gedeelde cockpit klopt voordat we technisch bouwen.

---

## Besluit

De repo moet niet geleegd worden.

De bestaande Clara blijft voorlopig legacy/stable.

Clara 3.0 krijgt een schone parallelle start.

Eerst zien.
Dan pas verbinden.
