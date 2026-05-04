# Changelog — Clara 4 Core Lab

## 0.14.28 — 2026-05-04

- Rechterkolom vereenvoudigd naar **Agenda suggesties / Open eindjes**.
- Prangende vragen en blockers staan rood bovenaan open eindjes; gewone open punten blijven neutraal.
- Rechterkolomchips handelen lokaal af en vervuilen de chat niet meer met dashboardacties.

## 0.14.27 — 2026-05-04

- Chat-analyse fallback gefixt: na mislukte, afgebroken of vastgelopen analyse plaatst Clara altijd een vriendelijk zichtbaar antwoord en blijft de input bruikbaar.

## 0.14.26 — 2026-05-04

- Startup fallback gefixt: bij afgebroken of mislukte startanalyse blijft Clara demo-waardig starten met een vriendelijke tekst en bruikbare rechterkolom.

## 0.14.25 — 2026-05-04

- Rechterkolom herwerkt naar **Clara vraagt / Route vooruit / Open eindjes** als actief regiepaneel.
- Lichte actiechips toegevoegd voor vragen, route-stappen en open eindjes zonder nieuwe command-engine.
- Demo-polish voor Marlon: de rechterkolom toont maximaal één vraag, een korte adviesroute en scanbare open punten.

## 0.14.24 — 2026-05-04

- Kleine BIU-wrapperfix: `biu-check.sh` en `biu-write.sh` initialiseren argumenten defensief onder `set -u`, zodat `--dry-run` en gewone check/write geen `unbound variable` geven.

## 0.14.23 — 2026-05-04

- BIU v2 lokale scripts robuuster gemaakt: `--dry-run` toont secties en project hints zonder API-call of secret.
- `biu-check.sh` en `biu-write.sh` lezen `ACE_ACTION_SECRET` via `/dev/tty` wanneer mogelijk, zodat multi-line input via stdin niet per ongeluk als secret wordt gelezen.

## 0.14.22 — 2026-05-04

- BIU v2 toegevoegd: `scripts/biu-run.mjs` splitst multi-project BIU-input in secties en roept ACE per sectie aan.
- `biu-check.sh` en `biu-write.sh` zijn nu wrappers rond de Node-helper; ACE blijft single-target, BIU v2 verzorgt multi-target orchestration.
- BIU-docs bijgewerkt met sectiekoppen, check-first/write-bewust en onderscheid `BIU` versus `B I U`.

## 0.14.21 — 2026-05-04

- Eerste BIU-laag toegevoegd bovenop ACE: `scripts/biu-check.sh` en `scripts/biu-write.sh` sturen `source:"biu"` naar de production ACE endpoint.
- `docs/biu.md` toegevoegd met onderscheid: ACE is het systeem, BIU / Back it up is de methode/trigger; `B I U` met spaties is alleen praten over de methode.
- BIU v1 documenteert dat ACE voorlopig single-target routeert: één extract schrijft naar één `target_file` per call.

## 0.14.20 — 2026-05-04

- ACE projectrouting prioriteit aangescherpt: expliciete projectnamen zoals LaLampe, Begeister en AFK/Landjuweel/Amarte wegen zwaarder dan systeemwoorden zoals `ACE` of `test`.
- Lokale routingtest toegevoegd voor ACE-aliasprioriteit.

## 0.14.19 — 2026-05-04

- ACE production write gefixt: `mode:"write"` appendt in Vercel via GitHub Contents API naar allowlisted Projectbrain-bestanden in plaats van naar lokaal filesystem (`/var/projectbrain`).

## 0.14.18 — 2026-05-04

- Productiehelpers toegevoegd voor ACE: `scripts/ace-prod-check.sh` en `scripts/ace-prod-write-test.sh` vragen stil om `ACE_ACTION_SECRET`, testen de Vercel endpoint en tonen geen secret.

## 0.14.17 — 2026-05-04

- `/api/ace` geschikt gemaakt voor ChatGPT Actions via `X-ACE-SECRET` auth; lokaal zonder secret blijft testen mogelijk met waarschuwing.
- `.env.example` en `docs/ace-action-openapi.yaml` toegevoegd voor Vercel/GPT Action-configuratie.

