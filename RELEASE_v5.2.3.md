# BBQ Planner v5.2.3 — Rustig Live-scherm

**Status: releasekandidaat.** Basis: `3a46b602113dfd581dc622a9316c4c328eddc513` (v5.2.2).

## Wat is gewijzigd?
- De bestaande 30-seconden-timer voert niet langer een volledige `render()` van het Live-scherm uit. Dit voorkomt periodiek opnieuw opbouwen van pagina, knoppen, geopende receptstappen en scrollpositie.
- De aftelling tot de serveertijd en het label ‘NU DOEN/HIERNA’ worden iedere 30 seconden nog wel inhoudelijk bijgewerkt, maar alleen op hun bestaande tekstnodes. Ook wordt de taakomschrijving aangepast zodra een geplande tijd verstreken is.
- Temperatuurwaarden blijven direct verwerkt na ontvangst van het Home Assistant-bericht. De ouderdom van die meetwaarden loopt per seconde mee (nieuw in v5.2.2).

## Belangrijke beperking
- De brondata via de officiële Home Assistant-MEATER-cloudintegratie wordt circa elke 30 seconden uitgelezen. Deze release verbetert de vloeiendheid van het scherm, niet die bronfrequentie.
- Een lokale Bluetooth-verbinding voor MEATER Pro en Plus is **niet gebouwd**; moet model- en hardwareafhankelijk worden gevalideerd.

## Regressie en uitrol
- Extra geautomatiseerde test: countdown, overgang HIERNA→NU DOEN, geen vernieuwing van Live-DOM, behoud van open stappen, en onveranderde opslag.
- Bestaande jsdom, PWA, HACS, iPhone-emulatie via Chromium en WebKit, v6/engine- en publicatiebewaking moeten groen zijn.
- Release-workflow controleert de vijf verplichte checks op `main` en maakt uitsluitend de juiste v5.2.3-tag.
- Fysieke MEATER Pro/Plus, iPhone en HACS blijven een aparte praktijkacceptatie.
