# Raw — Clara Core Lab

_Last updated: 2026-05-05_

## Recente beweging
- v0.14.35 bouwde de eerste Projectplan Overlay.
- v0.14.36 maakte de overlay rustiger en bruikbaarder.
- v0.14.37 maakte `Projectplan → Plan deze week` werkend met pencil-blokken, afhankelijkheden en concrete agenda-herkomst.
- v0.14.38 voegde AI-projectplanvoorstellen toe via `/api/analyze` met `project_plan_suggestion`.
- v0.14.39 fixte projectplan-isolatie, LaLampe/AFK-leakage-validatie, realistischere planner-start en generieke agenda-suggestie-filtering.

## Actueel probleem uit test
De productiecode staat op v0.14.39, maar de browser-localStorage bevat waarschijnlijk oude teststate:
- oude LaLampe-projectplannen met AFK/lampwezen-stappen;
- oude project_plan agenda-items die blijven staan;
- oude `[Past niet] Scope en randvoorwaarden POC bepalen` open items;
- projectplanplanning stapelt soms nieuwe blokken bovenop oude blokken.

## Volgende stap
v0.14.40 moet geen nieuwe feature worden, maar een state-cleanup/migratie:
- bekende oude vervuiling uit localStorage opschonen;
- LaLampe-plannen met AFK-stappen corrigeren of vervangen;
- oude project_plan agenda-items dedupliceren/verwijderen;
- bij herplannen eerst bestaande agenda-items voor hetzelfde project_plan_id verwijderen;
- projectnaam in chatcommando altijd zwaarder laten wegen dan laatst geopende plan.

## Testfocus na v0.14.40
- Schoon starten of migreren zonder oude LaLampe/AFK-leakage.
- `Plan LaLampe projectplan deze week` plant alleen LaLampe.
- `Plan AFK projectplan deze week` plant alleen AFK.
- Geen onterechte `[Past niet]` voor stap 1.
- Geen generieke agenda-suggesties.

## Niet vergeten
Supabase/persistence pas na deze cleanup en na een schone projectplantest.
