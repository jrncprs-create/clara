# Clara 3.0 — Data Model V1

Dit document vertaalt Clara 3.0 naar een echte structuur.

Niet technisch.

Maar wel concreet genoeg om later direct naar Supabase of een API-model te gaan.

---

# Hoogste Structuur

```text
SPACE
 └── PROJECT
      ├── TASK
      ├── DECISION
      ├── NOTE
      ├── WAITING_FOR
      └── TIMELINE
```

---

# 1. SPACE

Een organisatie of contextlaag.

Voorbeeld:

```text
Begeister
Persoonlijk
Kunstpraktijk
Klanten
```

## Fields

```text
id
name
type
summary
owners[]
participants[]
status
created_at
updated_at
```

## Example

```json
{
  "id": "space_001",
  "name": "Begeister",
  "type": "organization",
  "summary": "Gezamenlijke werkstructuur van Jeroen en Marlon",
  "owners": ["jeroen", "marlon"],
  "participants": ["jeroen", "marlon", "joep"],
  "status": "active"
}
```

---

# 2. PROJECT

Project leeft altijd binnen een Space.

## Fields

```text
id
space_id
name
summary
status
priority
owner_id
participant_ids[]
next_step
blockers
last_update
created_at
updated_at
```

## Example

```json
{
  "id": "project_001",
  "space_id": "space_001",
  "name": "LaLampe",
  "summary": "Lampworkshops en merkontwikkeling",
  "status": "active",
  "priority": "high",
  "owner_id": "jeroen",
  "participant_ids": ["marlon"],
  "next_step": "Meer workshopboekingen",
  "blockers": "Afhankelijk van zichtbaarheid",
  "last_update": "Instagram campagne gestart"
}
```

---

# 3. TASK

Concrete actie.

## Fields

```text
id
project_id
title
description
status
priority
assigned_to
due_date
created_by
created_at
updated_at
```

## Status

```text
open
in_progress
waiting
done
cancelled
```

---

# 4. DECISION

Belangrijke keuze.

## Fields

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

# 5. NOTE

Losse context.

## Fields

```text
id
project_id
author_id
content
tags[]
created_at
updated_at
```

---

# 6. WAITING_FOR

Wat blokkeert.

## Fields

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

## Status

```text
open
followed_up
resolved
cancelled
```

---

# 7. TIMELINE

Geschiedenis.

## Fields

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

## Event Types

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

# Dashboard V1 Mapping

## Vandaag

Gebaseerd op:

```text
TASKS
WAITING_FOR
PROJECT.priority
```

---

## Projecten

Gebaseerd op:

```text
PROJECTS
```

---

## Waiting For

Gebaseerd op:

```text
WAITING_FOR
```

---

## Team Activity

Gebaseerd op:

```text
TIMELINE
```

---

## Focus

Gebaseerd op:

```text
PROJECT.priority
TASK.priority
PROJECT.next_step
```

---

# Clara 3.0 Ontwerpregel

Alles moet terug te leiden zijn naar:

```text
SPACE → PROJECT → CONTEXT
```

Als iets nergens onder valt:

> Clara weet niet waar het hoort.

---

# Belangrijk

Nog geen Supabase-schema maken.

Eerst dit model valideren.

Daarna pas database.