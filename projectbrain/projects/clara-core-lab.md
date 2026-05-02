# Clara Core Lab

## Kern
Clara Core Lab is de experimentele kernlaag van Clara. Het Lab test hoe Clara losse input omzet in projectcontext, aandachtspunten, taken, agenda-items, realistische planning, conflictlogica en dagregie.

Het Lab is geen eindproduct en geen gewone takenlijst. Het is een gedragsprototype: hier wordt bepaald hoe Clara moet denken, plannen, corrigeren, tonen en samenwerken met Jeroen voordat onderdelen teruggaan naar de hoofdversie.

## Huidige status
Clara Core Lab draait lokaal via Cursor en wordt getest op `http://localhost:3000/clara-4-core-lab/`. De focus ligt nu op bruikbaarheid: mobiele weergave, denkbolletjes/statusflow, Aandacht, Dagregie, Projectbrain-planning en een minder herhalende welkomsttekst.

De Lab-versie zit rond v0.13.x. Er wordt lokaal gewerkt en pas bewust gepusht als Jeroen de staat online wil delen, bijvoorbeeld met Marlon via Vercel.

## Belangrijke feiten
- Map: `clara-4-core-lab/`.
- Belangrijke frontendbestanden: `index.html`, `style.css`, `app.js`.
- Analysebackend: `api/analyze.js`.
- Projectbrain-context komt uit `projectbrain/projects/*.md`.
- Clara Core Lab gebruikt lokale Lab State als tijdelijk werkgeheugen.
- Handmatige wijzigingen in Lab State zijn leidend.
- Agenda ondersteunt Dag/Avond en meerdere dagen.
- Datumkeuze hoort via de datumwidget/pijltjes te lopen, niet via extra losse tabs.
- Projectbrain is context, geen automatische takenlijst.

## Beslissingen
- Clara Core Lab moet compact en rustig blijven.
- Desktoplayout niet opnieuw ontwerpen bij kleine fixes.
- Mobiel moet alles logisch onder elkaar tonen.
- Denkbolletjes mogen tonen wat Clara praktisch aan het doen is, maar geen interne redenering.
- Aandacht is radar: risico’s, keuzes, checks, needs_time, conflicten, actieve projectlijnen.
- Dagregie is stuurlaag: Nu, Straks, Einde dag.
- Projectbrain-planning mag alleen compacte potloodvoorstellen maken.
- Harde afspraken alleen als Jeroen expliciet datum en tijd noemt.
- Geen overlap; als iets niet eerlijk past, wordt het `needs_time` of Aandacht.

## Open acties
- Mobiele weergave verbeteren: één kolom, geen horizontale scroll, kaarten onder elkaar.
- Denkbolletjes terugbrengen en koppelen aan een duidelijke statusflow.
- Statusflow specifieker maken: Input lezen, Lokale dagstaat ophalen, Projectbrain raadplegen, Projectcontext wegen, Agenda voorstel maken, Aandachtspunten scheiden, Dagregie opbouwen, Overlap controleren, Resultaat bijwerken.
- Tekst onder invoerveld verwijderen.
- Tekst “meerdere dagen · pijltjes kiezen dag” verwijderen.
- Datum/tijd-widget groter maken binnen hetzelfde vlak zonder redesign.
- Aandacht functioneel maken met maximaal 5 punten en type-labels.
- Dagregie functioneel maken met Nu / Straks / Einde dag.
- Projectbrain-planning testen vanuit alle projecten.
- Welkomsttekst laten variëren zodat die niet steeds exact hetzelfde blijft.
- Daarna pas eventueel commit/push voor Marlon-review.

## Aandachtspunten
- Risico: Aandacht en Dagregie worden dumpbakken als ze geen scherpe functie houden.
- Check: mobiele layout moet goed zijn voordat Marlon meekijkt.
- Check: denkstatus mag proces tonen, maar geen chain-of-thought of nep-redenering.
- Risico: Projectbrain-context mag niet alle open lijnen automatisch op vandaag zetten.
- Keuze: bepalen hoeveel Clara bij eerste lege start al zelf mag voorstellen.

## Eerstvolgende logische stappen
1. Test mobiel en fix responsive layout.
2. Controleer of Aandacht en Dagregie al functioneel zijn; zo niet, voer dit compact door.
3. Test Projectbrain-planning met de lopende projecten.
4. Fix welkomsttekstrotatie.
5. Laat Clara bij eerste start compacte opties tonen in plaats van passief te wachten.
6. Pas daarna pushen voor online review.

## Startsuggesties voor Clara Core Lab
Bij een eerste lege start mag Clara compact en actief openen met enkele nuttige opties, bijvoorbeeld:
- “Ik kan een planningvoorstel maken vanuit je lopende projecten.”
- “Ik kan eerst alleen tonen wat aandacht nodig heeft.”
- “Ik kan je dag opdelen in Nu, Straks en Einde dag.”
- “Ik kan per project één eerstvolgende logische actie kiezen.”

Clara moet dit niet als lange tekst tonen. Maximaal 2 tot 4 korte suggesties is genoeg.

## Eerste-start planningvoorstel
Als Jeroen Clara Core Lab voor het eerst opent en er Projectbrain-context beschikbaar is, mag Clara een rustig voorstel voorbereiden of aanbieden:

Vraag:
“Wil je dat ik vanuit Projectbrain een realistische planning voor vandaag en morgen voorstel?”

Bij akkoord of expliciete vraag:
- Clara: Core Lab mobiel/UI/gedrag testen.
- LaLampe: workshopflow of materiaalcheck.
- Begeister: grenzen/rollen/bespreekpunten voorbereiden.
- AFK / Landjuweel / Amarte: aanvraagtoon en Nachtdiertjes-kern bewaken.

Regels:
- Maximaal 1 eerstvolgende actie per project, tenzij er duidelijk ruimte is.
- Alles als potloodblok, niet als harde afspraak.
- Risico’s en keuzes naar Aandacht.
- Nu/Straks/Einde dag naar Dagregie.
- Geen overlap.
- Wat niet past naar `needs_time`.

## Testvragen
Gebruik deze vragen om Clara Core Lab te testen:

```text
Kijk naar de lopende projecten in Projectbrain en maak daar een realistische planning van voor vandaag en morgen. Kies per project alleen de belangrijkste eerstvolgende actie, zet uitvoerbare acties in agenda of taken, zet twijfelpunten/risico’s/keuzes in Aandacht, en geef in Dagregie aan wat ik nu het beste als eerste kan doen. Maak geen Projectbrain-dump, plan geen overlap, en zet wat niet eerlijk past apart als needs_time.
```

```text
Ik wil alleen weten wat aandacht nodig heeft. Maak geen agenda tenzij iets echt tijdkritisch is.
```

```text
Maak geen exacte planning, maar geef me een realistische richting voor deze week per project.
```

## Niet doen / grenzen
- Geen redesign als alleen gedrag getest wordt.
- Geen Projectbrain-dump.
- Geen willekeurige tijden verzinnen.
- Geen harde afspraken maken zonder expliciete datum en tijd.
- Geen taken kunstmatig te kort maken om ze passend te krijgen.
- Geen push naar GitHub tenzij Jeroen dat vraagt.
- Geen Supabase/databasewijzigingen voor Lab State zolang dit nog gedragsprototype is.

## Onzekerheden
- Of Lab State tijdelijk blijft, via localStorage moet werken, of later naar Supabase gaat.
- Hoe actief Clara bij een eerste lege start mag zijn.
- Of Clara Core Lab permanent een eigen Projectbrain-bestand blijft.
- Welke Core Lab-logica teruggaat naar de hoofdversie van Clara.
