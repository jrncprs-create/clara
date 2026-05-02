# Clara Status

## Laatst bijgewerkt
2026-05-02

## Strekking
Clara wordt primair een AI-assistent. Het dashboard, de agenda en latere opslag vormen haar spoor/geheugen. Clara vult het overzicht; het dashboard is niet het beginpunt maar de zichtbare neerslag van haar interpretatie.

## Huidige fase
Clara 4 Core Lab. De focus ligt op het testen van Clara Core-intelligentie voordat echte opslag, dashboardlogica, mail- en agenda-koppelingen leidend worden.

## Laatste ontwikkeling
Projectbrain wordt toegevoegd als aparte laag om projectstatussen uit ChatGPT-brainstorms via `PB` naar GitHub te kunnen doorzetten.

## Beslissingen
- Clara 3 is geparkeerd als leerprototype.
- Clara 4 bouwt opnieuw vanuit assistent-logica.
- Clara Agenda is de interne waarheid; externe agenda's zijn later bronnen, blokkades of synchronisatie.
- `PB` wordt gebruikt als korte trigger om projectstatus naar GitHub Projectbrain door te zetten.

## Open acties
- Projectbrain API testen.
- GPT Action ontwerpen voor `PB check` en `PB push`.
- Clara Core Lab blijven testen op planning, conflicten, potloodblokken, open loops en dagreview.

## Risico's / onduidelijkheden
- Gewone ChatGPT-chats kunnen niet volledig automatisch achteraf worden gemonitord; er is een trigger zoals `PB` nodig.
- Automatisch schrijven moet bij voorkeur via PR gebeuren, niet direct naar main.

## Eerstvolgende stap
Projectbrain API koppelen aan een Custom GPT Action en testen met LaLampe als eerste project.

## Bronnen / laatste signalen
- Gesprek 2026-05-02: Projectbrain-concept uitgewerkt als brug tussen ChatGPT-brainstorms, GitHub en Clara.
