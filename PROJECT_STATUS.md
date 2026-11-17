# PROJECT_STATUS — BBQ Planner

Dit is het **enige actieve projectstatus- en overdrachtsdocument** voor de regisseur (Claude in de chat) en de bouwer (Claude Code). Historische feiten hieronder zijn gedateerd; controleer vóór iedere nieuwe opdracht de actuele GitHub-repository, releases, PR's, CI en broncode.

## Ontwikkelstatus (17 november 2026)
- Repository: [eelbrethouwer-jpg/bbq_planner_card](https://github.com/eelbrethouwer-jpg/bbq_planner_card).
- `main` staat op `7b40390b0752461838f8f61ddd99625e853477b5` (merge PR #48: vaste release-workflow + publicatie v5.5.1; app-code **v5.5.1**).
- Release **v5.5.1** (kaart op volledig scherm): **gepubliceerd en geverifieerd** via `.github/workflows/release.yml` — tag `v5.5.1` → `7b40390b0752461838f8f61ddd99625e853477b5`, [release v5.5.1](https://github.com/eelbrethouwer-jpg/bbq_planner_card/releases/tag/v5.5.1), gepubliceerd op 17 november 2026 om 17:20 UTC (geverifieerd door de regisseur). Dit is de eerste publicatie via de vaste releaseworkflow.
- Release **v5.5.0** (bevat v5.3.0, v5.4.0 en v5.5.0): **gepubliceerd en geverifieerd** — tag `v5.5.0` → `af9cf3fc730a9c5950fbd99f38aeb2fa9ebfbf20`, [release v5.5.0](https://github.com/eelbrethouwer-jpg/bbq_planner_card/releases/tag/v5.5.0), gepubliceerd op 17 november 2026 om 16:19 UTC (geverifieerd door de regisseur). v5.3.0 en v5.4.0 zijn niet afzonderlijk gepubliceerd.
- Laatste gepubliceerde GitHub-release: v5.5.1 (hierboven). Daarvoor: v5.5.0 en v5.2.3 (9 november 2026).
- PR #47 (v5.5.1, kaart op volledig scherm) is **gemerged** (merge-SHA `c214f064ca856ff2ea602c2b076ae348b4dc00ad`); PR #48 (vaste release-workflow + publicatie v5.5.1) is **gemerged** (merge-SHA `7b40390b0752461838f8f61ddd99625e853477b5`).
- In uitvoering: **draft-PR "Meldingen op je telefoon" (v5.6.0)**, branch `feat/v5.6.0-meldingen` vanaf `7b40390b0752461838f8f61ddd99625e853477b5`. Telefoon automatisch voorstellen (`notify.mobile_app_*` via het nieuwe berichttype `bbq-ha-notify-targets-v1`), één regel in stap 2 en op Live, testmelding, meldingen bij aansteken, erop leggen, fasedoel, 5 min vóór en bij het doel, stall, rust voorbij en meting weg. Review van de regisseur: GO. Releaseakkoord van de eigenaar op 17 november 2026; `RELEASE_v5.6.0.md` bevat de goedkeuringsregel, dus mergen publiceert v5.6.0 via `release.yml` (nog niet geverifieerd).
- **Releaseproces (vanaf v5.5.1):** de vaste workflow `release.yml` publiceert na een groene CI op `main` alleen als `RELEASE_vX.Y.Z.md` de regel `Publicatie: goedgekeurd door de eigenaar op JJJJ-MM-DD` bevat en de versie hoger is dan de nieuwste release. **Die regel komt alleen in een PR na een expliciet releaseakkoord van de gebruiker; mergen van zo'n PR = publiceren.** Zonder regel, of bij een latere merge met dezelfde versie, publiceert hij niets. Zie stap 7 in [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md).
- Nieuw traject: **live koken en tijdlijn** (zie roadmap hieronder). PR 0 (werkafspraken), PR 1 (v5.3.0, Live-gerechtkaart), PR 2 (v5.4.0, eigen schattingsmodule) en PR 3 (v5.5.0, tijdlijn op Live en "Zo meteen") zijn gemerged en gepubliceerd als v5.5.0. Kaart op volledig scherm (v5.5.1) is gemerged en gepubliceerd. **In uitvoering: meldingen (v5.6.0, draft-PR).**
- Keuze van de gebruiker (17 november 2026), **route 1**: koken in de Home Assistant-app op volledig scherm (een dashboard met een panel-view met alleen de planner-kaart). Zijn HA is alleen lokaal via http bereikbaar; de publieke https-website kan daarom niet met HA verbinden (mixed content).
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
| 2 | Eigen schattingsmodule `engine/eta.mjs` (Newton-opwarming, fasedoel, stall, marge, bronvolgorde) en meetgeschiedenis uit HA bij openen | 5.4.0 | gemerged (merge-SHA `948249decc1574d93f50c4141f7422d30e5b254d`) |
| 3 | Tijdlijn bovenaan Live (gepland en verwacht, nu-lijn) en een "Zo meteen"-hero op basis van de werkelijkheid; MEATER automatisch herkennen in de HA-kaart; versheid "geen verandering sinds"; bugfixes "gerecht deselecteren in stap 1" en "na wegklikken terug naar het laatste scherm" | 5.5.0 | gemerged (merge-SHA `b2992e9364331aaf5cbc9a3150f18edea6014b37`); gepubliceerd als release v5.5.0 op 17 november 2026 (tag → `af9cf3fc730a9c5950fbd99f38aeb2fa9ebfbf20`, geverifieerd) |
| na 3 | Planner-kaart op volledig scherm in een HA-panel-view: hoogte vult het scherm zonder dubbele scrollbalk, optie `fullscreen: true`/`false` in de kaart-YAML, korte installatie-instructie in README | 5.5.1 | gemerged via PR #47 (merge-SHA `c214f064ca856ff2ea602c2b076ae348b4dc00ad`); gepubliceerd via `release.yml` na PR #48 (tag `v5.5.1` → `7b40390b0752461838f8f61ddd99625e853477b5`, geverifieerd) |
| 4a | Meldingen op je telefoon: `notify.mobile_app_*` automatisch voorstellen, één regel in stap 2 en op Live, testmelding, meldingen bij aansteken, erop leggen, fasedoel, 5 min vóór/bij het doel, stall, rust voorbij en meting weg | 5.6.0 | PR #49, GO van de regisseur, releaseakkoord 17-11-2026; publicatie via `release.yml` na merge (nog niet geverifieerd) |
| — | Home Assistant koppelen op de publieke website (opt-in, HA-login via OAuth, live MEATER en meldingen in de PWA) | n.t.b. | **geparkeerd** — voorwaarde: HA via https bereikbaar (Nabu Casa of eigen domein) |
| 4b | Optioneel fasedoel `coreAt` in receptstappen (voedt de schatting, de hero en de fasemelding) | n.t.b. | gepland, na 4a |
| — | **Vervolg-idee:** een HA-automatisering of blueprint op basis van de MEATER-sensoren voor "kern bereikt", die ook werkt als de HA-app dicht is (de meldingen van v5.6.0 gaan alleen af zolang de planner open is) | n.t.b. | idee, nog niet ingepland |
| 5 | Planning eenvoudiger: kamadokeuze bij toevoegen, urgente conflicten bovenaan, "Plan opnieuw vanaf nu" | 5.7.0 | gepland |
| 6 | Opruimen: oude kookpagina en dubbele draaiboeken naar Meer → Geavanceerd, één takenlijst | 5.7.1 | gepland |

Over de publieke website: de gebruiker wil op termijn live HA-data in de PWA. Dat is een **bewuste contractwijziging** ("de publieke PWA heeft geen live HA-/MEATER-data") en komt, als de voorwaarde vervuld is, in een eigen PR. Tot die tijd blijft de contractregel ongewijzigd.

Versies zijn een plan, geen releasebelofte. Elke PR stopt na oplevering; de volgende start pas na "ga door" van de gebruiker.

## Open praktijkacceptatie
- Fysieke iPhone Safari/geïnstalleerde PWA met bestaande recepten, reviews, planning en cache-/updategedrag.
- Home Assistant/HACS op een echt apparaat: de iframe, persoonlijke synchronisatie en langdurig gebruik; iPad/desktop en VoiceOver.
- Een echte kooksessie met MEATER Pro/Plus via Home Assistant, met en zonder kooksessie in de MEATER-app. Tot die tijd alleen expliciet gelabelde fixtures, nooit als echte LIVE-metingen.
- Na PR 1: scherm blijft aan tijdens het koken (Screen Wake Lock) op een echte iPhone.
- Na PR 2: de eigen schatting tijdens een echte kooksessie (ribeye, kip, en een lange sessie met stall) en of de meetgeschiedenis bij openen echt uit Home Assistant komt (`history/history_during_period`).
- Na PR 3: met een echte MEATER in HA of de juiste probe automatisch gekoppeld wordt (ook als de andere probe uit de lader ligt), of "Geen verandering sinds HH:MM" klopt bij een stilstaande kern en of de waarde verdwijnt als de MEATER offline gaat; de leesbaarheid van de tijdlijn op een echte iPhone in de HA-app.
- Na PR 3: in de HA-app (panel-view) wisselen naar een andere app en terug: de planner staat weer op hetzelfde scherm en dezelfde plek.
- Na v5.5.1: in de HA-app op een echte iPhone, in een panel-view: de kaart vult het scherm tot onderaan, de HA-pagina scrolt niet, de onderste navigatie van de planner staat boven de thuisbalk en blijft in beeld na draaien, na het toetsenbord en na wisselen van app; `fullscreen: false` geeft het oude gedrag.
- Na v5.6.0 (iPhone, HA-app): de juiste telefoon wordt voorgesteld met de juiste naam; de testmelding komt aan en is "tijdgevoelig" (Focus-stand); de meldingen komen op het juiste moment en niet dubbel tijdens een echte kooksessie (aansteken, erop leggen, 47 °C bij reverse sear, 5 min vóór en bij het doel, rust voorbij); "meting weg" na 3 minuten als de MEATER uit bereik gaat; wat er gebeurt als het scherm op slot gaat of de app naar de achtergrond gaat (verwacht: geen meldingen).

## Start- en afsluitcheck
Controleer GitHub `main`, tag, actuele open PR's, laatste checks, releasenotities en betrokken code. Rapporteer daarna: **geverifieerde status, gemaakte wijzigingen, uitgevoerde tests, open risico's en concrete volgende stap**. Oudere projectstatus: [historisch archief](docs/PROJECT_STATUS_ARCHIVE_2026-11-07.md).
