# PROJECT_STATUS — BBQ Planner

> **Momentopname 7 november 2026** vóór de v5.1.2-docs-PR. Controleer GitHub live. Oude versiestatussen zijn bewaard in [het historisch archief](docs/PROJECT_STATUS_ARCHIVE_2026-11-07.md).

## Huidige status
- **Gepubliceerde release: v5.1.1** — [Kookfuncties weer bereikbaar](https://github.com/eelbrethouwer-jpg/bbq_planner_card/releases/tag/v5.1.1).
- **Gecontroleerde main-SHA bij de start:** 2eede6c5a9c693ac9ea0a838ee81e66af3698a74. Tag v5.1.1 verwijst naar de geteste appmerge 8afb5a89c7d2af975f6cddcbb97598682906e543.
- HACS, JavaScript/PWA, DOM, Chromium/WebKit, GitHub Pages en releaseworkflow waren bij de controle geslaagd.
- **In voorbereiding: v5.1.2** — documentatie-/samenwerkingsbasis op docs/v5.1.2-ai-collaboration-workflow; nog geen merge, appversie of publicatie.
- Geïnstalleerde HACS- en iPhone-PWA-versie onbekend; hardwaretests niet bevestigd.

## Functionaliteit en grenzen
- Bereidingsplanning, grote/kleine kamado, recepten, reviews, boodschappen, tijdlijn en één v5-ondernavigatie.
- v5.1.1 herstelt toegang tot MEATER-grafiek en focusmodus vanuit Live; automatisch getest.
- Publieke PWA heeft geen live HA/MEATER en geen automatische synchronisatie met de HA-kaart; opslagstructuren blijven ongewijzigd.

## Nog open
1. Echte iPhone Safari/PWA-update, gebruikersdata, HA/HACS, iPad/desktop en VoiceOver.
2. **MEATER Pro/Plus-hardwaretest voorlopig niet mogelijk**; alleen expliciet gesimuleerde testdata mag worden gebruikt.
3. Eenmalige release-workflow verdient later afzonderlijk opschonen; geen wijziging in deze docs-PR.

## Samenwerking en volgende stap
- [AI-werkwijze](docs/AI_WORKFLOW.md), [overdracht](docs/PROJECT_HANDOFF.md), [PR-template](.github/PULL_REQUEST_TEMPLATE.md).
- ChatGPT implementeert; Claude reviewt onafhankelijk de PR-code; gebruiker geeft merge-/releaseakkoord.
- Laat eerst de v5.1.2-docs-PR toetsen, met een onafhankelijke review. **Niet mergen/releasen zonder akkoord.**
- Voorstel daarna: v5.2.0 mobiel Live, v5.3.0 kamado-planning, v5.4.0 recepten en leren.