## 0.14.16 — 2026-05-04

- Lokaal dev-script laadt `.env.local` vóór `vercel dev`, zodat `OPENAI_API_KEY`, `OPENAI_MODEL_ANALYZE` en `OPENAI_MODEL_ACE` beschikbaar zijn voor serverless API-routes.

## 0.14.15 — 2026-05-03

- OpenAI-modelconfig gesplitst: `/api/analyze` gebruikt `OPENAI_MODEL_ANALYZE` met default `gpt-5.5`; `/api/ace` gebruikt `OPENAI_MODEL_ACE` met default `gpt-4.1-mini`; `OPENAI_MODEL` blijft fallback.

## 0.14.14 — 2026-05-03

- ACE v1 endpoint toegevoegd: `POST /api/ace` routeert ChatGPT-achtige input naar project raw, misc, inbox, category suggestions of ignore.
- ACE gebruikt veilige allowlists voor projecten en target-bestanden; `check` schrijft nooit, `write` appendt alleen naar vaste Projectbrain-paden.
- Heuristische fallback toegevoegd wanneer OpenAI-config ontbreekt of faalt, zodat lokale tests blijven draaien.

## 0.14.13 — 2026-05-03

- Terminologie naar **open items** in zichtbare chat/UI-copy; interne `open_threads` blijft bestaan.
- Aparte open-items-lijst rechts wordt niet meer gerenderd; open items worden primair via chat besproken.
- Harde backend planning guard toegevoegd: gewone werkblokken worden na AI-output verplaatst naar geldige werktijd, inclusief weekend/avond/verleden en vaste plus beweeglijke Nederlandse feestdagen.
- Korte antwoorden op open items blijven contextueel en kunnen een concrete potloodtaak binnen werktijd opleveren.

## 0.14.12 — 2026-05-03

- Niet-plannen intentie aangescherpt: bij "niet plannen", "geen agenda" of open-itemsvragen maakt Clara geen agenda-items, dagplan, checktijd of planningbevestiging.
- Startup/chattekst is nu conditioneel: "conceptdag klaargezet" verschijnt alleen bij echte agenda-items; open punten/items krijgen neutrale tekst.
- Open items worden visueel duidelijker los van gewone Aandacht getoond, met vraag/context en acties *laten hangen* / *sluiten*.
- Korte antwoorden op open items, zoals "marketing" of "technisch", worden nu als item-antwoord verwerkt en kunnen een concrete potloodtaak opleveren.
- Tijdbeleid toegevoegd: geen werkblokken in het verleden, zondag/laat op de avond doorschuiven naar de eerstvolgende werkdag, maandag niet vroeg starten en weekend alleen bij expliciete wens/deadline.

## 0.14.11 — 2026-05-03

- `open_threads` toegevoegd aan Clara Lab State en analyse-output: inhoudelijke open items blijven los van taken, afspraken en agenda-items.
- Open items worden gemerged met bestaande Lab State, dedupliceren op project/titel/context en verschijnen voorlopig compact onder Aandacht met label **Open item** en acties *laten hangen* / *sluiten*.

## 0.14.10 — 2026-05-03

- Startup-outputfilter aangescherpt: visible attention, dagregie, suggestions en reviewtekst blijven alleen staan als ze expliciet aan raw-actieve projecten hangen.
- Voorkomt dat stable-context signalen zoals Begeister-grens/projectgrenzen zichtbaar lekken wanneer alleen LaLampe betekenisvolle raw heeft.

## 0.14.9 — 2026-05-03

- Projectbrain-loader leest in lokale/dev-omgeving eerst lokale `projectbrain/projects/*.md` en `projectbrain/raw/*.md`, zodat lokale raw-wijzigingen direct zichtbaar zijn.
- GitHub Contents API blijft fallback wanneer lokale Projectbrain-bestanden niet beschikbaar zijn; raw-status blijft leidend voor startup.

## 0.14.8 — 2026-05-03

- Startup-planning wordt nu primair door betekenisvolle `projectbrain/raw/*.md` gestuurd; template-only, ontbrekende of lege raw-bestanden leveren geen startup-blokken op.
- Stable `projectbrain/projects/*.md` blijft achtergrondcontext, maar kan op startup niet meer zelfstandig Clara/AFK/Begeister/etc. agenda, attention of dagregie vullen.

