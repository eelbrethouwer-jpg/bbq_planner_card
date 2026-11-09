# PROJECT_STATUS — BBQ Planner

Dit is het **enige actieve projectstatus- en overdrachtsdocument** voor ChatGPT en Claude. Historische feiten hieronder zijn gedateerd; controleer vóór iedere nieuwe opdracht de actuele GitHub-repository, releases, PR's, CI en broncode. Geen enkele kopie wordt automatisch bijgewerkt.

## Geverifieerde uitgangspositie (9 november 2026)
- Repository: [eelbrethouwer-jpg/bbq_planner_card](https://github.com/eelbrethouwer-jpg/bbq_planner_card).
- Laatste officiële release: [v5.2.0](https://github.com/eelbrethouwer-jpg/bbq_planner_card/releases/tag/v5.2.0), tag exact op codecommit `7c6bd8a542049727a43e6f34b5c09629e909a78b`.
- Startpunt huidige ontwikkelbranch: main `61f12bb80e56a16103bcee266c85042b50c7623f` (alle CI groen, eenmalige v5.2.0-releaseworkflow reeds uitgevoerd).
- Werk in uitvoering: **v5.2.1 — Versie in beeld**, uitsluitend UI-versielabel en bijbehorende versie-/cache-/test-/documentatie-updates. Nog niet gereleased.
- De gebruiker zag eerder HACS v5.1.1; daadwerkelijke installatie van v5.2.0 in Home Assistant is nog niet door hem bevestigd.
- Praktijkacceptatie van PWA-upgrade met bestaande eigen data en echte Home Assistant/MEATER-metingen blijft open.

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
