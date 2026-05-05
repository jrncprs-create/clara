# Clara

_Last updated: 2026-05-05_

## Routing
- project_id: `clara`
- aliases: Clara, Clara 3, Clara hoofdversie, Projectbrain, ACE, BIU, AI-assistent
- type: umbrella software/personal assistant project

## Kern
Clara is Jeroens persoonlijke AI-assistent en projectregielaag. Clara moet losse input begrijpen, context meenemen, acties en afspraken onderscheiden, realistisch plannen, projectvoortgang zichtbaar maken en uiteindelijk dagelijkse regie bieden zonder dat Jeroen alles handmatig hoeft te structureren.

## Relatie tot Clara Core Lab
- Clara Core Lab is de experimentele kernlaag waar gedrag eerst wordt getest.
- Logica die in Core Lab goed voelt kan later terug naar de hoofdversie van Clara.
- Clara hoofdversie mag later Supabase, agenda, mail en persistentie gebruiken, maar gedrag moet eerst kloppen.

## Huidige architectuurrichting
- ChatGPT/OpenAI blijft centrale redeneerlaag.
- GitHub/Projectbrain bewaart projectstatus en context.
- `projectbrain/projects/*.md` bevat stabiele projectwaarheid.
- `projectbrain/raw/*.md` bevat recente beweging en open eindjes.
- Clara Core Lab leest Projectbrain-context server-side.
- Supabase komt later voor operationele data, niet voordat gedrag/projectplanlaag schoon is.

## Belangrijke beslissingen
- Niet één monolithisch ChatGPT-project; echte projecten blijven apart.
- ACE/BIU is de semi-automatische brug van ChatGPT naar Projectbrain.
- B I U met spaties betekent praten over de trigger zonder hem te activeren.
- Projectbrain is context, geen automatische takenlijst.
- Raw-context is aanleiding/signaal, geen harde waarheid.
- Handmatige edits in Clara zijn leidend.
- Geen confirmed afspraken zonder expliciete datum en tijd.

## Huidige focus
- Clara Core Lab stabiliseren rond projectplannen, potloodplanning en lokale state-cleanup.
- Daarna pas Supabase/persistence voorbereiden.
- Algemene taken zoals Admin/Persoonlijk/Atelier/Huis/Misc later goed modelleren naast projectplannen.

## Niet doen
- Niet te vroeg Supabase bouwen.
- Niet Projectbrain-context als agenda dumpen.
- Geen oude Uitdrukkerij standaard als actief project behandelen.
- Geen weekend/avondplanning zonder reden.

## Open acties
- Core Lab v0.14.40 lokale teststate-cleanup uitvoeren.
- Daarna projectplanflow schoon testen met AFK en LaLampe.
- Daarna beslissen hoe Supabase/persistence wordt voorbereid.
- Later algemene taken/categorieën toevoegen.