## 0.14.7 — 2026-05-03

- Single-project planningconsistentie: als Clara een potloodblok claimt of de vraag om een logisch potloodblok vraagt, wordt er ook echt een `clara_agenda` pencil item voor het expliciete project gemaakt.
- Single-project output wordt na dagregie-normalisatie opnieuw gefilterd, inclusief summary en day_review-teksten, zodat AFK/Begeister/Clara Core Lab niet in LaLampe-antwoorden lekken.

## 0.14.6 — 2026-05-03

- Expliciete single-project vragen, zoals LaLampe, krijgen een sterke projectfocus: raw van dat project weegt zwaarder en output voor andere projecten wordt weggefilterd.
- Multi-project/startup fallback-planning wordt overgeslagen bij één expliciet genoemd project, zodat AFK/Begeister/Clara Core Lab niet in attention, dagregie of potloodsuggesties lekken.

## 0.14.5 — 2026-05-03

- MacBook-desktoplayout: laptop-breakpoint toegevoegd met drie leesbare zones, smallere agenda en gestapelde rechterkolom voor klok, Aandacht en Dagregie.
- Rechterpanelen krijgen meer effectieve breedte, rustiger tekstafbreking en compactere klok/gaps zonder AI-gedrag te wijzigen.

## 0.14.4 — 2026-05-03

- Projectbrain-context splitst nu stabiele `projectbrain/projects/*.md` en recente `projectbrain/raw/*.md` signalen; ontbrekende raw-bestanden blokkeren analyse niet.
- Promptregel toegevoegd: raw mag alleen aandacht, dagregie, onzekerheden en potloodsuggesties informeren, niet confirmed taken of harde afspraken zonder expliciete bevestiging.

## 0.14.3 — 2026-05-03

- Agenda-items **kaartlayout**: titel links (`agenda-item-title`), rechts meta **project (uppercase) · tijd · ✓ · ×** (`agenda-item-meta`); geen aparte projectregel meer; vink/sluit behouden.
- **Projectkleur** vult het hele blok; **conflict** behoudt projecttint + rustige **rode inset-outline**; **potlood/voorstel** via `rgba` (~0.18–0.20) zonder `opacity` op heel het item; **non-project** wit/neutraal zonder projectlabel; legenda alleen CLARA/LALAMPE/BEGEISTER/AFK, compacter + `pointer-events: none`.
- **planned_task** telt mee bij voorsteldetectie; AFK-match iets ruimer.

## 0.14.2 — 2026-05-03

- **Wis lokale teststaat:** zelfde scope; verwijdert nu ook losse **proposal-opties** in de chat (`#chatLog .options`); overige gedrag ongewijzigd (Lab `localStorage`/`sessionStorage`, `current_context`, lege `labState`, eindprompts, ⌥⇧R buiten invoervelden).
- **Projectkleuren:** `getProjectVisual` met `hasProject`, uitgebreidere match (o.a. *clara lab*, *core lab*, AFK-varianten); alleen bekende projecten krijgen gekleurde achtergrond.
- **Zonder project:** wit/neutraal, **geen** projectlabel in het blok, **geen** extra legenda-entry; voorstel blijft licht/subtiel op neutraal.
- **CSS-classes:** `agenda-item--pencil` / `--confirmed` / `--conflict` / `--suggest` / `--done`; subtiele hoekhint (*voorstel*, `!`, `✓`); conflict met zachte inset-outline; legenda alleen CLARA · LALAMPE · BEGEISTER · AFK, `pointer-events: none`.
- **Overlap/layout:** iets grotere verticale marge in `top`/`height`-%; events `min-height: 0`; `.events` `min-height: 100%` i.v.m. tijdlijn-hoogte.

## 0.14.1 — 2026-05-03

