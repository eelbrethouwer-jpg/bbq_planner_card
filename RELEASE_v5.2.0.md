# BBQ Planner v5.2.0 — Rustige mobiele kookassistent

**Status: releasekandidaat in draft PR #36. Niet gemerged, niet getagd, niet gepubliceerd.**
Basis: `main` `d962e4e8ae5d93e117ca1737fb357acfbd9bbe24` (gepubliceerde app v5.1.1; v6.0.0-beta.1 als losse preview).

Let op: een merge van deze PR publiceert `dist/` direct via GitHub Pages. Merge daarom alleen samen met een expliciet publicatieakkoord.

## Status per onderdeel
Drie niveaus, bewust gescheiden:
- **Technisch geïmplementeerd** — code staat in deze PR.
- **Geautomatiseerd getest** — gecontroleerd in jsdom- of Playwright-tests (Chromium en WebKit, gesimuleerde schermbreedtes en gesimuleerde safe area). Dit is geen test op een echt apparaat.
- **Fysiek bevestigd** — gecontroleerd op een echte iPhone, in de Home Assistant-kaart of met een echte MEATER. **Voor v5.2.0 is een deel van de iPhone-beginscherm-app fysiek bevestigd door de gebruiker (8 november 2026).** Dit is geen volledige Safari-, PWA-upgrade-, HA- of MEATER-acceptatie.

| Onderdeel | Technisch geïmplementeerd | Geautomatiseerd getest | Fysiek bevestigd |
|---|---|---|---|
| iPhone-statusbalk / safe area (kop, terugknop, Live-statusbalk, focusmodus, onderste balk) | Ja | Ja, met **gesimuleerde** safe area (59 px boven) in Chromium en WebKit | **Deels** — Dynamic Island, kop en ondernavigatie visueel goed in geïnstalleerde iPhone-beginscherm-app; Safari apart en focusmodus niet volledig fysiek gevalideerd |
| Vandaag met één hoofdactie, lijst zonder onjuiste lijstrol | Ja | Ja (DOM + browser) | **Deels** — startscherm visueel op iPhone bevestigd; niet alle acties afzonderlijk getest |
| Live: statusregel, NU DOEN, kamadokaarten, drie vervolgtaken, uitklappers en scroll behouden | Ja | Ja (DOM + browser) | **Deels** — cockpit, kamadokaarten, vervolgtaken en ondoorzichtige statusbalk visueel bevestigd; niet alle acties/uitklappers afzonderlijk uitgevoerd |
| MEATER-grafiek en focusmodus bereikbaar vanuit Live én Meer | Ja | Ja (DOM + browser); geen echte meetwaarden | **Deels** — Meer → MEATER → Meer-route op iPhone bevestigd; echte meetwaarden en HA blijven open |
| Terugknop noemt altijd de werkelijke bestemming (Live → MEATER → Live; Meer → MEATER → Meer; Vandaag → onderdeel → Vandaag) | Ja | Ja (DOM + browser) | **Deels** — Meer → MEATER → Meer werkt op iPhone; geen zwevende terugknop meer over content na scrollen |
| Recepten: tools achter één uitklapper; import/export/sync aanwezig | Ja | Ja (aanwezigheid en tabs) | **Deels** — recept aangemaakt en teruggevonden in eigen bibliotheek; import/export en HA-sync niet fysiek getest |
| Meer in vier groepen; boodschappen, voorraad, historie, HA, opslaan/printen, app-info aanwezig | Ja | Ja (aanwezigheid en plaats) | **Deels** — groepen en openen historie visueel bevestigd; inhoudelijke reviewhistorie en overige functies niet volledig getest |
| Geen nieuwe opslagsleutels of schemawijziging | Ja | Ja (publicatiebewaking + dezelfde-origin jsdom-upgradetest van echte v5.1.1-code met fictieve gegevens) | **Deels** — planning met drie gerechten en serveertijd blijft behouden bij heropenen van de testapp; echte v5.1.1→v5.2.0-PWA-upgrade blijft open |
| v5 verwijst niet naar `v6/` of `engine/`; beschermde paden ongewijzigd | Ja | Ja (CI-publicatiebewaking met mutatietests) | n.v.t. |

