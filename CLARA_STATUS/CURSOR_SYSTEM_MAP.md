# Clara system map

## Current architecture

Clara is currently a hybrid system:

- AI-assisted interpretation in `api/chat.js`
- deterministic backend validation and normalization
- Supabase as system of record
- frontend dashboard in `index.html`
- read model in `api/dashboard.js`

## Frontend

`index.html` is a single-page dashboard with:

- agenda
- taken
- afspraken
- chat
- notities
- review flow

Frontend calls:

- `GET /api/dashboard`
- `POST /api/chat`

It supports:

- review flow
- confirm_review
- inline editing
- delete confirmation
- session_id in localStorage

## Backend

### `api/chat.js`

Handles:

- free text input
- AI parsing / interpretation
- review mode
- confirm_review
- update_item
- delete_item

This file is currently hybrid:

- AI generates structure
- backend applies hard validation and normalization

### `api/dashboard.js`

Read-only endpoint for dashboard data.

Reads from Supabase and returns grouped frontend data.

## Database

Supabase is the source of truth.

Known migration now exists in repo:

- `supabase/migrations/20260418143414_remote_schema.sql`

Important:

- database structure is no longer only “implied by JS”
- migrations must now be treated as part of the source of truth too

## Current product direction

Clara 2.0 should evolve toward:

- projects as central structure
- inbox as intake layer
- communication handling
- AI as operator
- review before write actions

## Safe development rule

Do not remove stable logic unless explicitly confirmed.
Prefer improving existing working flows over rewriting blindly.