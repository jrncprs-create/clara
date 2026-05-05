# Clara Core v0.15 — Clean Shared State Start

## Kern

Clara is de denklaag en gesprekspartner.
Clara Core is de app, UI en werkplek.
Clara State is de gedeelde operationele waarheid.

Clara Core probeert ChatGPT niet na te bouwen. Clara Core toont en bewerkt de gedeelde state waar Clara als denklaag op kan schrijven.

## Resetbesluit

Oude Core Lab v0.14.x is stopgezet als actieve architectuur.

Die versie bevatte te veel:
- fallbackroutes;
- projectplan-overlays;
- open-items-logica;
- microguards;
- Projectbrain-afhankelijkheid;
- automatische planning uit vage input.

Voor v0.15 beginnen we schoon.

## Nieuwe hoofdflow

Jeroen praat met Clara.
Clara ordent, plant en stelt vragen.
Clara schrijft of actualiseert Clara State.
Clara Core toont agenda, vragen, werksporen, beslissingen en notities.
Jeroen kan later in Clara Core bevestigen, aanpassen of sluiten.

## Rollen

### Clara

De denklaag:
- begrijpt gesprek;
- ordent informatie;
- plant voorzichtig;
- benoemt onzekerheden;
- schrijft gestructureerde state.

### Clara Core

De interface:
- leest Clara State;
- toont wat speelt;
- maakt potloodstatus zichtbaar;
- laat later bewerken en bevestigen;
- doet niet alsof het zelf de primaire AI is.

### Clara State

De operationele bron:
- agenda;
- vragen;
- werksporen;
- beslissingen;
- notities;
- inbox (unplaced input).

### Projectbrain

Projectbrain is voorlopig niet de primaire agenda- of state-route.
Het kan later terugkomen als archief/contextlaag, maar niet als bron waaruit automatisch taken of agenda-items worden gedumpt.

## v0.15.0 doel

Eerste doel:
Clara Core leest read-only uit Clara State en toont die rustig (inclusief kalenderweergave via Schedule-X op `agenda_items`).

Nog niet:
- geen AI-call;
- geen oude analyze-flow;
- geen Projectbrain;
- geen automatische planning;
- geen oude open-items;
- geen projectplan-overlay;
- geen Plan deze week-flow;
- geen Doe nu / Parkeer-acties.

## State-principe

Agenda wordt alleen gevuld vanuit expliciet geschreven of geaccepteerde Clara State.

Vage input wordt niet automatisch agenda.
Onzekerheid wordt een vraag.
Voorstellen blijven potlood totdat Jeroen bevestigt.

## Volgende stappen na v0.15.0

v0.15.1:
Clara Core kan items lokaal accepteren, sluiten of verwijderen.

v0.15.2:
Clara Core kan wijzigingen terugschrijven naar Clara State.

v0.15.3:
Clara kan vanuit ChatGPT-gesprekken Clara State vullen.

v0.15.4:
Tweewekenplanning vanuit gesprek naar Clara State en zichtbaar in Clara Core.
