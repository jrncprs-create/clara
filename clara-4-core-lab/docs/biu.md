# BIU / Back it up

BIU is de gebruikersmethode bovenop ACE. ACE is het systeem en de endpointlaag; BIU is de manier waarop Jeroen een gesprek of extract bewust klaarzet voor ACE check/write.

Schrijf `B I U` met spaties wanneer je alleen over de methode praat en de trigger niet wilt activeren.

## v1

BIU v1 gebruikt dezelfde production endpoint als ACE:

```bash
scripts/biu-check.sh
scripts/biu-write.sh
```

- `biu-check.sh` stuurt `source: "biu"` en `mode: "check"` naar `/api/ace`.
- `biu-write.sh` stuurt `source: "biu"` en `mode: "write"` naar `/api/ace`.
- Beide scripts vragen stil om `ACE_ACTION_SECRET` tenzij die al in de omgeving staat.
- Beide scripts accepteren input via stdin of `BIU_INPUT`; zonder input gebruiken ze een standaard testpayload.

ACE is in deze versie nog single-target: een BIU-extract routeert naar één `target_file` per call. Splits multi-project BIU-extracten voorlopig bewust in meerdere calls als elk project een eigen raw-update nodig heeft.
