# BBQ Planner v5.2.0 — Rustige mobiele kookassistent

**Status: releasekandidaat in draft PR #36. Niet gemerged, niet getagd, niet gepubliceerd.**
Basis: `main` `d962e4e8ae5d93e117ca1737fb357acfbd9bbe24` (gepubliceerde app v5.1.1; v6.0.0-beta.1 als losse preview).

Let op: een merge van deze PR publiceert `dist/` direct via GitHub Pages. Merge daarom alleen samen met een expliciet publicatieakkoord.

## Wat verandert
- **Statusbalk iPhone opgelost.** De app tekende zijn kop onder de klok en batterij van de iPhone (vaste 15 px bovenmarge overschreef de safe-area-regel). Alle schermen, de terugknop, de vaste Live-statusbalk en de focus-kookmodus houden nu rekening met de veilige schermrand. Een donkere strook achter de statusbalk voorkomt dat tekst eronder doorscrollt.
- **Vandaag:** één duidelijke hoofdactie. Met een actieve sessie staat **Hervat live bereiding** centraal (met voortgang); anders **Nieuwe BBQ-sessie**. Recepten, historie en een nieuwe sessie staan als compacte lijst eronder.
- **Live:** vaste statusregel (serveertijd, resterende tijd, voortgang), **NU DOEN** als enige oranje hoofdactie, compacte kamadokaarten die je in één tik naar de bereidingsdetails brengen, de eerstvolgende **drie** handelingen (rest via *Toon alle*), uitklapbare details en een overzichtelijk blok met MEATER & focus, planning, voorbereiding en sessie afronden.
- **Recepten:** compacte brontabs; importeren, exporteren en synchroniseren van je bibliotheek staan achter één uitklapper, zodat je recepten zelf eerst zichtbaar zijn.
- **Meer:** vier groepen (Koken, Koppelingen, Gegevens, App en info) met snelkeuzeknoppen. Alle bestaande onderdelen blijven aanwezig; uitleg en voedselveiligheid staan onder *App en info*.
- De terugknop in oudere schermen is rustiger; de onderste navigatie blijft de hoofdnavigatie.

## Wat niet verandert
- v4-kookengine, berekeningen, taakstatussen en tijdregistratie.
- localStorage-sleutels en dataschema's, recepten, reviews, bereidingshistorie, import/export.
- Home Assistant- en MEATER-koppeling.
- De afzonderlijke v6-preview (`v6/preview.html`), optimizer, conceptopslag en herstel. De v5-publicatie verwijst niet naar `v6/` of `engine/` (CI-controle).
- Geen datamigratie.

## Validatie
- Nieuw: `tests/v520-mobile-ux.mjs` (Chromium + WebKit, 320/375/390/430/768/1280 px) met gesimuleerde iPhone-safe-area.
- Bestaand: `mobile-bounds`, v6-browser-, PWA-, versie- en DOM-regressietests; `v510-smoke` verwacht nu drie zichtbare vervolgstappen in Live.
- Zie PR #36 voor de CI-uitslag op de laatste HEAD. Een browsertest is geen echte iPhone-, Home Assistant- of MEATER-test.

## Nog te testen op echte apparaten
- iPhone als geïnstalleerde app (beginscherm) en in Safari: geen overlap met de statusbalk, onderste balk boven de home-indicator, focusmodus.
- Bestaande gegevens na de update (planning, recepten, reviews) en het bijwerken van de app-cache.
- Home Assistant-dashboardkaart (iframe) en echte MEATER-metingen.
