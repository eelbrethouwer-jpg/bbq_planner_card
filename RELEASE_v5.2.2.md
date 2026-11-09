# BBQ Planner v5.2.2 — MEATER direct in Live

**Releasekandidaat.** Basis: `529f4b827b9d4a3d78e07069b42d61097010bc03` (v5.2.1).

## Nieuwe mogelijkheden
- Zodra Home Assistant een verse MEATER-kerntemperatuur doorstuurt, wordt deze direct zichtbaar in de Live-kamadokaart en de gerechtdetails.
- De leeftijd van de laatste echte HA-sensorwijziging wordt in seconden getoond. Na 60 s verschijnt **Vertraagd**; na vijf minuten wordt de meting volgens de bestaande grens afgekeurd.
- Alleen de temperatuurvakken verversen; geplande taken, scroll, focus en open receptstappen worden niet bij iedere seconde opnieuw opgebouwd.

## Ongewijzigd
- De MEATER Home Assistant-integratie haalt normaal iedere 30 seconden nieuwe gegevens op. Deze release verhoogt die frequentie niet.
- De publieke PWA krijgt geen live HA-gegevens en er is geen nieuwe Bluetooth-/cloudverbinding toegevoegd.
- Kookengine, serveertijd, recepten, reviews, v6-preview, HA-berichtencontract en opslag blijven gelijk.

## Test- en vrijgavevoorwaarden
- GitHub Checks: `validate-hacs`, `html-javascript`, `ui-smoke`, `mobile-browser` en `version-consistency` moeten groen zijn op de exacte HEAD.
- Extra DOM-regressie met **fictieve sensordata** valideert directe update, secondenlabel, verlopen metingen en onveranderde opslag.
- De eenmalige releaseworkflow publiceert pas nadat de volledige `HACS-validatie` op de mergecommit is geslaagd.
- Praktijkacceptatie met MEATER Pro/Plus, Home Assistant/HACS en fysieke iPhone blijft open.
