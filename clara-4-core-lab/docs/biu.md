# BIU / Back it up

ACE is het systeem en de endpointlaag. BIU / Back it up is de methode of trigger waarmee Jeroen een gesprek of extract bewust voorbereidt en daarna via ACE laat checken of schrijven.

Schrijf `BIU` zonder spaties wanneer je de methode/trigger bedoelt. Schrijf `B I U` met spaties wanneer je alleen over de methode praat en de trigger niet wilt activeren.

## v1

BIU v1 was single-target: een BIU-extract ging als één call naar `/api/ace` en routeerde naar één `target_file`.

## v2

BIU v2 houdt ACE single-target, maar splitst een multi-project extract lokaal in secties. Elke sectie wordt daarna apart naar ACE gestuurd.

```bash
scripts/biu-check.sh
scripts/biu-write.sh
```

- `biu-check.sh` stuurt elke sectie met `source: "biu"` en `mode: "check"` naar `/api/ace`.
- `biu-write.sh` stuurt elke sectie met `source: "biu"` en `mode: "write"` naar `/api/ace`.
- Beide scripts vragen stil om `ACE_ACTION_SECRET` tenzij die al in de omgeving staat.
- Beide scripts accepteren input via stdin of `BIU_INPUT`; zonder input gebruiken ze een standaard multi-target testpayload.
- Check schrijft nooit. Run write alleen bewust.

Parser-only test zonder API-call of secret:

```bash
scripts/biu-check.sh --dry-run
```

De dry-run toont alleen de herkende secties en project hints. Gebruik dit om te controleren of een extract goed splitst voordat je een echte check of write doet.

Ondersteunde sectiekoppen:

```text
Project Clara Core Lab / ACE:
Project Clara:
Project LaLampe:
Project Begeister:
Project AFK / Landjuweel / Amarte:
Misc:
Inbox:

## Clara Core Lab / ACE
## LaLampe
## Begeister
## AFK / Landjuweel / Amarte
## Misc
## Inbox
```

Lege secties worden genegeerd. Elke sectie houdt zijn kop in de input, zodat ACE de projectnaam kan blijven gebruiken voor routing.
