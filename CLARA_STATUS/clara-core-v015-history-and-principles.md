# Clara Core v0.15 — History, Goals and Principles

_Last updated: 2026-05-06_

This document preserves the relevant history behind Clara, Clara Core and the v0.15 clean-start direction.

It exists so the new Clara Core does not lose the original purpose while old Core Lab code and old architectural layers are cleaned up.

Companion document:

```text
CLARA_STATUS/clara-core-v015-breakthrough.md
```

That file captures the new breakthrough: Clara as reasoning layer, Clara Core as interface, Clara State as shared operational memory.

This file captures how we got here and what must remain true.

---

## 1. The original Clara need

Clara exists because Jeroen does not work from neat task forms.

Important information appears in:

- messy ChatGPT conversations;
- loose thoughts;
- WhatsApp-like notes;
- project brainstorms;
- half-decisions;
- workshop ideas;
- financial/admin worries;
- creative project fragments;
- practical reminders;
- doubts and changing priorities;
- conversations with Marlon or collaborators;
- deadlines that are sometimes clear and sometimes vague.

Traditional productivity systems ask the user to already know what something is:

```text
task / appointment / note / project / deadline / reminder
```

That does not fit Jeroen’s workflow well enough.

The original Clara idea was:

```text
Jeroen talks normally.
Clara understands what kind of thing it is.
Clara helps structure it.
Clara remembers what matters.
Clara turns it into planning, questions, decisions or project context when appropriate.
```

Clara should reduce the burden of structuring, not add extra administration.

---

## 2. Clara is not a task list

A normal task list waits for exact input.

Clara should actively interpret.

Wrong direction:

```text
Jeroen must manually decide: this is a task, this is a note, this is a project.
```

Right direction:

```text
Jeroen says what is going on.
Clara separates action, uncertainty, planning, context, decision and waiting-for.
Clara proposes structure.
Jeroen confirms or corrects.
```

Clara must behave like a practical assistant, not like a database form.

---

## 3. Early Clara 3 lessons

Earlier Clara versions focused on:

- intake;
- review;
- tasks;
- appointments;
- waiting-for items;
- notes;
- Supabase storage;
- RLS/security;
- dashboard views;
- inline editing;
- AI parsing;
- confirmation drawers;
- project recognition.

Important lessons:

### 3.1 Dates and times are dangerous

Clara must not invent times.

Old bugs such as default times appearing without being said were harmful.

Rule:

```text
No explicit time = no fake exact time.
```

### 3.2 Hard appointments are different from tasks

A hard appointment needs explicit date/time/context.

A proposed work block is pencil.

Rule:

```text
Hard appointment = explicit.
Pencil block = proposal.
```

### 3.3 Review and editability matter

Jeroen must be able to correct Clara.

Manual edits are truth.

Rule:

```text
If Jeroen edits something, Clara must respect it next time.
```

### 3.4 Duplicate saves and hanging saves break trust

Clara must show clear save feedback and avoid double entries.

### 3.5 UI must stay calm

Too many buttons, drawers, chips and panels make Clara feel like extra work.

---

## 4. Why Clara Core Lab existed

Clara Core Lab was created to test Clara’s behavior before rebuilding the main Clara app.

The Lab was not meant as the final product.

Its job was to answer:

```text
How should Clara think?
How should Clara plan?
How should Clara use project context?
How should Clara handle uncertainty?
How should Clara show tentative plans?
How should Clara help Jeroen choose what to do next?
```

Core Lab tested:

- AI-first intake;
- project recognition;
- Projectbrain context;
- agenda proposals;
- pencil blocks;
- conflict detection;
- attention items;
- day regie;
- open items;
- projectplans;
- planning over the week;
- startup suggestions;
- local browser state.

The Lab produced useful lessons, but became too heavy as an active architecture.

---

## 5. Projectbrain lessons

Projectbrain was introduced as a way to capture ChatGPT project context in markdown files.

It helped because:

- project context survived outside one chat;
- Clara could read stable project background;
- GitHub became a source of truth;
- BIU/ACE created a bridge from ChatGPT to project files.

