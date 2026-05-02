# Clara

## Kern
Clara is Jeroens AI-first assistent en dashboard voor projecten, planning, aandacht, taken, losse input en dagelijkse regie. Clara moet geen klassieke takenlijst zijn, maar een slimme laag die natuurlijke taal begrijpt, projectcontext meeneemt en helpt kiezen wat nu logisch is.

Clara bestaat uit meerdere lagen: Clara Core Lab, Projectbrain, AI-intake/analyse, dashboardlogica, agenda, aandacht, dagregie en later mogelijke koppelingen met mail, agenda, WhatsApp en andere bronnen.

## Huidige status
Clara zit in een actieve herbouw- en stabilisatiefase. De praktische focus ligt nu op Clara Core Lab: daar wordt getest hoe Clara moet reageren, plannen, aandacht scheiden, dagregie geven en Projectbrain-context gebruiken zonder alles als taak te dumpen.

De huidige ontwikkeling gebeurt lokaal in Cursor. GitHub blijft de centrale source of truth. Online delen loopt via Vercel zodra Jeroen bewust commit/push doet.

## Belangrijke feiten
- Repo: `jrncprs-create/clara`.
- Lokale werkomgeving: Cursor.
- Lokale URL: `http://localhost:3000`.
- Clara Core Lab staat in `clara-4-core-lab/`.
- Clara Core Lab gebruikt `/api/analyze` als analyse- en planningslaag.
- Projectbrain bewaart compacte projectcontext in `projectbrain/projects/*.md`.
- Projectbrain is contextgeheugen, geen automatische takenlijst.
- GitHub is source of truth voor code en Projectbrain-status.
- Supabase is later bedoeld voor operationele data, niet voor ruwe projectstatus.
- ChatGPT helpt met analyse, specificatie en projectlogica.
- Cursor voert lokale code-aanpassingen uit.
- Geen automatische commit/push tenzij Jeroen dat expliciet vraagt.

## Beslissingen
- Clara moet AI-first blijven: taal als ingang, structuur als uitkomst.
- Clara Core Lab is een gedragsprototype, geen eindproduct.
- Projectbrain-context mag gebruikt worden om planningvoorstellen te maken als Jeroen daarom vraagt.
- Projectbrain-context mag niet automatisch als vandaaglijst worden behandeld.
- Handmatige correcties van Jeroen in Lab State zijn leidend bij volgende analyses.
- Agenda, Taken, Aandacht en Dagregie moeten elk een eigen functie hebben:
  - Agenda = wanneer doe ik iets?
  - Taken = wat kan gedaan worden?
  - Aandacht = wat moet in beeld blijven?
  - Dagregie = wat is nu/later/einde dag verstandig?
- Technische Clara- of Projectbrain-infrastructuur hoort onder Clara, niet onder LaLampe, Begeister of AFK.

## Open acties
- Clara Core Lab mobiel netjes maken: alles rustig onder elkaar, geen horizontale scroll.
- Denkbolletjes/statusflow specifieker maken: input lezen, lokale staat ophalen, Projectbrain raadplegen, context wegen, planning maken, overlap controleren.
- Aandacht functioneel maken als radar voor risico’s, keuzes, checks, needs_time en projectlijnen.
- Dagregie functioneel maken als stuurlaag: Nu, Straks, Einde dag.
- Projectbrain-md’s rijk genoeg maken zodat Clara vanuit projecten een planningvoorstel kan maken.
- Welkomsttekst/startgroet laten variëren en niet steeds dezelfde zin tonen.
- Eerst lokaal testen, daarna pas pushen voor Marlon om online mee te kijken.

## Aandachtspunten
- Risico: Clara mag Projectbrain niet als automatische takenlijst gebruiken.
- Check: mobiel moet goed zijn voordat Marlon online meekijkt.
- Keuze: bepalen of Clara Core Lab een eigen Projectbrain-bestand blijft of deels onder Clara valt.
- Check: Aandacht en Dagregie mogen geen extra dumpbakken worden.
- Risico: UI-aanpassingen moeten klein blijven; geen redesign terwijl gedrag nog wordt getest.

## Eerstvolgende logische stappen
1. Clara Core Lab lokaal mobiel controleren en fixen waar nodig.
2. Aandacht en Dagregie testen met echte projectinput.
3. Projectbrain-planning testen met de vraag om vanuit lopende projecten een planning voor vandaag/morgen te maken.
4. Welkomsttekst/startgroet controleren op variatie.
5. Als het stabiel genoeg is: bewust committen en pushen voor Vercel/Marlon-review.

## Startsuggesties voor Clara Core Lab
Deze suggesties mag Clara gebruiken om bij een eerste lege start nuttige vragen of acties voor te stellen:
- “Wil je dat ik vanuit Projectbrain een rustige planning voor vandaag en morgen voorstel?”
- “Wil je eerst alleen aandachtspunten zien, zonder agenda te maken?”
- “Wil je Clara Core Lab verder testen voordat je Marlon laat meekijken?”
- “Wil je per project alleen de eerstvolgende logische actie zien?”

## Planningseed voor projectbrein-gestuurde start
Als Jeroen vraagt om een planning vanuit Projectbrain, kies dan compact:
- Clara: Core Lab mobiel/UI/gedrag testen.
- LaLampe: workshopflow of materiaalcheck.
- Begeister: grenzen en rollen voorbereiden.
- AFK / Landjuweel / Amarte: aanvraagtoon en Nachtdiertjes-kern bewaken.

Maak hiervan potloodblokken, geen harde afspraken. Plan maximaal wat eerlijk past. Zet risico’s en keuzes in Aandacht. Geef in Dagregie één beste volgende stap.

## Niet doen / grenzen
- Geen Projectbrain-dump in agenda of Aandacht.
- Geen harde afspraken verzinnen zonder expliciete datum en tijd.
- Geen technische Clara-acties onder andere projecten opslaan.
- Geen automatische push of deployment zonder Jeroens expliciete opdracht.
- Geen lange welkomstteksten of melige wijsheden.

## Onzekerheden
- Of Lab State tijdelijk moet blijven of naar localStorage/Supabase moet.
- Hoeveel Projectbrain-context standaard geladen moet worden.
- Hoe taken, aandacht en agenda uiteindelijk het scherpst gescheiden blijven.
- Welke Core Lab-logica later teruggaat naar Clara hoofdversie.
