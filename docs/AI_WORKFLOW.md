# AI-samenwerking — BBQ Planner

Dit proces verbindt Claude als regisseur en reviewer (in de chat op claude.ai), Claude Code als bouwer, GitHub als bron van waarheid en de gebruiker als eigenaar. Sinds 17 november 2026 doet ChatGPT niet meer mee. Dit document geeft werkinstructies: het is **geen bewijs** dat een review al is uitgevoerd.

## Bronnen: altijd live controleren
1. Lees de actuele `main` en de SHA, de nieuwste gepubliceerde release/tag, open PR's, Actions-runs en de relevante bronbestanden.
2. Lees daarna [PROJECT_STATUS.md](../PROJECT_STATUS.md). Dat is een momentopname; de repository en de actuele GitHub API zijn leidend.
3. Meld elke aanname als AANNAME en onderscheid Geverifieerd, Advies en Openstaand. Raad de geïnstalleerde HACS/PWA-versie of de status van hardwaretests niet.
4. De regisseur (Claude in de chat) en de bouwer (Claude Code) zijn aparte sessies. Ze delen **geen geheugen en synchroniseren niet automatisch**. Ze werken via GitHub: de bouwer meldt de PR-link, de regisseur leest de PR, de diff en de CI zelf en plaatst de review als PR-commentaar. Een AI-samenvatting vervangt nooit de echte code, diff of CI-uitkomst.

## Rollen
| Rol | Wie | Taken | Beslisrecht |
| --- | --- | --- | --- |
| Regie + onafhankelijke review | Claude in de chat (claude.ai) | Prioriteiten en scope bewaken, opdracht per PR schrijven, de echte PR-diff en CI reviewen, de review als PR-commentaar plaatsen | GO is advies, geen toestemming |
| Bouwer | Claude Code | Branch vanaf een gecontroleerde `main`-SHA, code, tests, draft-PR, reviewpunten verwerken op dezelfde branch | Geen merge, tag of release |
| GitHub Actions | CI | Syntax, PWA, HACS, DOM, mobiele browser- en versiechecks | Geen fysieke iPhone-, Home Assistant- of MEATER-test |
| Eigenaar | De gebruiker | Kiest, accepteert, geeft expliciet akkoord voor merge én release | Eindbeslissing |

## Vaste werkwijze
1. **Opdracht:** de regisseur beschrijft per PR het doel, de scope, wat niet mag, de uitgangs-SHA en toetsbare acceptatiecriteria.
2. **Bouw:** de bouwer controleert eerst live de `main`-SHA en maakt een eigen branch per PR. Eén PR per branch; nooit direct naar `main` pushen. Kleinste wijziging, bestaande functies en opslag blijven behouden, aannames als AANNAME in de PR.
3. **Test:** bestaande tests plus nieuwe regressietests. De bouwer meldt welke tests hij zelf draaide en welke niet. Alleen GitHub Actions op de **laatste PR HEAD-SHA** tellen; oude groene runs tellen niet voor een nieuwe commit.
4. **Draft-PR:** de bouwer opent een draft-PR naar `main`, vult de [PR-template](../.github/PULL_REQUEST_TEMPLATE.md) volledig in en meldt de link aan de gebruiker. Daarna stopt de bouwer.
5. **Review:** de gebruiker vraagt de regisseur om een review. De regisseur leest de PR, de diff en de CI zelf op GitHub en plaatst de review als PR-commentaar (format hieronder).
6. **Herstel en herreview:** de bouwer verwerkt de reviewpunten op **dezelfde branch** en reageert per punt in de PR met de commit-SHA die het oplost. De regisseur controleert de nieuwe HEAD en de eerder gemelde risico's opnieuw.
7. **Merge en release:** pas na een GO van de regisseur, groene CI op de laatste HEAD **en** een expliciet akkoord van de gebruiker. Een GO is geen akkoord. Publiceer een tag/release alleen op de exacte doelcommit en controleer daarna de GitHub Release, CI en Pages apart.
8. **Overdracht:** werk PROJECT_STATUS.md, CHANGELOG en release-notities bij waar nodig. Vermeld wat getest is en wat niet.

## Contracten die niet stilzwijgend mogen wijzigen
- V4-kookengine, timing, recepten, import/export, reviews, Home Assistant-/MEATER-bridge en bestaande opslagstructuren.
- localStorage-sleutels en schema's: alleen aanpassen met een expliciet beoordeeld migratieplan, inclusief terugval. Een nieuw **optioneel** veld mag, als de PR het expliciet meldt en oude data blijft werken.
- De publieke PWA heeft **geen** live Home Assistant-/MEATER-gegevens en geen automatische PWA↔HA-synchronisatie.
- Alleen verse, echte MEATER-sensordata zijn LIVE. Gebruik in tests alleen duidelijk gemarkeerde fixtures; geen nepmetingen in de UI.
- Eén zichtbare ondernavigatie, mobiele breedtes en behoud van uitklapstatus/scroll na rerenderen.
- Geen tokens, wachtwoorden, Home Assistant-privédata of persoonlijke recepten in commits, PR's of logs.

## Minimale acceptatiematrix
- Functionele gebruikersroute en bestaande functies gecontroleerd; geen onverwachte wijzigingen aan opgeslagen plannen.
- JavaScript/PWA, DOM/recepten/reviews, opslagregressies, HACS en Chromium/WebKit op relevante breedtes.
- Gevalideerde daggrenzen/tijdzones, als het werk de planning raakt.
- Echte iPhone/PWA en Home Assistant **apart** beoordelen; een automatische test is geen praktijktest.
- MEATER Pro/Plus: verse, verouderde en ontbrekende data met fixtures testen; de hardwareproef blijft open tot hij echt is uitgevoerd.
- Versieconsistentie: `node tests/version-consistency.mjs`.
- CI en review zijn voorwaarden voor een release, **niet** zelf een merge- of releaseakkoord.

## Format van de review door de regisseur (Claude)
De regisseur plaatst de review als **commentaar in de PR** op GitHub, zodat bouwer en gebruiker dezelfde tekst zien. Inhoud:
- **Bron:** actuele `main`-SHA, PR HEAD-SHA, tag en datum.
- **Bevindingen:** per punt een nummer, ernst (BLOCKER / HOOG / MIDDEL / LAAG), bestand/regel, bewijs, reproduceerbaarheid, risico en kleinste veilige correctie.
- **Testmatrix:** zelf uitgevoerd / GitHub Actions op de exacte HEAD / niet uitgevoerd.
- **Niet bereikbaar:** welke bronnen (CI-runs, PR-tekst, GitHub-instellingen of bestanden) niet gecontroleerd konden worden.
- **Eindoordeel:** GO, GO MET OPMERKINGEN of NO-GO.
- **Vervolg:** kleinst mogelijke veilige stap.

De bouwer reageert per bevindingnummer met de commit-SHA van de oplossing, of met een onderbouwing waarom het punt niet wordt opgelost.

Bij nieuwe ontwikkelrondes: lees [PROJECT_STATUS.md](../PROJECT_STATUS.md), controleer GitHub opnieuw en werk na afloop PROJECT_STATUS.md bij. Oudere documenten (zoals `docs/V6_*` en het archief) noemen ChatGPT als bouwer; dat is historisch juist en blijft zo staan.
