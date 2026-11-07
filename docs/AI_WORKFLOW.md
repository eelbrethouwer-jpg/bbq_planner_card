# AI-samenwerking — BBQ Planner

Dit proces verbindt ChatGPT (bouwer), Claude (onafhankelijk reviewer), GitHub (bron van waarheid) en de gebruiker (goedkeuring). Dit document geeft werkinstructies: het is **geen bewijs** dat Claude al een review heeft uitgevoerd.

## Bronnen: altijd live controleren
1. Lees actuele GitHub-main en SHA, nieuwste gepubliceerde Release/tag, open PR's, Actions-runs en de relevante bronbestanden.
2. Lees daarna [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md) en [../PROJECT_STATUS.md](../PROJECT_STATUS.md). Dit zijn momentopnamen; de repository en actuele GitHub API zijn leidend.
3. Meld elke aanname als AANNAME en onderscheid Geverifieerd, Advies en Openstaand. Raad de geïnstalleerde HACS/PWA-versie of hardwareteststatus niet.
4. ChatGPT en Claude hebben **geen automatische onderlinge chat of gegevensuitwisseling**. De gebruiker deelt een PR-link/review of gebruikt een omgeving die beide dezelfde repo laat inzien. Een AI-samenvatting vervangt nooit de oorspronkelijke code/diff.

## Rollen
| Rol | Taken | Beslisrecht |
| --- | --- | --- |
| ChatGPT | Analyse, ontwerp, kleine veilige branch, bouwen, regressietests, PR en herstellen reviewpunten | Geen ongeautoriseerde merge of release |
| Claude | Onafhankelijk PR-diff, relevante code, tests en randgevallen controleren; reproduceerbare bevindingen | GO is advies, geen toestemming |
| GitHub Actions | Syntax, PWA, HACS, DOM, mobiele browser- en documentatiechecks | Geen fysieke iPhone of MEATER-hardwaretest |
| Gebruiker | Prioriteiten, scope, acceptatie, akkoord voor merge én release | Eindbeslissing |

## Vaste werkwijze
1. **Idee & analyse:** doel, huidige fout/gebruikerspad, risico, niet-doelen, uitgangs-SHA en toetsbare acceptatiecriteria.
2. **Ontwerp:** kleinste wijziging, beschermde code/opslaan, mobiele gevolgen en regression testcases. Aannames expliciet vastleggen.
3. **Bouw:** één verantwoordelijke ontwikkelaar per PR; branch vanaf een gecontroleerde main-SHA. Geen gelijktijdige conflicterende wijzigingen.
4. **Test:** bestaande tests + nieuwe regressies. Bekijk GitHub Actions van de **laatste PR HEAD-SHA**; oude groene runs tellen niet voor een nieuwe commit.
5. **Review:** bied Claude de **daadwerkelijke PR-diff** aan. Vraag bestand/regel, ernst (BLOCKER/HOOG/MIDDEL/LAAG), reproduceerbaar bewijs en kleine veilige fix.
6. **Herstel & herreview:** wijzig dezelfde branch, draai checks opnieuw en controleer eerder gemelde risico's.
7. **Publicatie:** alleen na expliciete toestemming van de gebruiker. Merge PR, controleer main, publiceer tag/release op exacte doelcommit en verifieer de GitHub Release plus CI/Pages afzonderlijk.
8. **Overdracht:** update handoff, projectstatus, changelog en release-notities waar nodig. Vermeld wat getest is en wat niet.

## Contracten die niet stilzwijgend mogen wijzigen
- V4-kookengine, timing, recepten, import/export, reviews, Home Assistant-/MEATER-bridge en bestaande opslagstructuren.
- localStorage-sleutels en schema's: alleen aanpassen met een expliciet beoordeeld migratieplan, inclusief terugval.
- De publieke PWA heeft **geen** live Home Assistant-/MEATER-gegevens en geen automatische PWA↔HA-synchronisatie.
- Alleen verse, echte MEATER-sensordata zijn LIVE. Gebruik in tests alleen duidelijk gemarkeerde fixtures; geen nepmetingen in de UI.
- Eén zichtbare ondernavigatie, mobiele breedtes en behoud van uitklapstatus/scroll na rerenderen.
- Geen tokens, wachtwoorden, Home Assistant-privédata of persoonlijke recepten in commits, PR's of logs.

## Minimale acceptatiematrix
- Functionele gebruikersroute en bestaande functies gecontroleerd; geen onverwachte wijzigingen aan opgeslagen plannen.
- JavaScript/PWA, DOM/recepten/reviews, opslagregressies, HACS en Chromium/WebKit op relevante breedtes.
- Gevalideerde daggrenzen/tijdzones, indien het werk planning raakt.
- Echte iPhone/PWA en Home Assistant **apart** beoordelen; geen automatische test als praktijktest presenteren.
- MEATER Pro/Plus: verse/verouderde/ontbrekende data met fixtures testen; hardwareproef blijft open tot echt uitgevoerd.
- Documentatiecontract: node tests/docs-contract.mjs.
- CI en review zijn voorwaarden voor een release, **niet** zelf een merge-/releaseakkoord.

## Format van Claudes review
**Bron:** actuele main SHA, PR HEAD SHA, tag, datum. **Bevindingen:** ernst, bestand/regel, bewijs, reproduceerbaarheid, risico en advies. **Testmatrix:** zelf uitgevoerd / GitHub Actions / niet uitgevoerd. **Eindoordeel:** GO, GO MET OPMERKINGEN of NO-GO. **Vervolg:** kleinst mogelijke veilige stap.

Bij nieuwe ontwikkelrondes: lees [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md), controleer GitHub opnieuw en schrijf na afloop de handoff bij.
