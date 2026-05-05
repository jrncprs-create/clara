# Clara Core Lab Truth

_Last updated: 2026-05-05_

This document is the current design truth for Clara Core Lab. It captures what we learned in the v0.14 projectplanning line and defines the direction for v0.15. Future ChatGPT/Cursor/Codex work on Clara Core Lab should read this before proposing or implementing changes.

## 1. Status at the time of this truth

Production URL:

```text
https://clara-4-core-lab.vercel.app
```

Current live version at the moment this truth was written:

```text
v0.14.42
```

Latest known commit:

```text
d05486e — fix(core-lab): move project plan choice to overlay
```

Correct local structure:

```text
~/Projects/clara-core-lab-work/
├─ api/
├─ CLARA_STATUS/
├─ clara-3/
├─ clara-4-core-lab/
├─ docs/
├─ projectbrain/
├─ supabase/
├─ UX/
├─ README.md
├─ package.json
└─ ...
```

Important paths:

```text
Repo root / work root:
~/Projects/clara-core-lab-work

Core Lab app:
~/Projects/clara-core-lab-work/clara-4-core-lab

Projectbrain:
~/Projects/clara-core-lab-work/projectbrain

Root API:
~/Projects/clara-core-lab-work/api
```

Do not use:

```text
~/Projects/clara-core-lab-work/clara
```

That extra `/clara` folder does not exist in the local setup.

## 2. Roles and workflow

ChatGPT:
- architecture;
- reasoning;
- product/design decisions;
- prompts for Cursor/Codex;
- critical assessment of whether we are on the right path.

Cursor/Codex:
- local code changes;
- targeted implementation;
- running checks/tests/build/deploy verification where possible;
- committing/pushing/deploying only when a prompt explicitly asks for it and checks pass.

GitHub:
- source of truth for code;
- now also source of truth for this Clara Core Lab design document.

Vercel:
- production deploy for Clara Core Lab.

Projectbrain:
- project/context memory;
- not the same as this truth document.

Important instruction for future prompts:

```text
Voer benodigde checks/tests/fetches/build/deploy-verificatie zelf uit waar mogelijk.
Stop niet om Jeroen te vragen op “Run” of “Fetch” te klikken.
Alleen als een handmatige UI-actie echt onvermijdelijk is: kort melden wat Jeroen moet doen en waarom.
```

## 3. Difference between truth, Projectbrain, ACE, BIU and CB

This file:

```text
CLARA_STATUS/core-lab-truth.md
```

is the design truth / product truth for Clara Core Lab. It describes how Clara should think, what the interface model is, what state means, and what v0.15 should become.

Projectbrain:
- stores project context, recent movement, decisions, open threads and project background;
- helps Clara understand projects;
- must not become the sole design constitution for the app.

ACE:
- automatic/semi-automatic export from ChatGPT/project conversations toward Projectbrain `.md` files.

BIU / Back it up:
- project extract toward ACE/Projectbrain workflow.

CB / CHAT BACKUP:
- full ChatGPT-project chat transfer for continuing in a new ChatGPT chat;
- not GitHub;
- not ACE;
- not BIU.

PB:
- older Projectbrain route, now more legacy/older method.

## 4. What Clara Core Lab is trying to become

Clara Core Lab is not just a task app or dashboard. It is a behavioral prototype for an AI-first personal project assistant.

The long-term goal:

```text
ChatGPT / conversation
→ Projectbrain context
→ Clara understands what matters
→ Clara opens or updates a focused workspace
→ Jeroen and Clara clarify the work
→ Clara proposes a taskset or projectplan
→ Jeroen accepts or edits
→ Clara makes a planning preview
→ Jeroen accepts
→ agenda gets clean pencil blocks
→ later: persistent operational data, likely Supabase
```

Core principle:

```text
Projectbrain = context
Workspace = active understanding / working surface
Taskset or projectplan = clarified work
Planning preview = temporary schedule proposal
Agenda = accepted/planned execution
Supabase = later, after behavior is right
```

