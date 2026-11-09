# PROJECT_STATUS — BBQ Planner

Dit is het **enige actieve projectstatus- en overdrachtsdocument** voor ChatGPT en Claude. Historische feiten hieronder zijn gedateerd; controleer vóór iedere nieuwe opdracht de actuele GitHub-repository, releases, PR's, CI en broncode.

## Ontwikkelstatus (9 november 2026)
- Repository: [eelbrethouwer-jpg/bbq_planner_card](https://github.com/eelbrethouwer-jpg/bbq_planner_card).
- Laatste geverifieerde gepubliceerde GitHub-release: [v5.2.2](https://github.com/eelbrethouwer-jpg/bbq_planner_card/releases/tag/v5.2.2), mergecommit `3a46b602113dfd581dc622a9316c4c328eddc513`.
- Nieuwe RC: **v5.2.3 — Rustig Live-scherm**. Featurebranch `fix/v5.2.3-live-no-30sec-redraw` vanaf gepubliceerde v5.2.2.
- 30-seconden-schermrender is vervangen door tekstupdates voor serveertijd, taakstatus en tijdstatus; 1-seconde-sensorleeftijd en directe HA MEATER-updates blijven behouden.
- Officiële Home Assistant-MEATER-integratie leest ongeveer iedere 30 seconden uit de cloud. De planner kan deze werkelijke meetfrequentie niet veranderen. Voor Pro én Plus vereist echte lokale BLE-ondersteuning afzonderlijk onderzoek.
- Geen echte iPhone/Home Assistant/MEATER hardwaretest in de CI. Geen wijzigingen aan `engine/**`, `v6/**`, opgeslagen data, recepten, reviews of HA-accountkoppeling.
- Merge/publicatie uitsluitend na GitHub-validatie van exacte RC HEAD, volgende push-CI en expliciete autorisatie.

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
