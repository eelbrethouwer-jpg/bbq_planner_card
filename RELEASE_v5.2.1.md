# BBQ Planner v5.2.1 — Versie in beeld

**Status: releasekandidaat. Nog niet gemerged, getagd of gepubliceerd.**
Basis: v5.2.0 op `7c6bd8a542049727a43e6f34b5c09629e909a78b`; `main` bij start `61f12bb80e56a16103bcee266c85042b50c7623f`.

## Nieuwe functie
- In **Meer → App en info** staat zonder extra tik **Versie van deze app: v5.2.1**.
- Dit is de **geladen interfaceversie**, niet per definitie de door HACS geïnstalleerde versie of de laatste GitHub-release.
- Het nummer wordt uit de bestaande versiegecontroleerde HTML-paginatitel gelezen; er komt geen aparte configuratie, opslagkey, updatecheck of nieuwe navigatie bij.
- Compacte styling en automatische DOM-/Chromium-/WebKit-regressietests bevestigen locatie, zichtbaarheid en versiesynchronisatie.
- Alle bestaande cache- en laadverwijzingen worden naar v5.2.1 opgehoogd zodat HACS/PWA bijgewerkt kan worden.

## Ongewijzigd
- V4-kookengine, berekeningen, kamadoverdeling en serveertijden.
- MEATER/HA-bridge, recepten, reviews, historie, opslagkeys, opslagformaten en gebruikersdata.
- `engine/**` en `v6/**` inclusief afzonderlijke preview.

## Acceptatie en testgrenzen
- Verplichte GitHub Actions-jobs: `validate-hacs`, `html-javascript`, `ui-smoke`, `mobile-browser`, `version-consistency`; controle op de exacte PR HEAD na CI.
- Bewaking van productie en opslagcontracten en de v5.1.1→nieuwste-versie databehoudtest moeten geslaagd zijn.
- Een browsertest is geen fysieke HACS-/PWA-upgradetest en bewijst geen echte MEATER-metingen.
- Een merge publiceert de nieuwe versie direct op GitHub Pages; voor HACS is ook een afzonderlijke GitHub Release/tag vereist.