- **Teststaat:** rustige tekstknop *Wis lokale teststaat* in Dagregie (boven Lab State); wist alleen Clara Lab `localStorage`/`sessionStorage` keys (`clara_core_lab_state_v1`, startmarker, `clara_last_greeting_ix`, optioneel `clara_core_lab_current_context`), reset `labState`, agendaeindprompt, analyse-flow; status *Lokale teststaat gewist.*; sneltoets **⌥⇧R** (niet in invoerveld/contenteditable).
- **Agenda-items:** volle projectkleur als achtergrond; `project-none` = licht/wit + donkere tekst, label **GEEN PROJECT**; potlood/voorstel (`pencil`, `confirmation_required`, `source: projectbrain_startup`) als `.event-suggest` met lage opacity-kleur (~0.24–0.26); bevestigd voller; conflict blijft herkenbaar; meta: **PROJECT** in kapitalen, tijd `–` niet bold, titel max ~450; compacte meta-regel bij lage blokhoogte (`rawH<7%`).

## 0.14.0 — 2026-05-03

- **Agenda end prompts:** periodieke check (`setInterval` 60s + na elke `renderFromState`) of een gepland blok op **vandaag** net is afgelopen (venster: vanaf `end_time` tot 30 min daarna); rustige kaart boven Dagregie met *Blok afgelopen* en acties **Voltooid** (status `done` + `completed_at`), **15 min erbij** (einde verlengd, overlap opnieuw gecontroleerd, `_end_prompt_snoozed_until` tot nieuwe eindtijd), **Doorschuiven** (`needs_time`, tijden leeg, rollover + aandacht `[Doorschuiven] …`), **Later** (15 min snooze). Geen browser-alerts, geen AI-call; max. één actieve prompt; `external_busy` en afgeronde items worden overgeslagen.

## 0.13.9 — 2026-05-03

- Agenda: tab **Dag** → **Overdag**; subkop **Vandaag · Overdag** / Avond; tabs staan rechts naast de titel **Agenda** in de header.
- Dagbrede pill rustiger (kleiner, zachter); tijdlijn vult de agenda-card verticaal (`flex` / `grid-template-rows: auto 1fr`).
- Eventtitels niet meer vet (`font-weight` ~500); tijden compacter; subtiele projectaccenten via linker rand + klassen `project-clara` / `project-lalampe` / `project-begeister` / `project-afk`.
- Rechtsonder vaste kleine projectlegenda (Clara · LaLampe · Begeister · AFK).

## 0.13.8 — 2026-05-02

- **Eerste start:** bij lege Lab State (geen agenda/aandacht/taken/dagregie) en nog geen geslaagde auto-start in deze sessie (`sessionStorage`): automatisch één lichte `/api/analyze` met `source: projectbrain_startup` en vaste interne prompt (niet als gebruikersbericht); denkbolletjes + bestaande statusflow; daarna korte Clara-tekst in het eerste chatbericht en potloodagenda/Aandacht/Dagregie direct gevuld.
- **Geen hoofdstart met voorbeeldvragen:** startsuggestie-knoppen en offer-regel verwijderd; startscherm voelt aan als “al klaargezet”.
- **Dubbele start voorkomen:** na succes `sessionStorage` marker; bij volledig lege staat na handmatig wissen wordt de marker gewist (`touchState` + `clearStartupDoneIfEmpty`) zodat refresh opnieuw mag starten; Lab State wordt in `localStorage` bewaard zodat refresh met bestaande planning geen nieuwe auto-run triggert.
- **API:** `projectbrain_startup` — extra appendix (max 1 blok/project, 3–5 potlooditems, duurrichtlijnen, `source`/`projectbrain_startup`); `enforceStartupAgendaMetadata`; `ensurePencil`-fallback ook bij startup als agenda leeg blijft.

## 0.13.7 — 2026-05-02

- **Aandacht (API + UI):** generieke/meta-regels worden weggefilterd (o.a. overlap, geen dump, Projectbrain “in aandacht”, taken niet verkorten, UI-duur-reminders). Max. 5 items; `ensurePencil` voegt geen generieke checkregels meer toe. Bij te weinig concrete punten vult de frontend aan met heuristische projectchecks (mobiel/Marlon, Begeister-grens, AFK-ecologie, LaLampe materiaal). Agendatitels niet dubbel als aandacht.
- **Dagregie (API + UI):** JSON-schema `day_review.now_first_move` — eerste stap met stuurintentie; `sanitizeDayReview` ontdubbelt `items_to_check` t.o.v. agendatitels en scherpt zwakke `review_prompt` bij. UI: **Nu** gebruikt `now_first_move` als die niet enkel een agendatitel is; anders “Start met …; dat bepaalt …”. **Straks** filtert agendakopieën en vult korte checks. **Einde dag** met vaste scherpe fallback bij generieke potloodvraag.

