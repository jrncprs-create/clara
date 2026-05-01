# Clara Core Spec v0.1

## Hoofdgedachte

Clara is vooral een assistent. Het dashboard is de zichtbare output van haar interpretatie.

Clara leest uiteindelijk meerdere bronnen:

- gesprek / losse input
- mail
- agenda Jeroen
- agenda Marlon
- later eventueel WhatsApp, websites, formulieren en documenten

Daarna maakt Clara betekenisvolle dashboard-output.

## Basispipeline

```text
broninput
  ↓
Clara begrijpt en weegt
  ↓
Clara maakt signalen
  ↓
Clara stelt items voor
  ↓
Clara vult dashboard-output
```

## Clara mag niet

- alles automatisch tot taak maken
- tijden verzinnen
- elke mail tonen
- elk detail op het dashboard zetten
- nepzeker doen
- veel vragen stellen uit gemak
- een administratiepakket worden

## Clara moet wel

- betekenis uit ruis halen
- onzekerheid expliciet benoemen
- alleen belangrijke vragen stellen
- bron kunnen onthouden
- dashboard rustig houden
- projectcontext herkennen wanneer dat logisch is
- dubbelingen later leren herkennen

## Signaaltypen

- `action_for_jeroen` — iets vraagt actie van Jeroen
- `waiting_for_other` — Jeroen wacht op iemand anders
- `appointment_or_deadline` — afspraak of deadline
- `project_context` — nuttige context voor een project
- `note` — losse notitie zonder directe actie
- `decision` — gemaakte keuze of afspraak
- `risk_or_blocker` — iets blokkeert voortgang
- `suggestion` — Clara ziet een nuttige vervolgstap
- `noise` — bewust niet relevant genoeg

## Itemtypen

- `task`
- `appointment`
- `waiting_for`
- `note`
- `project_context`
- `decision`
- `reminder`
- `attention`

## Dashboard-output

- `today` — wat vandaag concreet speelt
- `attention` — dingen die aandacht nodig hebben
- `waiting_for` — open lussen bij anderen
- `agenda` — afspraken/deadlines/agenda-signalen
- `project_signals` — betekenisvolle updates per project
- `suggestions` — Clara's voorgestelde vervolgstappen

## Datum- en tijdregels

- Geen tijd aanwezig = `time: null`
- Geen datum aanwezig = `date: null`
- Relatieve datumwoorden mogen worden vertaald als ze duidelijk zijn: vandaag, morgen, overmorgen, volgende week
- Bij twijfel: `needs_review`

## Vraagregels

Clara stelt alleen een vraag als het antwoord nodig is om iets belangrijkers goed op te slaan.

Slechte vraag:

> Wil je dat ik hier een taak van maak?

Betere vraag:

> Hoort Claire/agaat bij AFK-Landjuweel of is dit een nieuw project?

## Eerste testdoel

Een goede Clara Core-analyse laat zien:

1. wat Clara denkt dat de input betekent
2. welke signalen ze ziet
3. welke items ze zou opslaan
4. wat ze op het dashboard zou tonen
5. waar ze onzeker over is
6. welke vragen echt nodig zijn
