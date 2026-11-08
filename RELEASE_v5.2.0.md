# BBQ Planner v5.2.0 — Rustige mobiele kookassistent

**Status: releasekandidaat in draft PR #36. Niet gemerged, niet getagd, niet gepubliceerd.**
Basis: `main` `d962e4e8ae5d93e117ca1737fb357acfbd9bbe24` (gepubliceerde app v5.1.1; v6.0.0-beta.1 als losse preview).

Let op: een merge van deze PR publiceert `dist/` direct via GitHub Pages. Merge daarom alleen samen met een expliciet publicatieakkoord.

## Status per onderdeel
Drie niveaus, bewust gescheiden:
- **Technisch geïmplementeerd** — code staat in deze PR.
- **Geautomatiseerd getest** — gecontroleerd in jsdom- of Playwright-tests (Chromium en WebKit, gesimuleerde schermbreedtes en gesimuleerde safe area). Dit is geen test op een echt apparaat.
- **Fysiek bevestigd** — gecontroleerd op een echte iPhone, in de Home Assistant-kaart of met een echte MEATER. **Voor v5.2.0 is nog niets fysiek bevestigd.**

| Onderdeel | Technisch geïmplementeerd | Geautomatiseerd getest | Fysiek bevestigd |
|---|---|---|---|
| iPhone-statusbalk / safe area (kop, terugknop, Live-statusbalk, focusmodus, onderste balk) | Ja | Ja, met **gesimuleerde** safe area (59 px boven) in Chromium en WebKit | **Nee** — nog te testen op een echte iPhone (Safari en beginscherm-app) |
| Vandaag met één hoofdactie, lijst zonder onjuiste lijstrol | Ja | Ja (DOM + browser) | Nee |
| Live: statusregel, NU DOEN, kamadokaarten, drie vervolgtaken, uitklappers en scroll behouden | Ja | Ja (DOM + browser) | Nee |
| MEATER-grafiek en focusmodus bereikbaar vanuit Live én Meer | Ja | Ja (DOM + browser); geen echte meetwaarden | Nee — echte MEATER/HA nog open |
| Terugknop noemt altijd de werkelijke bestemming (Live → MEATER → Live; Meer → MEATER → Meer; Vandaag → onderdeel → Vandaag) | Ja | Ja (DOM + browser) | Nee |
| Recepten: tools achter één uitklapper; import/export/sync aanwezig | Ja | Ja (aanwezigheid en tabs) | Nee |
| Meer in vier groepen; boodschappen, voorraad, historie, HA, opslaan/printen, app-info aanwezig | Ja | Ja (aanwezigheid en plaats) | Nee |
| Geen nieuwe opslagsleutels of schemawijziging | Ja | Ja (browsertest + CI-publicatiebewaking) | Nee — bijwerken met bestaande gebruikersdata nog open |
| v5 verwijst niet naar `v6/` of `engine/`; beschermde paden ongewijzigd | Ja | Ja (CI-publicatiebewaking met mutatietests) | n.v.t. |

## Wat verandert
- **Statusbalk iPhone (technische correctie).** De oorzaak is gevonden en verholpen: een vaste bovenmarge van 15 px overschreef de safe-area-regel, waardoor de kop onder de klok en batterij kon vallen. Alle schermen, de terugknop, de vaste Live-statusbalk en de focusmodus gebruiken nu de veilige schermrand; een donkere strook achter de statusbalk voorkomt dat tekst eronder doorscrollt. In gesimuleerde tests staat de kop onder de statusbalk; **op een echte iPhone is dit nog niet bevestigd**, dus dit is nog geen bewezen praktijkoplossing.
- **Vandaag:** één duidelijke hoofdactie. Met een actieve sessie staat **Hervat live bereiding** centraal (met voortgang); anders **Nieuwe BBQ-sessie**. Recepten, historie en een nieuwe sessie staan als compacte lijst eronder.
- **Live:** vaste statusregel (serveertijd, resterende tijd, voortgang), **NU DOEN** als enige oranje hoofdactie, compacte kamadokaarten die je in één tik naar de bereidingsdetails brengen, de eerstvolgende **drie** handelingen (rest via *Toon alle*), uitklapbare details en een overzichtelijk blok met MEATER & focus, planning, voorbereiding en sessie afronden.
- **Recepten:** compacte brontabs; importeren, exporteren en synchroniseren van je bibliotheek staan achter één uitklapper, zodat je recepten zelf eerst zichtbaar zijn.
- **Meer:** vier groepen (Koken, Koppelingen, Gegevens, App en info) met snelkeuzeknoppen. Alle bestaande onderdelen blijven aanwezig; uitleg en voedselveiligheid staan onder *App en info*.
- **Terugknop:** rustiger in oudere schermen en noemt altijd waar je heen gaat. MEATER via Meer → **← Meer** (terug op dezelfde plek in Meer), daarna naar Vandaag of Live waar je vandaan kwam; planning vanuit stap 2 → **← Plan de BBQ-dag**. De onderste navigatie blijft de hoofdnavigatie.

## Wat niet verandert
- v4-kookengine, berekeningen, taakstatussen en tijdregistratie.
- localStorage-sleutels en dataschema's, recepten, reviews, bereidingshistorie, import/export.
- Home Assistant- en MEATER-koppeling.
- De afzonderlijke v6-preview (`v6/preview.html`), optimizer, conceptopslag en herstel.
- Geen datamigratie.

## Validatie
- **Publicatiebewaking (CI):** `tests/v5-publication-guard.mjs` met contract `.github/publication-guard.json` vergelijkt met de vaste PR-base en faalt bij wijzigingen in `engine/**` of `v6/**`, niet-toegestane productiebestanden, productiewijziging zonder nieuwe appversie, verwijzingen of laders naar v6/engine (ook dynamische imports, gecodeerde paden, scriptinjectie en de service-worker-shell) en gewijzigde opslagsleutels, berichttypen of opslag-/schemaregels. `tests/v5-publication-guard-negative.mjs` bewijst met 25 mutaties dat elke verboden wijziging faalt.
- **Browser:** `tests/v520-mobile-ux.mjs` (Chromium + WebKit, 320/375/390/430/768/1280 px) met gesimuleerde iPhone-safe-area, inclusief de heen- en terugroutes naar MEATER en de focusmodus.
- **DOM:** `tests/v520-nav-smoke.mjs` (terugbestemming, actieve navigatie, lijstsemantiek, geen nieuwe opslagsleutels) en de bestaande v5-/v501-/v510-smoketests; `v510-smoke` verwacht drie zichtbare vervolgstappen en de werkelijke terugbestemming vanuit stap 2.
- Bestaand: `mobile-bounds`, v6-browser-, PWA-, versie- en HACS-validatie.
- Zie PR #36 voor de CI-uitslag op de laatste HEAD. **Een browsertest is geen echte iPhone-, Home Assistant- of MEATER-test.**

## Nog te testen op echte apparaten (vóór publicatie)
- iPhone als geïnstalleerde app (beginscherm) én in Safari, met notch/Dynamic Island: geen overlap met de statusbalk, onderste balk boven de home-indicator, terugknop en focusmodus.
- Bestaande gegevens na de update (planning, recepten, reviews, voorraad, boodschappenlijst) en het bijwerken van de app-cache.
- Home Assistant-dashboardkaart (iframe) en echte MEATER-metingen.
