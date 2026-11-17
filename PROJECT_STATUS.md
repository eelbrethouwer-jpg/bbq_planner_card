# PROJECT_STATUS — BBQ Planner

Dit is het **enige actieve projectstatus- en overdrachtsdocument** voor de regisseur (Claude in de chat) en de bouwer (Claude Code). Historische feiten hieronder zijn gedateerd; controleer vóór iedere nieuwe opdracht de actuele GitHub-repository, releases, PR's, CI en broncode.

## Ontwikkelstatus (17 november 2026)
- Repository: [eelbrethouwer-jpg/bbq_planner_card](https://github.com/eelbrethouwer-jpg/bbq_planner_card).
- `main` staat op `7cdc4b6c747b1b215eabe01d1c7f7c07dcaf04d1` (merge PR #43, PR 1 Live-gerechtkaart; code v5.3.0, niet gepubliceerd).
- Laatste gepubliceerde GitHub-release: [v5.2.3 — Rustig Live-scherm](https://github.com/eelbrethouwer-jpg/bbq_planner_card/releases/tag/v5.2.3), gepubliceerd op 9 november 2026.
- Nieuw traject: **live koken en tijdlijn** (zie roadmap hieronder). PR 0 (werkafspraken) en PR 1 (v5.3.0, Live-gerechtkaart) zijn gemerged. PR 2 (v5.4.0, eigen schattingsmodule) staat als draft-PR open voor review.
- De officiële Home Assistant-MEATER-integratie leest ongeveer iedere 30 seconden uit de MEATER Cloud. Zonder kooksessie in de MEATER-app komen alleen kern- en omgevingstemperatuur binnen. Vanuit HA kun je geen doel instellen en geen kooksessie starten.
- Geen echte iPhone-, Home Assistant- of MEATER-hardwaretest in de CI.

## Rolwissel (17 november 2026)
De gebruiker heeft de rollen veranderd. ChatGPT doet niet meer mee.

| Rol | Wie |
| --- | --- |
| Regie + onafhankelijke review | Claude in de chat (claude.ai) |
| Bouwer | Claude Code |
| Eigenaar, akkoord voor merge en release | De gebruiker |

De werkwijze staat in [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md). Oudere documenten noemen ChatGPT als bouwer; dat is historisch juist.

## Functionele basis
- Planning voor grote en kleine kamado, gezamenlijke serveertijd, voorbereidingen, taken, receptenbibliotheek/import, reviews, boodschappenlijst en historie.
- Eén zichtbare v5-navigatie; vanaf Live bereikbaar: de bestaande MEATER-grafiek en focusmodus.
- De publieke PWA heeft geen toegang tot live HA-/MEATER-sensoren. Alleen de ingelogde Home Assistant-kaart kan verse live waarden tonen; publieke PWA en HA-opslag synchroniseren niet automatisch.
- De bestaande opslagcontracten en localStorage-sleutels mogen niet stilzwijgend worden gewijzigd.

## Werkafspraken
- Claude Code bouwt per PR op een eigen branch vanaf een gecontroleerde `main`-SHA en opent een draft-PR met de volledig ingevulde [PR-template](.github/PULL_REQUEST_TEMPLATE.md).
- De regisseur leest de PR, de diff en de CI zelf op GitHub en plaatst de review als PR-commentaar. De bouwer verwerkt de punten op dezelfde branch en reageert per punt met de commit-SHA.
- De gebruiker geeft expliciet akkoord voor merge en release. Een GO of groene CI is geen akkoord.
- Regisseur en bouwer delen geen geheugen en synchroniseren niet automatisch. GitHub is de gedeelde bron; een AI-samenvatting vervangt nooit de echte diff of CI.
- Houd deze status bij als het werk inhoudelijk verandert. Feiten uit oude PR's worden historisch gedateerd.

## Bescherming van `main`
- Geverifieerd via de GitHub API op 17 november 2026: klassieke branch protection staat **uit**, maar de repository-ruleset **"protect main"** (id 25796654) is **actief** op de standaardbranch. Die vraagt een PR (0 goedkeuringen nodig), blokkeert force-push en verwijderen, en eist de checks `validate-hacs`, `ui-smoke`, `mobile-browser`, `html-javascript` en `version-consistency`. Er zijn geen bypass-actors.
- **Advies:** houd deze ruleset actief (PR verplicht, CI verplicht). Overweeg daarnaast "Require branches to be up to date" (strict) aan te zetten, zodat de CI altijd op de actuele `main` draait. De bouwer en de regisseur passen deze instellingen niet zelf aan; dat doet de gebruiker.

## Roadmap: live koken en tijdlijn
Doel van de gebruiker: alles in deze app doen, niet in de MEATER-app. Live beantwoordt in één blik: wat moet ik nu doen, hoe ver is elk gerecht, halen we de serveertijd. De app wijzigt de planning nooit stilzwijgend.

| PR | Inhoud | Beoogde versie | Status |
| --- | --- | --- | --- |
| 0 | Werkafspraken bijwerken (alleen documentatie) | geen bump | gemerged (merge-SHA `357252b78c9136d35d0868e4ad6b3ad4f8de7e06`) |
| 1 | Live-gerechtkaart per gerecht met schatting, bron en één coachregel; thermometer koppelen in stap 2; Screen Wake Lock | 5.3.0 | gemerged (merge-SHA `7cdc4b6c747b1b215eabe01d1c7f7c07dcaf04d1`) |
| 2 | Eigen schattingsmodule `engine/eta.mjs` (Newton-opwarming, fasedoel, stall, marge, bronvolgorde) en meetgeschiedenis uit HA bij openen | 5.4.0 | draft-PR |
| 3 | Tijdlijn bovenaan Live (gepland en verwacht, nu-lijn) en een "Zo meteen"-hero op basis van de werkelijkheid | 5.5.0 | gepland |
| 4 | Optioneel fasedoel `coreAt` in receptstappen en meldingen via `notify.mobile_app_*` | 5.6.0 | gepland |
| 5 | Planning eenvoudiger: kamadokeuze bij toevoegen, urgente conflicten bovenaan, "Plan opnieuw vanaf nu" | 5.7.0 | gepland |
| 6 | Opruimen: oude kookpagina en dubbele draaiboeken naar Meer → Geavanceerd, één takenlijst | 5.7.1 | gepland |

Versies zijn een plan, geen releasebelofte. Elke PR stopt na oplevering; de volgende start pas na "ga door" van de gebruiker.

## Open praktijkacceptatie
- Fysieke iPhone Safari/geïnstalleerde PWA met bestaande recepten, reviews, planning en cache-/updategedrag.
- Home Assistant/HACS op een echt apparaat: de iframe, persoonlijke synchronisatie en langdurig gebruik; iPad/desktop en VoiceOver.
- Een echte kooksessie met MEATER Pro/Plus via Home Assistant, met en zonder kooksessie in de MEATER-app. Tot die tijd alleen expliciet gelabelde fixtures, nooit als echte LIVE-metingen.
- Na PR 1: scherm blijft aan tijdens het koken (Screen Wake Lock) op een echte iPhone.
- Na PR 2: de eigen schatting tijdens een echte kooksessie (ribeye, kip, en een lange sessie met stall) en of de meetgeschiedenis bij openen echt uit Home Assistant komt (`history/history_during_period`).
- Na PR 4: meldingen komen echt aan op de telefoon via `notify.mobile_app_*`.

## Start- en afsluitcheck
Controleer GitHub `main`, tag, actuele open PR's, laatste checks, releasenotities en betrokken code. Rapporteer daarna: **geverifieerde status, gemaakte wijzigingen, uitgevoerde tests, open risico's en concrete volgende stap**. Oudere projectstatus: [historisch archief](docs/PROJECT_STATUS_ARCHIVE_2026-11-07.md).