## Wat verandert
- **Statusbalk iPhone (technische correctie).** De oorzaak is gevonden en verholpen: een vaste bovenmarge van 15 px overschreef de safe-area-regel, waardoor de kop onder de klok en batterij kon vallen. Alle schermen, de terugknop, de vaste Live-statusbalk en de focusmodus gebruiken nu de veilige schermrand; een donkere strook achter de statusbalk voorkomt dat tekst eronder doorscrollt. In gesimuleerde tests staat de kop onder de statusbalk; **de gebruiker heeft dit daarna visueel bevestigd in de geïnstalleerde iPhone-beginscherm-app**. Gewone Safari-browsermodus en alle focusmodusvarianten zijn nog niet afzonderlijk fysiek afgetest.
- **Vandaag:** één duidelijke hoofdactie. Met een actieve sessie staat **Hervat live bereiding** centraal (met voortgang); anders **Nieuwe BBQ-sessie**. Recepten, historie en een nieuwe sessie staan als compacte lijst eronder.
- **Live:** vaste statusregel (serveertijd, resterende tijd, voortgang), **NU DOEN** als enige oranje hoofdactie, compacte kamadokaarten die je in één tik naar de bereidingsdetails brengen, de eerstvolgende **drie** handelingen (rest via *Toon alle*), uitklapbare details en een overzichtelijk blok met MEATER & focus, planning, voorbereiding en sessie afronden.
- **Recepten:** compacte brontabs; importeren, exporteren en synchroniseren van je bibliotheek staan achter één uitklapper, zodat je recepten zelf eerst zichtbaar zijn.
- **Meer:** vier groepen (Koken, Koppelingen, Gegevens, App en info) met snelkeuzeknoppen. Alle bestaande onderdelen blijven aanwezig; uitleg en voedselveiligheid staan onder *App en info*.
- **Terugknop:** rustiger in oudere schermen en noemt altijd waar je heen gaat. MEATER via Meer → **← Meer** (terug op dezelfde plek in Meer), daarna naar Vandaag of Live waar je vandaan kwam; planning vanuit stap 2 → **← Plan de BBQ-dag**. De onderste navigatie blijft de hoofdnavigatie. Na iPhone-feedback is de terugknop bovendien **niet meer sticky**, zodat hij niet over onderliggende kaarten schuift.
- **Live-statusbalk na iPhone-feedback:** de sticky statusbalk is nu **volledig ondoorzichtig**, zodat scrollende taaktekst er niet doorheen zichtbaar blijft. Beide visuele correcties zijn door de gebruiker op de fysieke iPhone bevestigd.

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
- **Databehoud bij upgrade, gesimuleerd:** `tests/v520-data-upgrade.mjs` laadt de originele broncode van release v5.1.1, bewaart fictieve planning, datum/serveertijd, voorraad, taakstatus, recepten, verwijderingen, reviews en sessiemetadata, en controleert in jsdom dat v5.2.0 deze op dezelfde origin behoudt. **PASS op HEAD `77a7861`**. Geen fysieke iOS-serviceworker-upgradetest en geen HA-data.
- Bestaand: `mobile-bounds`, v6-browser-, PWA-, versie- en HACS-validatie.
- Zie PR #36 voor de CI-uitslag op de laatste HEAD. **Een browsertest is geen echte iPhone-, Home Assistant- of MEATER-test.**

## Praktijkacceptatie en open releasepunten (8 november 2026)

**Door gebruiker bevestigd, op een echte iPhone als geïnstalleerde beginscherm-app op geïsoleerde Cloudflare Pages-preview:**
- Vandaag: visuele indeling, Dynamic Island/statusbalk en vaste ondernavigatie zonder zichtbare overlap.
- Live: NU DOEN, kamado-overzicht, drie vervolgtaken en visuele scrollindeling.
- Meer → MEATER → Meer: juiste terugbestemming.
- Planning: drie gerechten en serveertijd 18:30 blijven bewaard na volledig afsluiten en heropenen van de previewapp.
- Receptgenerator: recept aangemaakt en zichtbaar in de eigen bibliotheek.
- De twee latere CSS-correcties: Live-statusbalk laat geen tekst doorschijnen; terugknop overlapt kaarten niet meer.

**Niet bewezen en vóór/na release afzonderlijk beoordelen:**
- Safari als normale browsertab en uitgebreide hardwarebediening van de MEATER-focusmodus.
- Bestaande v5.1.1-installatie op **dezelfde GitHub Pages-origin** bijwerken naar v5.2.0, inclusief echte serviceworker-/cache-update en behoud van eigen recepten, reviews, voorraad en planning. Cloudflare gebruikt andere opslag en is geen rechtstreekse upgradeproef.
- Ingelogde Home Assistant-dashboardkaart, HA-gebruikerssynchronisatie, MEATER Pro/Plus en verse/stale echte metingen. De publieke PWA heeft geen live HA/MEATER-verbinding.

**Operationeel te controleren:**
- De gekoppelde Cloudflare **Pages**-preview bouwt correct; de afzonderlijke eerder aangemaakte **Workers**-build verschijnt als een mislukte statuscheck. Onderzoek en schakel zo nodig uitsluitend de overbodige Workers-autobuild uit, zonder de werkende Pages-Git-koppeling te verwijderen.
- De GitHub-ruleset beschermt volgens eerdere controle alleen `validate-hacs` verplicht. Controleer daarom alle vijf jobs handmatig op exact de nieuwste HEAD en overweeg de ruleset apart uit te breiden.
- De PR is nog draft; voor merge is expliciete gebruikersgoedkeuring vereist. Een merge naar `main` wijzigt direct de publieke GitHub Pages-app. Geen tag/release zonder afzonderlijk akkoord.

**Validatiebewijs vóór deze documentatiecorrectie:** PR-run `42486180796` en push-run `42486176454`: beide 5/5 GitHub Actions-jobs PASS op `77a7861`; mobiele CI rapporteert 1.162 Chromium/WebKit-controles PASS. Bij elke volgende commit alle CI opnieuw controleren en de nieuwe HEAD als bron nemen.

**Beoordeling:** geautomatiseerde code- en mobiele UX-controles groen, iPhone UX deels fysiek bevestigd. Geen claim van volledige HA/MEATER- of PWA-upgrade-acceptatie.
