# Clara Core v0.15 — Shared State Breakthrough

_Last updated: 2026-05-06_

This document preserves the design breakthrough for the next Clara Core direction.

## Core realization

Clara is not a separate AI inside the app. Clara is the reasoning layer Jeroen is already talking to in ChatGPT.

Clara Core is the app, UI and workspace.

Clara State is the shared operational memory that both Clara and Clara Core can use.

The new pattern is:

```text
Jeroen talks to Clara in ChatGPT
→ Clara understands, plans, asks and decides
→ Clara writes structured Clara State
→ Clara Core reads and displays Clara State
→ Jeroen reviews, edits and uses it
```

This replaces the older pattern where ChatGPT produced summaries, Projectbrain held markdown context, and Clara Core tried to reconstruct meaning from that context.

## Naming

```text
Clara = ChatGPT reasoning layer / conversation partner
Clara Core = app / UI / workspace
Clara State = shared operational memory
Projectbrain = possible archive/context layer, not primary current state
```

“Core Lab” was the experiment. The cleaner product direction is “Clara Core”.

## Clara Core is more than an agenda

Clara Core should not become just a calendar app.

It should become a cockpit for:

```text
- agenda / planning
- questions
- workspaces / active project lines
- decisions
- notes / context
- inbox / unplaced input
- later: deadlines, waiting-for, admin, capacity and week pressure
```

The agenda answers: when do I do what?

Clara Core as a whole answers:

```text
What is going on?
What is active?
What is uncertain?
What is waiting?
What have we decided?
What is planned?
What does not fit?
Why is this week full?
```

## Clara State

Initial proposed shape:

```json
{
  "schema_version": "0.1",
  "app_version": "0.15.0",
  "updated_at": null,
  "agenda": [],
  "questions": [],
  "workspaces": [],
  "decisions": [],
  "notes": [],
  "inbox": []
}
```

Possible future additions:

```text
deadlines
waiting_for
projects
contacts
money/admin
week_capacity
sources
```

## Week pressure / capacity

A key Clara feature is not only making a planning, but also warning Jeroen when the week is already too full.

Example behavior:

```text
Deze week zit al bijna vol.
Clara Core reset en LaLampe passen nog net.
AFK en Begeister zet ik liever als aandacht/open vraag, tenzij er een echte deadline is.
```

Clara should be able to explain why the week is full:

```text
Available work capacity: ±18h
Already planned: ±14h
Remaining: ±4h

Main load:
- Clara Core reset: ±8h
- LaLampe workshop/commercial direction: ±4h
- Admin / loose obligations: ±2h
- Buffer / spillover: ±2h
```

This can appear in Clara Core and, when useful, in a ChatGPT canvas/sidecar generated from Clara State.

## ChatGPT canvas / sidecar

ChatGPT’s canvas/sidecar can be used as a temporary Clara view next to the conversation.

Useful flow:

```text
Jeroen: Clara, waarom zit mijn week vol?
Clara reads Clara State
Clara opens or updates a canvas sidecar
The sidecar shows week pressure, agenda, workspaces, questions and decisions
```

The canvas is not a live permanent GitHub iframe. It is a useful view generated or updated by Clara based on available state.

## User workflow

The intended workflow for Jeroen:

```text
1. Talk to Clara naturally in ChatGPT.
2. If something should persist, say: “zet dit in Core”, “update Core”, or “schrijf naar Clara State”.
3. Clara converts the conversation into structured Clara State.
4. Clara Core displays the current state.
5. Jeroen uses Clara Core to see planning, questions, workspaces, decisions and notes.
```

Short triggers:

```text
Core / zet in Core / update Core = prepare or write Clara State
CB / CHAT BACKUP = full chat transfer for continuing in a new ChatGPT chat
BIU / Back it up = older Projectbrain/ACE-style extraction, legacy unless explicitly requested
```

## Global Custom Instructions direction

Because Jeroen may eventually remove the current ChatGPT project, the Clara/Core meaning should live in global Custom Instructions.

Suggested summary:

```text
If I say “Clara”, I usually mean you as the reasoning layer/conversation partner.
Clara Core is the app/UI/workspace.
Clara State is the shared operational memory behind Clara Core.

If something is relevant for my planning, projects, decisions, questions, workspaces, deadlines or daily regie, treat it as possible Clara State input.
Do not automatically write or change state unless I explicitly ask with words like “zet in Core”, “update Core”, “schrijf naar Clara State”, “Core-update”.

Uncertainty becomes a question.
Proposals are pencil.
Do not invent hard appointments, deadlines or status.
Do not turn vague input directly into agenda items.
```

## v0.15 implementation direction

First implementation target:

```text
v0.15.0 = Clean Shared State read-only viewer
```

Minimal structure:

```text
CLARA_STATUS/
  core-truth.md
  clara-core-v015-breakthrough.md

CLARA_STATE/
  core.json

clara-core/
  index.html
  style.css
  app.js
```

v0.15.0 should:

- show a calm dark Clara Core UI;
- read `CLARA_STATE/core.json`;
- show agenda, questions, workspaces, decisions, notes and inbox;
- show clear empty states;
- have no AI call;
- have no Projectbrain dependency as primary state;
- have no old Core Lab state routes;
- not pretend to be the whole Clara intelligence.

Later phases:

```text
v0.15.1 = local review/edit/accept/close actions in Clara Core
v0.15.2 = write edits back to Clara State
v0.15.3 = Clara can write Clara State from ChatGPT conversations
v0.15.4 = two-week planning from conversation into Clara State
v0.15.5 = week pressure/capacity sidebar in Clara Core and/or ChatGPT canvas
```

Calendar note:

Clara Core does not need to build a calendar grid from scratch. A library such as Schedule-X may be useful later for the visual calendar/timeline, but the calendar library must not define the product.

## Key principles

```text
Clara thinks.
Clara State remembers.
Clara Core shows and lets Jeroen act.
```

```text
Agenda is planned execution.
Questions are uncertainty.
Workspaces are active project lines.
Decisions are things that have been decided.
Notes are useful context.
Inbox is unplaced input.
```

```text
Do not invent certainty.
Do not overfill the week.
Do not turn vague thoughts into fake tasks.
Do not make Clara Core another AI pretending to be ChatGPT.
Do make Clara Core a clean cockpit for shared state.
```
