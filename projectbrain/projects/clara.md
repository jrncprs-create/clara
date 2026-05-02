# Clara Status

## Laatst bijgewerkt
2026-05-02

## Strekking
Clara wordt primair een AI-assistent. Het dashboard, de agenda en latere opslag vormen haar spoor/geheugen. Clara vult het overzicht; het dashboard is niet het beginpunt maar de zichtbare neerslag van haar interpretatie.

Projectbrain is de brug tussen losse ChatGPT-gesprekken en Clara. Doel: waar Jeroen ook zit, kan hij met een korte trigger `PB` de relevante projectinformatie laten samenvatten en opslaan in GitHub, zodat Clara die projectstatus later kan inlezen zonder handmatig documenteren.

## Huidige fase
Clara 4 Core Lab + Projectbrain-koppeling. De focus ligt op het testen van Clara Core-intelligentie én het werkend krijgen van een praktische Projectbrain-flow vanuit ChatGPT naar GitHub.

## Laatste ontwikkeling
Projectbrain staat op `main` als aparte laag in de Clara-repo:

- `api/projectbrain-update.js`
- `projectbrain/README.md`
- `projectbrain/gpt-action-openapi.yaml`
- `projectbrain/gpt-instructions.md`
- `projectbrain/projects/clara.md`
- `projectbrain/projects/lalampe.md`
- `projectbrain/projects/begeister.md`
- `projectbrain/projects/afk-landjuweel-amarte.md`

Belangrijke PR's zijn gemerged:

- PR #40 — Add Projectbrain PB API v0
- PR #41 — Add Projectbrain GPT Action spec
- PR #42 — Update Projectbrain GPT Action for production

Laatste relevante commit voor werkende direct-push test: `015bcb49d06646fe44`.

## Beslissingen
- Clara 3 is geparkeerd als leerprototype.
- Clara 4 bouwt opnieuw vanuit assistent-logica.
- Clara Agenda is de interne waarheid; externe agenda's zijn later bronnen, blokkades of synchronisatie.
- `PB` wordt gebruikt als korte trigger om projectstatus naar GitHub Projectbrain door te zetten.
- Projectbrain push schrijft voorlopig direct naar `main`, niet via PR.
- De gewenste werkwijze is: losse brainstorms blijven vrij; pas bij `PB` wordt de relevante info gestructureerd opgeslagen.
- Clara moet later Projectbrain-bestanden kunnen inlezen als projectgeheugen/statuslaag.

## Open acties
- GPT Action gebruiken zodat curl niet meer nodig is.
- Checken of `PB check` en `PB push` stabiel werken vanuit de Custom GPT Action.
- Clara later een leespad geven naar `projectbrain/projects/*.md`.
- Bepalen of `PB` altijd direct naar `main` blijft schrijven of later weer via PR/check-modus loopt.
- Eventueel triggerfouten opvangen, zoals `bp` in plaats van `PB`, als dat praktisch handig blijkt.

## Risico's / onduidelijkheden
- Gewone ChatGPT-chats kunnen niet volledig automatisch achteraf worden gemonitord; er is een trigger zoals `PB` nodig.
- Direct schrijven naar `main` is praktisch voor snelheid, maar minder veilig dan PR's.
- Clara leest Projectbrain nog niet automatisch in; Projectbrain is nu vooral een GitHub-statuslaag.
- Het moet helder blijven welk project wordt bijgewerkt wanneer een gesprek meerdere projecten raakt.

## Eerstvolgende stap
De GPT Action-flow verder testen met `PB check` en `PB push`, daarna Clara laten lezen uit de Projectbrain-projectbestanden.

## Bronnen / laatste signalen
- Gesprek 2026-05-02: Projectbrain-concept uitgewerkt als brug tussen ChatGPT-brainstorms, GitHub en Clara.
- Gesprek 2026-05-02: Jeroen wil dat hij overal met `PB` de benodigde info kan opslaan zodat Clara die later kan inlezen.
