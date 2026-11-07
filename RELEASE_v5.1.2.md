# BBQ Planner v5.1.2 — Samenwerking & kwaliteit

**Status: documentatie-/proceskandidaat — NIET gemerged of gepubliceerd.** Er is nog geen HACS-/PWA-appversie 5.1.2.

Basis: main 2eede6c5a9c693ac9ea0a838ee81e66af3698a74; laatst geverifieerde gepubliceerde appversie v5.1.1.

## In deze PR
- Centrale AI-werkwijze, handoff, PR-template en verwijzingen voor Claude/ChatGPT.
- Projectstatus, README, CHANGELOG en historische releasenotities gecorrigeerd; oudere status veilig gearchiveerd.
- Licht documentatiecontract toegevoegd aan GitHub Actions, zonder appwijzigingen.

## Compatibiliteit
Geen wijzigingen in dist/, index.html, sw.js, HACS-runtime, localStorage, recepten of gebruikersgegevens. De feitelijke appshell blijft v5.1.1. **Een toekomstige GitHub App Release 5.1.2 vereist een afzonderlijk besluit over consistente app-/cacheversies en publicatie.**

## Acceptatie
Alle bestaande CI-jobs + documentatiecontract groen; Claude onafhankelijk de echte PR laten reviewen; gebruiker geeft expliciet merge-/releaseakkoord. Fysieke iPhone/HA/MEATER-tests zijn niet uitgevoerd en voor deze docs-only taak geen blocker.
