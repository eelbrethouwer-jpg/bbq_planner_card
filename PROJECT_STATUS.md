# PROJECT_STATUS — BBQ Planner

> **Momentopname:** gecontroleerd op 23 oktober 2026 via GitHub. Dit bestand is een overdracht voor nieuwe chats, geen live statusmonitor. Controleer altijd de huidige repository, releases, pull requests en CI voordat je werkzaamheden begint.

## Huidige status (geverifieerd op GitHub)
- **Repository:** [eelbrethouwer-jpg/bbq_planner_card](https://github.com/eelbrethouwer-jpg/bbq_planner_card), standaardbranch `main`.
- **Laatste gepubliceerde release:** [v4.9.0 – App Edition](https://github.com/eelbrethouwer-jpg/bbq_planner_card/releases/tag/v4.9.0), gepubliceerd 22 oktober 2026.
- **Laatste gecontroleerde main-commit vóór dit statusbestand:** `5420699efe` (afgekort).
- **CI bij die commit:** HACS-validatie geslaagd; GitHub Pages-build geslaagd, volgens GitHub Actions.
- **Werkelijk geïnstalleerde HACS-versie, iPhone-PWA-installatie en handmatige apparaat-/MEATER-test:** **niet bevestigd**.
- Bij controle waren geen open GitHub-issues zichtbaar.

## Functionele basis
- Planning voor grote en kleine kamado, gezamenlijke serveermomenten, draaiboek, recepten en reviews.
- MEATER Pro/Plus-livegegevens **alleen via de Home Assistant-dashboardkaart**. De publieke PWA heeft geen directe live-MEATER-koppeling.
- Receptenbibliotheek, import/catalogus, ingrediënten/boodschappenlijst, kamadoverdeling en kookmodus volgens repositorydocumentatie en gepubliceerde releases.
- v4.9.0: installeerbare publieke Progressive Web App met app-icoon, vaste navigatie en beperkte offline-ondersteuning.
- **Data-opslag:** publieke site/PWA lokaal in browser; Home Assistant heeft eigen gebruikersgebonden synchronisatie. **Geen automatische synchronisatie tussen die twee omgevingen.**

## Belangrijkste bronbestanden
- `dist/BBQ_bereidingsplanner_MEATER_v4.html` – zelfstandige planner.
- `dist/bbq_planner_card.js` – Home Assistant-dashboardbrug.
- `index.html`, `manifest.webmanifest`, `sw.js` – publieke website/PWA.
- `tests/`, `.github/workflows/validate.yml` – automatische controles.
- Release-informatie: [GitHub Releases](https://github.com/eelbrethouwer-jpg/bbq_planner_card/releases) en `RELEASE_v*.md`.

## Open punten en risico's
1. Praktijktest van iPhone-PWA: installeren, bijwerken, offline en bestaande lokale gegevens behouden (**niet door mij vastgesteld**).
2. Praktijktest van Home Assistant, MEATER Pro/Plus en recepten-/reviewgegevens bij herladen (**niet door mij vastgesteld**).
3. README en CHANGELOG bevatten oudere releasekandidaatstatussen; bij een volgende documentatie-update synchroniseren met de werkelijk gepubliceerde releases.
4. Wens of noodzaak voor extra functies eerst toetsen aan eenvoud, stabiliteit en onderhoud.

## Eerstvolgende actie
Controleer actuele GitHub-main/release/CI en vraag welke concrete functie of bug als volgende aan de beurt is. Leg vóór bouw acceptatiecriteria vast. Werk bij codewijzigingen bij voorkeur via branch en PR, met regressietests en een overzicht van risico's. Publicatie gebeurt apart.

## ChatGPT-werkwijze
- **Eén nieuwe chat per release, bugfix of afgebakende taak**, binnen het bestaande ChatGPT-project BBQ Planner; oude chats blijven naslag.
- Nieuwe chat: lees dit bestand, controleer de GitHub-werkelijkheid en vat alleen relevante context samen.
- Afsluiting: wat uitgevoerd is, wat getest is, wat onzeker is, open punten en volgende actie. Werk dit statusbestand bij als de werkelijkheid is veranderd.
- Markeer expliciet **Geverifieerd / Aanname / Advies / Openstaand**. Claim geen implementatie, installatie, test of publicatie zonder bevestiging.

## Werk in uitvoering — v5.0.0 (24 oktober 2026)
- **Branch:** `feature/v5-cooking-experience`. Geen merge naar `main`, geen nieuwe GitHub-release.
- **Nieuw:** welkom, sessiewizard, receptselectie, planning, checklist, compact live-kookdashboard, vier knoppen onderaan, herbruikbare v4-calculator, veilige backup bij nieuwe sessie.
- **Broncode:** `dist/bbq-v5.js` en `dist/bbq-v5.css`; bestaande `dist/BBQ_bereidingsplanner_MEATER_v4.html` gebruikt deze bestanden met een kleinschalige brug naar de v4-engine.
- **Tests:** `tests/v5-smoke.mjs` toegevoegd; CI-uitslag van de uiteindelijke branchcommit controleren (tussenliggende commits kunnen tijdelijk rode runs tonen).
- **Beperkingen:** MEATER uitsluitend live in Home Assistant, geen automatische sync publieke PWA↔HA, live stappen en kooktijden blijven advies, geen volledig nieuwe reviewinterface.
- **Acceptatie:** na groene CI handmatig iPhone Safari/PWA en Home Assistant testen, dan pas pull request goedkeuren en release publiceren.
- Zie `RELEASE_v5.0.0.md` voor het concrete overzicht en resterende handmatige testen.
