# Clara Core Lab

_Last updated: 2026-05-05_

## Routing
- project_id: `clara-core-lab`
- aliases: Clara Core Lab, Core Lab, Clara 4, projectplan overlay, Projectbrain, ACE, BIU
- type: active development project

## Kern
Clara Core Lab is de experimentele AI-first kernlaag van Clara. Het Lab test hoe Clara losse taal omzet naar projectcontext, open items, projectplannen, taken, potloodagenda en dagregie. Het is een gedragsprototype, geen klassieke takenlijst en nog geen definitieve Supabase-app.

## Huidige technische stand
- Productie draait op `https://clara-4-core-lab.vercel.app`.
- Huidige versie: `v0.14.39`.
- Laatste commit: `ae975df fix(core-lab): isolate project plan planning`.
- Frontend staat in `clara-4-core-lab/` met `index.html`, `style.css`, `app.js`.
- Backend-analyse loopt via `clara-4-core-lab/api/analyze.js` en/of root `/api/analyze` afhankelijk van deploy-routing.
- Projectbrain-context wordt server-side gelezen uit `projectbrain/projects/*.md` en recente context uit `projectbrain/raw/*.md`.
- Lab State en projectplannen staan voorlopig lokaal in browser/localStorage.
- Nog geen Supabase/storage-adapter voor Core Lab.

## Belangrijkste gebouwde lagen
1. Startup-overlay discipline: geen generieke agenda-rommel, geen interne/fallbacktaal, alleen concrete voorstellen.
2. Open items opgeschoond: max 1–3, gebruikersgericht, niet als debugdump.
3. Projectplan Overlay: per project doel, deadline, context, stappen, checklisttaken, duur, afhankelijkheden en editing.
4. Projectplan → slimme potloodplanning: `Plan deze week` maakt pencil-blokken, geen confirmed items.
5. AI-projectplan-generator: duidelijke projectplanvragen kunnen via AI + Projectbrain een `project_plan_suggestion` maken.
6. Projectplan-isolatie: laatst geopende plan wordt bijgehouden, maar expliciete projectnaam in commando gaat voor.

## Beslissingen
- Eerst gedrag goed krijgen, daarna pas persistence/Supabase.
- Projectbrain is context, geen automatische takenlijst.
- Raw-context is recente beweging, geen harde waarheid.
- Agenda-items uit projectplan blijven altijd `pencil` en `confirmation_required:true`.
- Geen harde afspraken zonder expliciete datum en tijd.
- Geen weekendplanning tenzij expliciet of noodzakelijk; standaard werkdagen ma-vr.
- Maandag start later; dinsdag-vrijdag standaard 10:00–18:00.
- Als iets niet past: naar Aandacht/open item, niet kunstmatig inkorten.
- Chat blijft hoofdingang; overlay is correctie- en reviewlaag.

## Actuele aandacht
- Bestaande lokale teststaat kan vervuild zijn door oude v0.14.38/v0.14.39 projectplannen en agenda-items.
- Er zijn oude LaLampe-plannen gezien met AFK/lampwezen-stappen. Dat moet door lokale state-migratie of opschonen verdwijnen.
- Er zijn oude `[Past niet] Scope en randvoorwaarden POC bepalen` open items gezien. Die lijken uit oude planningstate te komen.
- Nieuwe code kan schoon zijn terwijl browser-localStorage nog oude rommel toont.

## Eerstvolgende logische stap
Maak `v0.14.40` als state-cleanup/migratie:
- eenmalige cleanup van localStorage voor bekende v0.14.38/v0.14.39-vervuiling;
- oude LaLampe/AFK leakage verwijderen of corrigeren;
- oude project_plan agenda-items dedupliceren;
- replan eerst bestaande items van hetzelfde project_plan_id verwijderen;
- projectnaam in chatcommando zwaarder laten wegen dan `lastOpenedProjectPlanId`.

## Niet doen nu
- Geen Supabase of storage-adapter bouwen vóór de lokale state/prototype-logica schoon getest is.
- Geen nieuwe grote UI-restyle.
- Geen automatische confirmed planning.
- Geen Projectbrain-dump als agenda.

## Goede testscenario’s
- `Maak een projectplan voor AFK: ik wil een werkende lamp met voet als proof of concept afhebben.`
- `Ik wil de LaLampe workshopflow verkoopbaar maken voor juni. Maak daar een projectplan voor.`
- `Plan LaLampe projectplan deze week.`
- `Plan AFK projectplan deze week.`
- `Maak een dagplanning voor vandaag.`

## Succescriteria
- AFK krijgt POC/lamp/voet/licht/stabiliteit/documentatie-stappen.
- LaLampe krijgt workshopflow/materiaal/avondopbouw/test/verkoopbaarheid-stappen, geen lampwezen/voetconstructie/POC-hoofdstappen.
- Projectplanplanning stapelt niet bij herhaald klikken.
- Oude `Past niet`-rommel verdwijnt.
- Agenda-suggesties tonen geen generieke placeholder zoals “één concrete eerstvolgende stap kiezen”.
