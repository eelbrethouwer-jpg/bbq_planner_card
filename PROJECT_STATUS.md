# PROJECT_STATUS — BBQ Planner

Dit is het **enige actieve projectstatus- en overdrachtsdocument** voor ChatGPT en Claude. Historische feiten hieronder zijn gedateerd; controleer vóór iedere nieuwe opdracht de actuele GitHub-repository, releases, PR's, CI en broncode. Geen enkele kopie wordt automatisch bijgewerkt.

## Geverifieerde uitgangspositie (9 november 2026)
- Repository: [eelbrethouwer-jpg/bbq_planner_card](https://github.com/eelbrethouwer-jpg/bbq_planner_card).
- Laatste geverifieerde GitHub-release: [v5.2.1](https://github.com/eelbrethouwer-jpg/bbq_planner_card/releases/tag/v5.2.1).
- Basis voor v5.2.2: `main` `529f4b827b9d4a3d78e07069b42d61097010bc03`.
- Branch: `feature/v5.2.2-meater-live-second-indicator`, wijzigingen aan Live MEATER-verversing. De gebruiker gaf toestemming voor merge en release **onder voorwaarde van groene checks en daadwerkelijke gereedheid**.
- Een Home Assistant-bericht vernieuwt alleen de sensorvakken in Live; per seconde verandert alleen de leeftijdsaanduiding. Geen nieuwe sensormetingen per seconde: officiële HA-MEATER-uitlezing blijft circa 30 seconden.
- De actuele HACS-installatie en echte iPhone/MEATER-functionaliteit zijn niet op hardware getest; in CI zijn de tests simulaties.

## Functionele basis
- Planning voor grote en kleine kamado, gezamenlijke serveertijd, voorbereidingen, taken, receptenbibliotheek/import, reviews, boodschappenlijst en historie.
- Eén zichtbare v5-navigatie; vanaf Live bereikbaar: de bestaande MEATER-grafiek en focusmodus (in v5.1.1 automatisch getest).
- De publieke PWA heeft geen toegang tot live HA-/MEATER-sensoren. Alleen de ingelogde Home Assistant-kaart kan verse live waarden tonen; publieke PWA en HA-opslag synchroniseren niet automatisch.
- De bestaande opslagcontracten en localStorage-sleutels mogen niet stilzwijgend worden gewijzigd.

## Werkafspraken
- Centrale [AI-werkwijze](docs/AI_WORKFLOW.md): ChatGPT bouwt op een afgesproken SHA, Claude reviewt onafhankelijk de echte diff en GitHub-checks, gebruiker autoriseert merge en release expliciet.
- [PR-template](.github/PULL_REQUEST_TEMPLATE.md): scope, acceptatiecriteria, bewijs, regressietests, herstel-SHA en reviewstatus.
- Geen automatische directe communicatie tussen ChatGPT en Claude. Geef de ander een PR-link en de gecontroleerde commit-SHA; vervang GitHub-bewijs nooit door een AI-samenvatting.
- Houd deze status bij als het werk inhoudelijk verandert. Feiten uit oude PR's worden historisch gedateerd en mogen niet als huidige werkstatus worden gepresenteerd.

## Open praktijkacceptatie
- Fysieke iPhone Safari/geïnstalleerde PWA met bestaande recepten, reviews, planning en cache-/updategedrag.
- Home Assistant/HACS op een echt apparaat: de iframe, persoonlijke synchronisatie en langdurig gebruik; iPad/desktop en VoiceOver.
- MEATER Pro/Plus-hardware is momenteel niet beschikbaar voor een echte test. Simuleer met expliciet gelabelde fixtures, nooit als echte LIVE-metingen.
- Aparte toekomstige verbeteringen: herbruikbare gecontroleerde releaseworkflow en GitHub-ruleset/environment. Niet combineren met documentatieherstel.

## Productroadmap (advies, geen vastgestelde releasebeloftes)
1. Live-kookervaring op iPhone verder verbeteren, inclusief praktijkacceptatie.
2. Planning van meerdere gerechten/kamado's en gezamenlijke serveertijd verbeteren.
3. Receptkwaliteit, import, reviews en leren van bereidingen verbeteren.
4. Echte MEATER-hardwareacceptatie zodra beschikbaar.

## Start- en afsluitcheck
Controleer GitHub `main`, tag, actuele open PR's, laatste checks, releasenotities en betrokken code. Rapporteer daarna: **geverifieerde status, gemaakte wijzigingen, uitgevoerde tests, open risico's en concrete volgende stap**. Oudere projectstatus: [historisch archief](docs/PROJECT_STATUS_ARCHIVE_2026-11-07.md).