The goal is a Clara that helps Jeroen think, choose and plan, not a Clara that instantly dumps every chat fragment into tasks.

## 5. How we got here

The v0.14 line taught us a lot.

### v0.14.35 — Projectplan Overlay

Added frontend `labState.project_plans[]`, stored in localStorage. Built a Projectplan Overlay/modal with editable project, status, title, deadline, goal, context, steps and tasks. Added `Plan deze week` to create pencil agenda blocks from projectplan steps.

Good:
- projectplan as bridge between context and agenda is useful;
- overlay as review/edit surface is useful;
- `Plan deze week` is conceptually useful.

Not good:
- first UI was messy;
- too many fields visible at once;
- it was still mostly local skeleton logic.

### v0.14.36 — Overlay UI cleanup

Made steps compact, collapsed, summarized. Removed raw step-id fields. Dependencies became readable dropdowns.

Good:
- overlay became much more usable;
- projectplan UI direction became plausible.

### v0.14.37 — Projectplan to smart pencil planning

Projectplans could be planned into pencil agenda blocks. Added project-specific skeletons and dependency handling.

Good:
- projectplan-to-agenda was useful;
- dependencies and pencil status are the right conceptual layer.

Not good:
- logic began moving toward hard-coded skeletons and local rule trees.

### v0.14.38 — AI projectplan generator

`/api/analyze` gained `project_plan_suggestion`. Frontend detects projectplan intent, asks AI, converts suggestion into `labState.project_plans[]`, opens overlay.

Good:
- architecture proved that AI-generated projectplans can work;
- AI can use Projectbrain and Lab State as context;
- projectplan generation should stay.

Not good:
- LaLampe sometimes got AFK/lampwezen content;
- ordinary planning produced generic placeholders;
- too much broad context caused project leakage;
- localStorage pollution became visible.

### v0.14.39 — Projectplan isolation and regressions

Added `lastOpenedProjectPlanId`, tried to isolate projectplans, added LaLampe validation/fallback and filters for generic placeholders.

Good:
- explicit project should override last opened project;
- project leakage is real and must be handled.

Not good:
- we started adding more guards instead of simplifying the model.

### v0.14.40 — State cleanup + replan dedupe + context guard

Main purpose: reduce polluted local state, avoid duplicate re-planning and guard context better.

Good:
- state pollution was correctly identified as a core problem.

Not good:
- still patching symptoms.

### v0.14.41 / v0.14.41.1

Hardened weekplanning intent and fallback discipline. Added smoke tests for weekplanning and project recognition. Blocked `Ik liep vast...` for short known planning intents by safe routes.

Good:
- tests started catching real user-facing failures;
- fallback text is recognized as harmful.

Not good:
- fallback/routing still felt like a rule pile.

### v0.14.41.2 — LaLampe anti-leak hardening

Added central guard helpers:
- `isForbiddenLaLampePlanText(text)`;
- `sanitizeOrReplaceLaLampeProjectPlan(plan)`;
- `sanitizeOrRejectLaLampeAgendaTitle(title)`.

Good:
- fixed a painful LaLampe/AFK leak;
- created `scripts/check-lalampe-anti-leak.mjs`.

Not good:
- this is exactly the kind of word-policing that can make Clara dumb if it becomes the main intelligence layer.

### v0.14.41.3 — Plan deze week choice prompt

If nothing could be planned, Clara showed choices: next workday, coming workweek, one day, leave open. Dedupe for saved prompt.

Good:
- `Past niet` should not be a dead end.

Not good:
- the question appeared in chat and polluted the main conversation;
- it also created `[Keuze]` open items;
- not the right UX location.

### v0.14.42 — Move choice to overlay and week-space fix

Removed chat/open-item choice flow. Choices moved into Projectplan Overlay. Fixed remaining workdays: Tuesday evening should mean Wednesday/Thursday/Friday. Expanded verb list to make titles like “Workshopdoel en doelgroep scherpzetten” planable.

Good:
- projectplanning choices belong in overlay/workspace, not in chat;
- week-space logic improved;
- agenda should not use chat as choice spam.

