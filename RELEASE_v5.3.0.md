# BBQ Planner v5.3.0 — Live-gerechtkaart

**Status: releasekandidaat (draft-PR), niet gepubliceerd.** Basis: `357252b78c9136d35d0868e4ad6b3ad4f8de7e06` (main na PR #42; code v5.2.3).

## Wat is gewijzigd?
- **Eén kaart per gerecht op Live**, in plaats van één tegel per kamado. Ook twee gerechten op één kamado krijgen elk een eigen kaart met hun eigen thermometer.
- Per kaart: grote kerntemperatuur → Richtkern met voortgangsbalk, leeftijd van de meting, omgeving en stijging (°C/min), "Op tafel rond HH:MM" met bron en marge, de fase met de bestaande faseknop en hooguit één coachregel.
- Bron van "op tafel rond": de bestaande `v46Prediction` (MEATER-ETA als de MEATER-app een kooksessie heeft, anders de eigen rechte-lijntrend), plus rusttijd. Zonder bruikbare meting: de planning.
- **Thermometer koppelen in stap 2** (Geen / MEATER Pro / MEATER Plus) met het bestaande veld `d.meater`. Standaard bij toevoegen: Pro → eerste gerecht op de grote kamado, Plus → eerste op de kleine. Een probe die al aan een ander gerecht hangt, kun je niet nog eens kiezen.
- **Screen Wake Lock** zolang Live zichtbaar is; losgelaten bij verbergen of weggaan. Zonder ondersteuning wordt dit stil overgeslagen.
- De uitlegregel op Live staat achter een ⓘ.

## Niet gewijzigd
- Opslagschema, localStorage-sleutels, berichttypen, `engine/` en `v6/`.
- v5.2.3-contract: een sensorupdate ververst alleen de vakjes van de kaart; één 1-s-timer en één 30-s-timer.
- De publieke PWA toont geen HA- of MEATER-data.

## Beperkingen
- De marge bij de eigen trend is in deze versie een vuistregel (±20% van de resterende tijd, minimaal 2 min). Een echte schattingsmodule volgt in v5.4.0.
- Screen Wake Lock werkt alleen als de browser of de Home Assistant-app het ondersteunt; dit is niet op een echte iPhone getest.
- Geen echte Home Assistant-, MEATER- of iPhone-test; alle tests gebruiken gemarkeerde fixtures.