## 0.13.6 — 2026-05-02

- Projectbrain: `clara-core-lab.md` toegevoegd aan de vaste projectlijst in `clara-4-core-lab/api/analyze.js`, root `api/analyze.js` en `api/projectbrain-status.js` (sync met GitHub/main).
- Eerste lege start: onder de variërende welkomstzin een korte toestemmingszin over planning vanuit Projectbrain + vier klikbare startsuggesties; klik vult het invoerveld (geen automatische analyse of agenda zonder jouw Enter/↑).

## 0.13.5 — 2026-05-02

- Tijdens analyse: status onder denkbolletjes loopt fase-gewijs (input → lab state → Projectbrain → … → resultaat), ±700–1200 ms per stap; na laatste stap subtiel wisselen tussen “Overlap controleren” en “Resultaat bijwerken” tot klaar. `stopThinkingStatusFlow()` beëindigt timers; bij fout kort “Analyse mislukt” / “Gestopt”.

## 0.13.4 — 2026-05-02

- Aandacht: items met label (Risico/Keuze/Check/Wacht/Past niet/Project), max. 5 zichtbaar + “+ X meer”; lege copy “Geen losse aandachtspunten.”; API levert `dashboard_output.attention` als `{text,kind}`; uitvoerbare `proposed_items` gaan naar taken, niet naar aandacht.
- Dagregie: compacte blokken **Nu / Straks / Einde dag** afgeleid van lab state + `day_review`; lege copy “Nog geen dagregie.”
- Projectbrain-planning: intent + appendix + fallback `ensurePencil` ook bij “Projectbrain + vandaag/morgen”-vraag; `lab_state` JSON meesturen in die modus.
- Startgroet: rotatie over neutrale zinnen + hash van labState/datum/uur + `localStorage` om directe herhaling te vermijden.

## 0.13.3 — 2026-05-02

- Mobiel (≤760px): één kolom, geen horizontale scroll; volgorde Clara-kop → klok → agenda → chat → aandacht/taken → dagregie via `display:contents` op de chat-sectie + `order`.
- Tablet/smalle desktop (761–1180px): ongewijzigd gedrag (alleen chat-kolom zichtbaar).
- Mobiel: horizontale padding `clamp(14px,4.2vw,18px)`, klok-cijfers/meta met `clamp()`, compactere agenda-timeline, grotere tikdoelen voor verzendknop en datum-pijlen, composer `textarea` iets groter voor iOS.

## 0.13.2 — 2026-05-03

- Chat: subtiele typing-indicator (drie bolletjes) tijdens analyse i.p.v. alleen tekst.
- Composer: status-/hintregel onder het invoerveld verwijderd voor rustiger beeld.
- Agenda-kop: subregel “meerdere dagen · pijltjes…” verwijderd.
- Uitlijning: gelijke minimale kophoogte Clara/Agenda zodat de scheidingslijn visueel strakker op één lijn valt.
- Klok-widget: duidelijk grotere tijd/datum/locatie/weer (clamp + typografie), binnen hetzelfde klok-vlak.

## 0.13.1 — 2026-05-03

- Startgroet bij laden: `buildStartupWisdom(labState)` leest agenda/aandacht/taken/dagregie en zet één korte opening in de chat (lokaal, geen API).

## 0.13.0 — 2026-05-03

- Vaste Core Lab-werkregel vastgelegd (README): Cursor lokaal, geen commit/push tenzij gevraagd, compacte diffs, versie- en changelog-discipline.
- Versienummer minor-bump en changelog-bestand toegevoegd.

## 0.12.9 — 2026-05-03

- Eerdere patch: onder andere analyze-gedrag, versie-alignment in package/README.
