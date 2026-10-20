# Wijzigingen

## v4.1.0 — Recepten, evaluaties en twee MEATER-temperatuurlijnen (voorbereid)

- Stap 04: elke bereiding is uitklapbaar met ingrediënten, voorbereiden, garen, rusten en aansnijden.
- Nieuw voorbeeldrecept Ribeye 500 g met reverse-sear, indirect/direct kamado-temperatuur en snijtips.
- Recepten importeren met publieke Recipe JSON-LD als CORS dit toestaat; plakken van recepttekst blijft altijd beschikbaar. Eigen recepten opgeslagen in lokale receptenbibliotheek.
- Uitgebreide instructies per gerecht bewerken via een uitklapbare recepteditor.
- Na een bereiding beoordeling, werkelijke eindkern en leerpunten bewaren; hergebruik via lokale reviewhistorie, los van je huidige planning.
- MEATER Pro en Plus: grafiek met *kerntemperatuur* en *omgevingstemperatuur*, tijdstippen, kleuren en Celsius-schaal. Alleen echte sensorwaarden, geen demo-grafiek.
- Home Assistant-dashboardbrug blijft ongewijzigd in werking; bron-URL krijgt een cache-bust naar v4.1.0.
- De bestaande planning, tijdlijnen, temperatuurconflicten, JSON-planexport, print, slimme bijsturing en mobiele bediening blijven intact.
- Let op: browseropslag is apparaatgebonden; een site die CORS blokkeert kan niet rechtstreeks automatisch worden ingelezen.

## v4.0.0 — Eerste GitHub/HACS-uitgave

- Bestaande complete BBQ-bereidingsplanner v4 opgenomen zonder wijzigingen aan de HTML-functionaliteit.
- Home Assistant-dashboardbridge verpakt voor HACS met alle benodigde bestanden in `dist/`.
- De dashboard-JavaScriptmodule heet nu `bbq_planner_card.js`, gelijk aan de naam van de GitHub-repository.
- Afzonderlijke voorbeeld- en livemeldingen blijven behouden; geen externe API-sleutels nodig.
- GitHub Actions HACS-validatie toegevoegd.