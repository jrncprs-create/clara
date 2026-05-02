# Clara

## Kern
Clara is Jeroens AI-first assistent en dashboard voor projecten, taken, planning, notities, aandachtspunten en projectgeheugen. Clara moet losse input begrijpen en helpen ordenen, niet functioneren als een klassieke takenlijst.

Clara Core Lab is de experimentele kernlaag waarin gedrag, planning, Projectbrain-context en AI-interpretatie worden getest voordat onderdelen teruggaan naar de hoofdversie.

## Huidige fase
Clara zit in een herbouw- en stabilisatiefase. De focus ligt nu op Clara Core Lab, Projectbrain, betrouwbare projectcontext, realistische planning en het voorkomen dat context automatisch als takenlijst wordt behandeld.

## Feiten
- Clara gebruikt ChatGPT/OpenAI als centrale redeneerlaag.
- GitHub is de source of truth voor code en Projectbrain-status.
- Cursor is op dit moment de lokale werkomgeving voor code-aanpassingen.
- Projectbrain bewaart compacte projectcontext in `projectbrain/projects/*.md`.
- Clara Core Lab staat in `clara-4-core-lab/`.
- Clara Core Lab gebruikt `/api/analyze` als analyse- en planningslaag.
- Projectbrain-context is projectgeheugen, geen automatische takenlijst.
- Supabase is bedoeld voor operationele Clara-data, niet voor ruwe projectstatus.

## Beslissingen
- Clara moet AI-first blijven: taal als ingang, structuur als uitkomst.
- Clara Core Lab is een gedragsprototype, geen eindproduct.
- Projectbrain-statussen moeten compact, gestructureerd en veilig leesbaar blijven.
- Open acties uit Projectbrain mogen niet automatisch als vandaag-taak of agenda-item worden behandeld.
- Handmatige correcties van Jeroen moeten leidend zijn bij volgende analyses.
- Geen automatische commits of pushes vanuit Cursor, tenzij Jeroen dat expliciet vraagt.
- Technische Clara- of Projectbrain-infrastructuur hoort onder Clara, niet onder LaLampe, Begeister of AFK.

## Doelen
- Clara losse input betrouwbaar laten begrijpen.
- Projectcontext bruikbaar maken zonder dashboardvervuiling.
- Een realistische agenda- en dagregielaag testen.
- Taken, aandachtspunten, projectcontext en agenda-items duidelijker scheiden.
- Projectbrain-routing en Projectbrain-lezen veiliger maken.
- Een stabiele basis maken voor toekomstige Clara-versies.

## Open lijnen
- Projectbrain-routing strakker maken, zodat updates niet in het verkeerde projectbestand belanden.
- Clara leren onderscheiden tussen context, doelen, open lijnen en operationele taken.
- Controleren of Clara Projectbrain-context niet als takenlijst of vandaag-lijst leest.
- Clara Core Lab testen met minimale, schone projectcontext.
- Bepalen of Clara Core Lab een eigen Projectbrain-bestand nodig heeft of onder Clara blijft.
- Bepalen welke Core Lab-logica later teruggaat naar de hoofdversie.

## Eerstvolgende mogelijke acties
- Projectbrain update/check/push-flow testen met schone projectbestanden.
- In `api/analyze.js` regels aanscherpen voor Projectbrain als context-only bron.
- In `api/projectbrain-update.js` routingwaarschuwingen toevoegen bij twijfel over projectbestemming.
- Clara Core Lab testen met vragen als: "Wat weet je over LaLampe?" en "Plan een korte werksessie voor LaLampe.".

## Let op / grenzen
- Projectbrain-feiten, beslissingen, doelen en open lijnen zijn context, geen automatische taken.
- Een open lijn is niet automatisch een taak voor vandaag.
- Alleen expliciete gebruikersvragen mogen Projectbrain-context omzetten naar taken of planning.
- Geen database- of schemawijzigingen zonder expliciete opdracht.
- Geen technische Clara/Projectbrain-informatie opslaan onder LaLampe, Begeister of AFK.

## Onzekerheden
- Of Clara Core Lab een eigen Projectbrain-bestand moet krijgen.
- Hoeveel Projectbrain-context standaard geladen moet worden.
- Wanneer Lab State persistent moet worden.
- Hoe taken, aandacht en agenda uiteindelijk het beste gescheiden worden.
