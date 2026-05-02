# Changelog — Clara 4 Core Lab

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
