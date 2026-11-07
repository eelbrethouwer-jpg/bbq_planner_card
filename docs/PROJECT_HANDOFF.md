# Projectoverdracht — BBQ Planner

> Momentopname van 7 november 2026 **vóór** deze v5.1.2-docs-PR. Geen live synchronisatie: controleer GitHub main/releases/PR's/CI opnieuw.

## Actuele uitgangspositie
- **Repository:** eelbrethouwer-jpg/bbq_planner_card
- **Gepubliceerde release: v5.1.1** — [GitHub Release](https://github.com/eelbrethouwer-jpg/bbq_planner_card/releases/tag/v5.1.1)
- **Main bij start:** 2eede6c5a9c693ac9ea0a838ee81e66af3698a74
- **Code/tag v5.1.1:** 8afb5a89c7d2af975f6cddcbb97598682906e543; de latere main-commit bevatte de publicatieworkflow
- **Gecontroleerde CI:** HACS, JS/PWA, DOM, Chromium/WebKit, Pages en GitHub Release waren geslaagd
- **Open PR's vóór v5.1.2:** geen; check live de huidige PR-lijst
- **In voorbereiding:** v5.1.2 — Samenwerking & kwaliteit, branch docs/v5.1.2-ai-collaboration-workflow; uitsluitend documentatie en CI-documentatiecheck. **Niet gemerged, niet uitgebracht**
- **Installatie thuis:** exacte HACS- en iPhone-PWA-versie niet vastgesteld

## Bestaande app
BBQ Planner plant recepten en taken voor grote en kleine kamado, serveertijd, kookstappen, historisch leren, boodschappenlijst, receptenimport en reviews. v5.1.1 herstelt vanuit Live de toegang tot de bestaande MEATER-grafiek en focusmodus. Deze route is automatisch getest, nog niet op een echt apparaat bevestigd.

De publieke PWA heeft geen HA/MEATER-liveverbinding en synchroniseert niet automatisch met HA. Persoonlijke HA-synchronisatie werkt alleen in de ingelogde Home Assistant-kaart. Bestaande opslagsleutels blijven beschermd.

## Openstaande praktijktests
1. **Echte MEATER Pro/Plus-hardware:** momenteel niet beschikbaar; alleen gesimuleerde fixtures mogelijk. Niet als uitgevoerd claimen.
2. Fysieke iPhone Safari/geïnstalleerde PWA met bestaande recepten/planning/reviews, update en navigatie.
3. Echte Home Assistant/HACS-iframe, recepten-/reviewsync en focusmodus; iPad/desktop en VoiceOver.
4. De bestaande eenmalige GitHub-workflow onder .github/workflows/release-v5.1.0-once.yml verdient een aparte, gecontroleerde opruim-/verbeter-PR, niet onderdeel van deze documentatietaak.

## Taken, beslissingen en roadmap
- [AI_WORKFLOW.md](AI_WORKFLOW.md): ChatGPT bouwt, Claude reviewt onafhankelijk **de echte PR-code**, gebruiker geeft expliciet merge-/releaseakkoord. Er is geen automatische AI-naar-AI-communicatie.
- [PR-template](../.github/PULL_REQUEST_TEMPLATE.md): bron-SHA, scope, testmatrix, risico, Claude-oordeel en gebruikersakkoord.
- **Nu:** v5.1.2-documentatie-PR afronden, alle checks laten slagen, onafhankelijke Claude-review organiseren. Zonder gebruikersakkoord niet mergen of publiceren.
- **Daarna, voorstel:** v5.2.0 mobiele Live-ervaring; v5.3.0 betere gezamenlijke planning/kamadoverdeling; v5.4.0 recepten en leren. Scope pas vaststellen na review.

## Acceptatie v5.1.2-docs
- [ ] README, PROJECT_STATUS, CHANGELOG en v5.1.0/v5.1.1-notities geven gepubliceerde status correct weer.
- [ ] AGENTS.md en CLAUDE.md verwijzen naar dezelfde werkwijze en overdracht.
- [ ] PR-template bevat vaste baselines, testen, regressie, review en autorisaties.
- [ ] Alle oude applicatietests en documentatiecontract groen op PR HEAD.
- [ ] Geen wijzigingen aan dist/, index.html, sw.js, HACS-appbestanden of gebruikersdata.
- [ ] Claude-review onafhankelijk uitgevoerd, bevindingen genoteerd; geen merge/release zonder akkoord.

## Start nieuwe chat
Controleer live GitHub. Lees relevante code en deze overdracht. Eindig met **huidige status, uitgevoerde wijzigingen, werkelijk geteste punten, risico's en volgende actie**. Update dit bestand bij een belangrijke nieuwe mijlpaal.
