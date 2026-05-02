# Projectbrain

Projectbrain is de laag waarmee losse ChatGPT-brainstorms en projectgesprekken compact worden vastgelegd in GitHub.

## Bedoeling

Jeroen kan in een chat `PB` gebruiken als korte trigger. De Projectbrain Extractor vat de relevante ontwikkeling samen, herkent het project en werkt het juiste Markdown-statusbestand bij.

## Structuur

```txt
projectbrain/
  README.md
  projects/
    clara.md
    lalampe.md
    begeister.md
    afk-landjuweel-amarte.md
```

## Commando-afspraak

```txt
PB
```

Maak een projectbrain-update op basis van deze chat.

```txt
PB check
```

Toon eerst wat er aangepast zou worden.

```txt
PB push
```

Schrijf de update via de Projectbrain API naar GitHub. De veilige standaard is een pull request, niet direct naar `main`.

## API

De eerste endpoint-versie staat in:

```txt
api/projectbrain-update.js
```

Verwachte request-body:

```json
{
  "project": "lalampe",
  "input": "Ruwe chat-samenvatting of brainstormtekst",
  "source": "chatgpt",
  "mode": "check",
  "create_pr": true
}
```

Modes:

- `check`: geeft Markdown terug, schrijft niets naar GitHub.
- `push`: schrijft naar GitHub, standaard via PR als `create_pr: true`.

Benodigde env vars:

```txt
OPENAI_API_KEY
PROJECTBRAIN_GITHUB_TOKEN
PROJECTBRAIN_REPO=jrncprs-create/clara
PROJECTBRAIN_BASE_BRANCH=main
PROJECTBRAIN_OPENAI_MODEL=gpt-4.1-mini
```
