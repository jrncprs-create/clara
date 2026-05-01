# Clara 4 Core Lab — test-inputs v0.1

Gebruik deze zinnen om te testen of Clara goed interpreteert.

## Losse input

```text
Morgen Marlon bellen over de honden en Jan nog achter z’n offerte aanzitten voor Begeister.
```

Verwachting:

- taak of aandachtspunt voor Marlon/honden
- waiting-for of taak richting Jan/offerte
- project Begeister bij Jan/offerte
- geen verzonnen tijd

---

```text
Claire vroeg nog naar die installatie met agaat. Ik moet haar eigenlijk antwoorden maar weet niet of dit onder AFK valt of iets nieuws is.
```

Verwachting:

- aandacht nodig: Claire beantwoorden
- onzekerheid over project
- vraag over projectkoppeling mag
- geen harde AFK-koppeling zonder zekerheid

---

```text
Vrijdag LaLampe lampenkappen bestellen en even kijken of er genoeg snoeren zijn.
```

Verwachting:

- project LaLampe
- twee acties of één gecombineerde actie
- vrijdag als datum als context duidelijk genoeg is
- geen tijd

---

```text
Wachten op offerte van Piet voor de houten frames.
```

Verwachting:

- waiting_for
- wachten op Piet
- project onbekend tenzij Clara logisch maar voorzichtig koppelt

---

```text
Ik denk dat Clara geen projectmanagement-app moet zijn maar een assistent die het dashboard vult.
```

Verwachting:

- project_context of decision voor Clara
- niet als taak opslaan
- dashboard eventueel projectsignaal

## Mailtekst

```text
Hoi Jeroen, heb je nog nagedacht over die installatie met agaat? Ik hoor graag of je beschikbaar bent. Groet, Claire
```

Verwachting:

- actie voor Jeroen: Claire beantwoorden
- mogelijk project onbekend
- bron email

---

```text
Beste Jeroen, hierbij de offerte voor de houten frames. Als je akkoord bent kunnen we volgende week starten.
```

Verwachting:

- aandacht nodig: offerte beoordelen
- deadline/agenda-signaal: volgende week starten mogelijk
- mogelijk projectcontext houten frames

## Agenda-achtige input

```text
Morgen 14:00 overleg met Marlon over Begeister.
```

Verwachting:

- appointment
- project Begeister
- datum morgen
- tijd 14:00

---

```text
Vandaag tussen 13:00 en 17:00 afspraken, dus weinig ruimte voor diepe klus.
```

Verwachting:

- agenda-signaal
- dashboard today/agenda
- suggestie: geen zware klus plannen

## Ruis

```text
oeps daisy en in de ronte
```

Verwachting:

- geen taak
- mogelijk noise
- geen dashboard-output of alleen korte vraag/geen vraag