But Projectbrain also exposed limits:

```text
Markdown summaries are useful as context.
They are not reliable enough as live operational state.
```

Projectbrain should not be the primary source for today’s planning or live agenda.

New rule:

```text
Projectbrain = archive/context.
Clara State = current operational truth.
```

Projectbrain may return later, but not as the main agenda/state engine.

---

## 6. Core Lab v0.14 lessons

The v0.14 line taught important things.

### 6.1 Projectplans were a good idea

The Projectplan Overlay showed that raw context should not jump straight into agenda.

There needs to be a bridge:

```text
context → project/workspace → steps/tasks → planning preview → agenda
```

This idea remains important.

### 6.2 Planning preview is needed

Clara should not immediately mutate the agenda from vague input.

Better:

```text
Clara proposes planning.
Jeroen accepts or edits.
Only then does it become agenda/state.
```

### 6.3 Open items became too messy

Open items were useful in principle, but started catching too much:

- uncertainty;
- failed planning;
- fallback messages;
- projectplan choices;
- half-debug text;
- temporary questions.

Rule:

```text
Open questions are valid.
Open items must not become a garbage bin.
```

In the new Clara State model, uncertainty should mostly live in `questions`, not as vague open-item sludge.

### 6.4 Rule piles and microguards are a smell

The old app gained many guards:

- anti-leak filters;
- fallback filters;
- old-state cleanup;
- verb lists;
- project-specific exceptions;
- hidden legacy filters.

Some safety rules are necessary, but too many local patches make Clara feel dumb and brittle.

Rule:

```text
Use AI-first interpretation plus clear state boundaries.
Do not solve everything with word-policing.
```

### 6.5 LaLampe / AFK leakage was a real warning

AI context can leak between projects.

A LaLampe workshop plan must not suddenly become AFK light-creature content.

Rule:

```text
Explicit project context and user intent outrank broad background context.
```

### 6.6 Startup planning was promising but risky

Having Clara prepare a concept day from context was useful.

But automatic startup planning can easily invent urgency or fill the day with old context.

Rule:

```text
Automatic suggestions must stay pencil and must not pretend to be current truth.
```

---

## 7. The deeper goal of the whole Clara saga

The goal is not just a better to-do app.

The deeper goal is:

```text
A practical thinking and planning companion that helps Jeroen keep creative, commercial and personal projects moving without forcing him into rigid admin.
```

Clara should help with:

- remembering what matters;
- seeing what is active;
- distinguishing real commitments from ideas;
- turning messy thoughts into usable structure;
- asking the right next question;
- planning honestly;
- warning when the week is too full;
- protecting focus;
- keeping projects alive without overloading Jeroen;
- showing what is waiting, uncertain or decided;
- making the next step easier.

Clara should be allowed to say:

```text
This is too much for this week.
```

or:

```text
This sounds important, but it is not yet concrete enough to plan.
I will keep it as a question/workspace instead.
```

or:

```text
You are trying to fit three big projects into one afternoon. Choose one.
```

This ability to mirror and limit is as important as planning itself.

---

## 8. Key user preferences that must survive

Jeroen’s working preferences:

- short, practical answers;
- no unnecessary explanation during coding flows;
- visible versioning when code changes happen;
- no automatic commit/push unless explicitly part of the phase;
- GitHub as source of truth;
- ChatGPT/Clara as reasoning layer;
- Cursor/Codex as implementation layer;
- local zip/backups are acceptable during major resets;
- UI should be calm, dark and not cluttered;
- Clara should not ask too many follow-up questions if she can make a reasonable pencil proposal;
- but Clara must ask when pretending would create false certainty.

Planning preferences:

- ordinary work mostly Monday-Friday;
- Monday starts later;
- avoid weekends unless explicit deadline or request;
- do not plan in the past;
- do not overfill days;
- do not shorten tasks unrealistically;
- keep enough buffer;
- treat hard appointments differently from pencil work blocks.

---

## 9. Important project contexts as examples

Clara must understand that Jeroen’s projects are different kinds of work.

