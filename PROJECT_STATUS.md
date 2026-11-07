# PROJECT_STATUS — BBQ Planner

Dit is het **enige actieve projectstatus- en overdrachtsdocument** voor ChatGPT en Claude. Historische feiten hieronder zijn gedateerd; controleer vóór iedere nieuwe opdracht de actuele GitHub-repository, releases, PR's, CI en broncode. Geen enkele kopie wordt automatisch bijgewerkt.

## Geverifieerde uitgangspositie (7 november 2026)
- Repository: [eelbrethouwer-jpg/bbq_planner_card](https://github.com/eelbrethouwer-jpg/bbq_planner_card).
- Op die datum was de nieuwste gecontroleerde GitHub Release [v5.1.1](https://github.com/eelbrethouwer-jpg/bbq_planner_card/releases/tag/v5.1.1). Release-tag/codecommit: `8afb5a89c7d2af975f6cddcbb97598682906e543`.
- De gecontroleerde main-SHA was `2eede6c5a9c693ac9ea0a838ee81e66af3698a74`. Die bevat naast de appcode de latere eenmalige releaseworkflow.
- Automatische controles voor deze main-commit waren geslaagd: [HACS + JavaScript/PWA + DOM + mobiele Chromium/WebKit](https://github.com/eelbrethouwer-jpg/bbq_planner_card/actions/runs/42359067347), SHA `2eede6c5a9c693ac9ea0a838ee81e66af3698a74`; [GitHub Pages-deployment](https://github.com/eelbrethouwer-jpg/bbq_planner_card/actions/runs/42359066971), dezelfde SHA; [releaseworkflow](https://github.com/eelbrethouwer-jpg/bbq_planner_card/actions/runs/42359067365), dezelfde SHA.
- De actuele CI en huidige PR-lijst na deze gedateerde controle zijn **niet herverifieerd** in dit document. Lees hun live status bij iedere nieuwe taak.
- Geïnstalleerde HACS-/PWA-versie bij de gebruiker: onbekend.

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