Not good:
- the app now feels over-regulated;
- expanding verb lists is not the right core intelligence;
- Clara feels less like AI and more like a decision tree;
- the UI showed agenda-item render problems.

## 6. Critical diagnosis

The current problem is not one bug.

The problem is that we let many UI and state routes become active at the same time:

```text
chat input
→ AI output
→ frontend fallback
→ projectplan overlay
→ open items
→ agenda suggestions
→ agenda
→ localStorage
→ next run treats old output as truth
```

This makes Clara feel like a child with a water head: too many rules, too many panels, too many half-truths, not enough simple intelligence.

The wrong pattern:

```text
raw chat
→ automatically create tasks/open items/agenda suggestions
→ fix mistakes with more guards
→ store too much state
→ next run gets polluted
```

The right pattern:

```text
raw chat
→ understand
→ show a focused workspace
→ clarify what is still unclear
→ propose a taskset/projectplan
→ accept/edit
→ planning preview
→ accept
→ clean agenda
```

## 7. Main v0.15 design decision

The new direction is:

```text
One chat input.
One active workspace.
Visible AI work.
No second chat window.
No automatic task dumping.
Clarify first, then propose, then plan.
```

There must be only one place where Jeroen types: the main chat input, preferably bottom-right as in the current app direction.

There must not be a second chat box inside the overlay. That would be confusing.

Clara may answer and fill things elsewhere, especially in a right-side sliding workspace, but Jeroen always replies in the single main chat.

## 8. Interface model for v0.15

The interface should move toward this model:

```text
Main chat = one place to talk to Clara
Active Workspace = visible working surface for the current subject/project
Agenda = only planned execution
Attention/Open Items = only genuinely open items, not Clara’s normal uncertainty
```

### Main chat

The main chat is the only input. It handles:
- starting work;
- general conversation;
- short confirmations;
- day-regie;
- routing to a workspace.

It should not be filled with:
- long projectplan choice flows;
- duplicate prompts;
- debug/fallback text;
- open-item management spam;
- giant generated task lists if those belong in the workspace.

### Active Workspace

The right-side workspace is not a second chat. It is a visible work surface.

It should show, linearly and visibly, what Clara is doing and what is becoming certain.

Possible UI structure:

```text
Werkspoor: LaLampe workshopflow
Status: aan het verduidelijken

Clara vult aan:
✓ Project herkend: LaLampe
✓ Type: werkspoor/projectplan
✓ Focus: workshopflow
○ Nog te bepalen: inhoud eerst of marketing?

Zeker:
- Project: LaLampe
- Focus: workshopinhoud
- Niet meenemen: marketing, tenzij later gekozen

Nog onzeker:
- Eerst avondopbouw of materiaalbasis?
- Moet er een testdatum komen?

Voorstel taakset:
1. Workshopdoel en doelgroep scherpzetten
2. Materiaalbasis bepalen
3. Avondflow uitschrijven

Acties:
[Bewaar taakset]
[Maak projectplan]
[Plan eerste stap]
[Plan deze week]
```

Jeroen still answers in the main chat. Clara updates the active workspace visually.

### Agenda

The agenda only shows actual planned execution.

Agenda item render must always be:

```text
Title
PROJECT · 10:00–11:00 · ✓ ×
```

Example:

```text
Workshopdoel en doelgroep scherpzetten
LALAMPE · 10:00–11:00 · ✓ ×
```

Rules:
- project name appears once;
- title never includes a project prefix like `LALAMPE —`;
- project name belongs in metadata;
- time and accept/delete controls sit on the compact metadata row;
- title + metadata must not visually overlap other agenda items;
- long titles use clean wrapping or ellipsis inside the item;
- drag/resize handles must keep working.

### Attention / Open Items

Open Items must not be Clara’s garbage bin.

They are only for genuinely open matters Jeroen explicitly keeps open, or for meaningful unresolved decisions that should persist.

Do not use Open Items for:
- normal projectplanning choices;
- temporary planning uncertainty;
- `Past niet` as default dump;
- chat fallback states;
- debug/internal messages.