### Clara / Clara Core

Technical and conceptual project around building the assistant itself.

Typical work:

- architecture;
- interface/state decisions;
- Cursor/Codex implementation;
- testing;
- GitHub/Vercel workflow;
- state and planning logic.

### LaLampe

Commercial/workshop project around lamp-making workshops.

Important direction:

- evening workshops;
- hands-on making;
- one evening, working lamp;
- small groups;
- practical transformation: “I can make this myself”;
- broader direction around self-efficacy and maker confidence;
- not too glossy or over-marketed.

LaLampe may become one part of a wider commercial direction around autonomy, practical imagination and maker confidence.

### Begeister

Creative/business umbrella and collaboration context.

Important themes:

- roles;
- boundaries;
- Marlon;
- financial clarity;
- what belongs to LaLampe vs Begeister vs autonomous work.

### AFK / Landjuweel / Amarte

Creative grant/installation trajectory around night creatures/light entities.

Important distinction:

- this version is ecological/organismic;
- not the broader critical/socio-political version;
- do not leak this content into LaLampe.

---

## 10. What Clara must distinguish

Clara State must distinguish at least:

```text
agenda = planned execution
questions = uncertainty / missing information
workspaces = active project or topic lines
decisions = things that have been decided
notes = context worth keeping
inbox = unplaced input
```

Future additions may include:

```text
deadlines
waiting_for
capacity
projects
admin/money
contacts
sources
```

Do not collapse everything into tasks.

Do not collapse everything into agenda.

---

## 11. State and certainty rules

### Hard truth

Only store something as hard if it was explicitly said or confirmed.

Examples:

```text
confirmed appointment
explicit deadline
manual edit
clear decision
```

### Pencil

Use pencil for proposals.

Examples:

```text
suggested work block
possible planning
draft task
inferred next step
```

### Question

Use question when important information is missing.

Examples:

```text
Is LaLampe this week about offer clarity or participant acquisition?
Is AFK active or sleeping?
Is there a real deadline?
Does Marlon need to be involved?
```

### Workspace

Use workspace for active but not fully planned work.

Example:

```text
LaLampe — clarify broader workshop/commercial direction
```

---

## 12. Why v0.15 should start clean

The old app is valuable as research but not as foundation.

The clean v0.15 direction is needed because otherwise Clara stays trapped in:

```text
old state pollution
fallback routes
Projectbrain overuse
UI patches
rule piles
unclear difference between draft and truth
```

A clean start should keep the lessons, not the clutter.

Core principle:

```text
Do not refactor the mess into a cleaner mess.
Start from the right model.
```

---

## 13. v0.15 first product shape

The first new Clara Core does not need to be smart.

It must be honest and structurally correct.

v0.15.0 target:

```text
A calm read-only Clara State viewer.
```

It should show:

- agenda;
- questions;
- workspaces;
- decisions;
- notes;
- inbox.

It should not yet:

- call AI;
- generate plans;
- use Projectbrain as live state;
- recreate old open items;
- recreate the old projectplan overlay;
- pretend to understand what it does not yet understand.

Once that foundation is clean, intelligence can be added carefully.

---

## 14. Long-term direction

Long-term Clara should become:

```text
Clara in ChatGPT = reasoning, planning, intake, reflection
Clara State = shared operational source
Clara Core = visual cockpit and editor
Calendar/email/other integrations = optional sources and outputs
Supabase or another DB = possible durable operational backend later
GitHub = source of truth during build and possibly state storage during early phase
```

The architecture should allow:

- Jeroen to talk naturally;
- Clara to write structured state;
- Clara Core to display state;
- Jeroen to edit/confirm;
- Clara to notice overload;
- future integrations without changing the core idea.

---

## 15. Final principle

The whole Clara saga is about one thing:

```text
Turning Jeroen’s messy, living project reality into calm, usable, honest structure — without forcing him to become the admin system himself.
```

Clara should not just remember more.

Clara should help decide what matters now, what can wait, what is uncertain, what is planned, and when the week is already full.
