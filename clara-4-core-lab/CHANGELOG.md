# Changelog — Clara 4 Core Lab

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