## 9. State truth

The most important v0.15 state rule:

```text
Not everything Clara thinks may become state.
```

Clara needs clear state layers:

### Context

Source:
- Projectbrain projects;
- Projectbrain raw;
- chat/project memory;
- stable user/project facts.

Context explains what things mean. It does not plan itself.

### Workspace draft

Temporary, active, editable/clarifiable.

Possible internal name:

```text
active_workspace
```

Contains:
- project;
- topic;
- intent;
- certainty fields;
- uncertainty fields;
- current best next question;
- draft taskset;
- draft projectplan;
- draft planning preview.

This is not permanent truth yet.

### Task draft / taskset

A task draft is Clara’s proposal.
A taskset becomes more durable only after Jeroen accepts or saves it.

### Projectplan

A projectplan is a clarified work plan. It can persist if saved/accepted.

### Planning preview

A proposed schedule. It is temporary until accepted.

### Agenda

Accepted/planned execution.

Agenda items can be pencil, but they must still be intentional agenda entries, not accidental fallback output.

### Open item

A genuinely open question/decision to keep around. Not a temporary planning choice.

## 10. What may persist

Only these should become durable state:

```text
1. A projectplan/taskset explicitly accepted or saved by Jeroen.
2. Agenda items explicitly created by a clear action such as “Plan deze week” or “Zet in agenda”.
3. Open items that Jeroen explicitly leaves open or that Clara clearly marks as meaningful unresolved decisions.
4. Manual edits by Jeroen.
```

Everything else should be temporary:

```text
ai_draft
workspace_preview
planning_preview
overlay_choice
fallback message
chat helper text
```

## 11. AI-first intake principle

The intake must be AI-driven. It must not become a fixed form.

Every project and every conversation has a different route. Clara should decide what is missing and ask the best next question.

Wrong:

```text
Question 1: goal?
Question 2: deadline?
Question 3: duration?
Question 4: dependencies?
```

Right:

```text
AI reads the situation
→ detects what is still too vague
→ asks exactly one useful next question
→ updates the workspace
→ proposes taskset/projectplan when concrete enough
```

Examples:

LaLampe:

```text
Jeroen: Ik moet iets met LaLampe marketing.
Clara: Gaat het nu om meer mensen naar de workshop krijgen, of om het aanbod eerst scherper maken?
```

AFK:

```text
Jeroen: Ik moet verder met die lichtwezens.
Clara: Wil je nu inhoudelijk de aanvraag scherper maken, of technisch bepalen wat de eerste testopstelling moet zijn?
```

Begeister:

```text
Jeroen: We moeten dat met Marlon eens goed trekken.
Clara: Gaat dit over taakverdeling, geld, planning, of grenzen tussen LaLampe en Begeister?
```

The AI loop:

```text
Capture
→ Clarify
→ Propose
→ Confirm
→ Plan
```

Possible internal phases:

```text
capturing
clarifying
taskset_draft
projectplan_draft
planning_preview
ready_to_apply
planned
```

## 12. What should be removed or parked from active logic

Do not keep piling rules into active projectplanning.

Park or neutralize:
- projectplanning chat-choice flow;
- Open Item `[Keuze]` for projectplanning;
- `Past niet` as default hard failure;
- `Ik liep vast...` for normal planning/projectplan requests;
- title verb-list as main planability intelligence;
- overly specific local word-policing as the core logic;
- automatic task creation from vague chat text;
- agenda creation from half-understood output;
- fallback messages stored as state;
- old test items treated as real current truth.

Some guards can remain as lightweight safety, but they must not become the main intelligence.

## 13. What should remain active

Keep minimal hard safety rules:

```text
- do not plan in the past;
- do not overlap agenda items;
- do not invent hard appointments;
- weekends only with explicit permission or real deadline necessity;
- manual edits are truth;
- Projectbrain is context, not automatic task source;
- project names and explicit user intent outrank inferred context;
- agenda item title has no project prefix;
- agenda render is compact and readable.
```

Keep useful v0.14 discoveries:

```text
- Projectplan Overlay / workspace concept is useful.
- AI-generated projectplans are useful.
- `Plan deze week` is useful.
- LaLampe/AFK leakage is a real risk.
- Tests for visible regressions are valuable.
- LocalStorage pollution is dangerous.
- Open Items should be treated carefully.
- Chat should not become the dumping ground for every subflow.
```

## 14. v0.15 goal

v0.15 should not be another patch on v0.14.42.

v0.15 should be a reset of the interaction/state model:

```text
v0.15 — Active Workspace / AI Intake Loop
```

Goal:

Clara should open or update an active workspace for project/task-related input, use AI to clarify what is missing, show visible progress as fields fill in, propose tasksets/projectplans, and only plan to agenda after an intentional action.

## 15. Proposed v0.15 implementation phases

### v0.15.0 — Truth + state discipline + agenda render

- Read this truth document first.
- Add/ensure a central active workspace model.
- Stop automatic persistence of drafts/fallbacks as tasks/open items/agenda.
- Fix agenda render to the permanent format:

```text
Title
PROJECT · 10:00–11:00 · ✓ ×
```

- Park old rule-bullshit in documentation rather than deleting blindly.
- Keep minimal safety rules only.

### v0.15.1 — Active Workspace UI

- One chat input only.
- Right-side workspace shows current workspoor.
- Workspace visibly fills certainty/uncertainty/taskset/projectplan/planning preview.
- No second chat box.
- Main chat remains concise.

### v0.15.2 — AI Intake Loop

- `/api/analyze` or a new focused route returns AI intake modes:

```text
clarify
update_workspace
propose_taskset
propose_projectplan
planning_preview
apply_to_agenda
```

- AI asks one best next question when input is not concrete enough.
- AI proposes taskset/projectplan only when concrete enough.
- Clara stops force-creating tasks from vague text.

### v0.15.3 — Planning preview before agenda

- `Plan deze week` creates planning preview first if needed.
- Jeroen can accept/edit/apply.
- Agenda gets only accepted pencil blocks.
- Open Items stay out of normal projectplanning.

## 16. Future ChatGPT/Cursor/Codex instruction

Any future Clara Core Lab chat or prompt should start from this source of truth.

Use this instruction:

```text
Lees eerst `CLARA_STATUS/core-lab-truth.md` en behandel dit als de actuele ontwerpwaarheid voor Clara Core Lab. Als bestaande code of eerdere prompts hiermee botsen, volg de truth tenzij Jeroen expliciet anders beslist. Maak geen extra regelbrij; kies voor AI-first, duidelijke state-lagen, één chatinput, active workspace, planningpreview vóór agenda, en compacte agenda-render.
```

For Cursor/Codex prompts also include:

```text
Werk vanuit repo-root `~/Projects/clara-core-lab-work`.
Core Lab staat in `clara-4-core-lab/`.
Lees `CLARA_STATUS/core-lab-truth.md` vóór je code wijzigt.
Voer benodigde checks/tests/fetches/build/deploy-verificatie zelf uit waar mogelijk.
Stop niet om Jeroen te vragen op “Run” of “Fetch” te klikken.
Alleen als een handmatige UI-actie echt onvermijdelijk is: kort melden wat Jeroen moet doen en waarom.
```

## 17. Current open questions

- Should the active workspace replace the current Projectplan Overlay fully, or first wrap it?
- Should `active_workspace` live in localStorage only for now?
- Which parts of `project_plans[]` should remain as saved truth?
- How much of v0.14 projectplanning code should be parked vs deleted?
- Should planning preview be a new state object separate from agenda?
- How do we keep AI flexible while still testing critical regressions?

## 18. Decision summary

The decision now is:

```text
Stop adding microguards.
Stop treating vague chat text as tasks.
Stop using Open Items as Clara’s uncertainty dump.
Stop using chat as subflow UI.
Move toward one chat input + visible active workspace.
Let AI drive the intake route.
Only accepted work becomes state.
Planning preview comes before agenda.
Agenda render is always compact and clean.
```

This is the basis for v0.15.
