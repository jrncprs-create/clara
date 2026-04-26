# CLARA 3.0 PLAN

## Kern

Clara 3.0 is geen zware app en geen eigen AI-machine.

Clara 3.0 is een gedeelde operating layer voor Jeroen, Marlon en later Joep.

Doel:

> Eén plek waar projecten, acties, besluiten, context en samenwerking logisch samenkomen.

---

## Strategische verschuiving

Oude Clara probeerde veel zelf op te lossen via parsing, JSON-logica, backendregels en reviewflows.

Nieuwe Clara gebruikt bestaande AI-kracht slimmer:

- ChatGPT/OpenAI = denklaag en contextlaag
- Codex = technische operator en code-agent
- GitHub = bron van waarheid voor code en documentatie
- Supabase = eenvoudige gedeelde data-opslag
- Vercel = hosting

Clara moet minder complex worden, niet complexer.

---

## Clara 3.0 is bedoeld voor

### Jeroen
- overzicht
- prioriteiten
- projectcontext
- technische acties
- creatieve en zakelijke richting

### Marlon
- projectstatus
- planning
- productiecontext
- klantlijn
- besluiten en open punten

### Joep
- contenttaken
- social workflow
- foto’s
- workshopupdates

---

## MVP definitie

De eerste versie van Clara 3.0 is een gedeelde projectcockpit.

Niet bouwen in MVP:

- mailintegratie
- agenda-integratie
- WhatsApp-integratie
- automatische posting
- uitgebreide AI-agentlogica
- complexe parser
- CRM
- Notion-kloon

Wel bouwen in MVP:

- users
- projects
- tasks
- decisions
- notes
- waiting_for
- timeline
- dashboard V1

---

## Core objects

### USERS
Personen die Clara gebruiken of onderdeel zijn van projecten.

Velden:

```text
id
name
role
email
visibility_level
created_at
updated_at
```

---

### PROJECTS
Centrale container voor alles.

Velden:

```text
id
name
status
owner_id
participants
summary
priority
next_step
blockers
last_update
created_at
updated_at
```

Statusopties:

```text
active
slow_burn
waiting
paused
done
archived
```

---

### TASKS
Concrete acties.

Velden:

```text
id
project_id
title
description
assigned_to
created_by
status
priority
due_date
created_at
updated_at
```

Statusopties:

```text
open
in_progress
waiting
done
cancelled
```

---

### DECISIONS
Vastgelegde keuzes die niet steeds opnieuw besproken hoeven te worden.

Velden:

```text
id
project_id
title
description
decided_by
decision_date
impact
created_at
updated_at
```

---

### NOTES
Losse context, observaties en projectinformatie.

Velden:

```text
id
project_id
author_id
content
tags
created_at
updated_at
```

---

### WAITING_FOR
Afhankelijkheden en blokkades.

Velden:

```text
id
project_id
waiting_on
reason
owner_id
priority
since
follow_up_date
status
created_at
updated_at
```

Statusopties:

```text
open
followed_up
resolved
cancelled
```

---

### TIMELINE
Projectgeschiedenis.

Velden:

```text
id
project_id
author_id
event_type
title
description
related_item_type
related_item_id
created_at
```

Event types:

```text
project_update
task_created
task_done
decision_added
note_added
waiting_added
status_changed
```

---

## Dashboard V1

Dashboard V1 moet eerst rauw en bruikbaar zijn.

Niet mooi maken voordat de logica klopt.

### Blok 1: Vandaag
Toont:

- taken met deadline vandaag
- overdue taken
- urgente waiting_for items
- projecten met hoge prioriteit

### Blok 2: Projecten
Toont per actief project:

- naam
- status
- eigenaar
- prioriteit
- laatste update
- volgende stap

### Blok 3: Waiting For
Toont:

- waar wachten we op?
- sinds wanneer?
- wie bewaakt het?
- wanneer opvolgen?

### Blok 4: Team Activity
Toont recente timeline events.

### Blok 5: Focus
Toont maximaal 3 prioriteiten.

Regel:

> Als alles prioriteit is, is niets prioriteit.

---

## Eerste bouwvolgorde

### Stap 1
Maak deze documentatie leidend.

### Stap 2
Inventariseer bestaande Clara-code en bepaal wat legacy is.

### Stap 3
Maak geen destructieve wijzigingen aan bestaande code.

### Stap 4
Bouw Dashboard V1 losjes naast de bestaande structuur.

### Stap 5
Pas daarna datamodel en Supabase-migraties aan.

### Stap 6
Pas daarna AI/contextlaag toe.

---

## Belangrijke ontwerpregels

1. Projecten zijn de kern.
2. Taken bestaan altijd binnen projectcontext.
3. Besluiten moeten makkelijk terug te vinden zijn.
4. Waiting For is een hoofdonderdeel, geen detail.
5. Clara moet samenwerking vereenvoudigen.
6. Geen nieuwe complexiteit toevoegen zonder duidelijke reden.
7. Codex mag geen stabiele werkende code verwijderen zonder expliciete bevestiging.
8. Legacy blijft behouden tot Clara 3.0 stabiel draait.

---

## Eerste Codex opdracht

Gebruik dit document als waarheid.

Maak eerst een analyse van de bestaande repo:

- welke files horen bij Clara 2.0?
- welke onderdelen zijn bruikbaar voor Clara 3.0?
- welke onderdelen moeten legacy blijven?
- wat is de veiligste route naar Dashboard V1?

Daarna pas code wijzigen.

Niet gokken.
Niet opruimen zonder bevestiging.
Niet werkende flows slopen.
