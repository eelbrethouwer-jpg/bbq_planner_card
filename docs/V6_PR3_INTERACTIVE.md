# BBQ Regisseur v6.0 — PR3 interactieve planning (lopende draft)

## Ontwikkelstatus

Eerste PR3-slice op een eigen featurebranch. Niet gemerged, geen tag of release.
De publieke v5.1.1-app en `dist/`, `sw.js`, `index.html`, manifest, HACS en bestaande storage-contracten blijven ongemoeid.

## Architectuur

- `v6/optimizer-worker.mjs`: roept de bestaande `engine/optimizer.mjs` uitsluitend in een module-Web-Worker aan.
- `v6/optimizer-client.mjs`: fresh Worker per aanvraag; `cancel()` termineert werkelijk de lopende Worker; request-ID voorkomt stale replies. Geen fallback die op de hoofdthread optimaliseert.
- `v6/preview-model.mjs`: pure presentatie van gerechten, serveerslots, voorbereiding, aansteken, opleggen, ombouwen, rusten, serveren, kamadotijdlijnen, conflicten, maximaal drie alternatieven en `budget_exhausted`.
- `v6/regisseur-view.mjs` + `v6/regisseur.css`: geïsoleerde mobile-first UI op een expliciet aangeleverde DOM-root. Tekstinhoud via `textContent` (geen onveilige HTML-injectie).
- `tests/v6-pr3.mjs`: regressies op brondata-onveranderlijkheid, beide kamado's, alternatieven, XSS, dubbele bevestiging, stale Worker-responses en echte Worker-terminatie.
- `v6/apply-proposal.mjs`: pure fail-closed preflight die een gecontroleerd optimizer-alternatief naar een kopie van de bestaande v5-planning vertaalt. Controleert actuele dish-/slot-/kamadodata tegen de v6-ingang, beide fingerprints, complete serveerslotvertraging, datum/DST-representatie en weigert onzekere fysieke geschiktheid zonder expliciete toestemming. **Schrijft niets weg**.
- `tests/v6-pr3-apply-proposal.mjs`: ongewijzigde v5-veldnamen, bron-immutabiliteit, stale en tampered voorstellen, actieve bereidingen, serveervertraging en voorwaarden.
- `v6/sandbox.html` met `v6/sandbox.mjs`: apart, werkend browserharnas met duidelijk gelabelde fictieve data; bereikbaar via een lokale HTTP-server op `/v6/sandbox.html`, nooit via bestaande productie-ingang.
- `tests/v6-pr3-browser.mjs`: browserregressie via lokale HTTP-server voor echte module-Worker, Chromium en WebKit, 320/390/1024px, horizontale overflow en de uitgeschakelde opslagactie.

De view heeft geen automatische start, live-navigatie of opslag. Zonder `onApply` is de knop **Toepassen** uitgeschakeld. Met een expliciete callback vergt Toepassen een aparte bevestigingsstap. Een callback moet vóór productie-integratie atomair de huidige sessie-fingerprint controleren, de oorspronkelijke sessie als rollback-snapshot bewaren, pas na alle validaties schrijven, en kunnen terugdraaien bij fout. De pure preflight bestaat nu, maar er is **geen duurzame backup-/commit-/rollbackstorage-adapter**. De huidige PR3-slice is daarom **niet productie- of mergeklaar**.

## Precies afgebakende huidige scope

- Een aparte UI-component bestaat in de broncode, maar wordt **niet** in de bestaande PWA of Home Assistant geladen.
- De standaardbudgetgrens van de engine blijft 96 kandidaten; de harde enginegrens blijft 512.
- `run(input)` berekent asynchroon in de Worker. De caller kan een laadstatus tonen; een gestopte berekening keert terug met `AbortError`.
- `buildPreviewModel` toont `budget_exhausted` expliciet. Opties worden als previews getoond; maximaal drie.
- De oorspronkelijke planningsuitvoer blijft de waarheid. Een gekozen alternatief is alleen een visuele preview en muteert input niet.
- Bestaande v5.1.1-opslag, recepten, reviews, MEATER en appversie blijven onaangeroerd.

## Vervolg binnen PR3

1. Volledige browsertest van de geïsoleerde view in Chromium én WebKit, inclusief iPhone-breedtes 320/375/390px, touch en safe-area.
2. Inspecteer de v5-sessie-invarianten en ontwerp een versievaste rollbackbare **apply-adapter**. Voeg vervolgens echte tests toe voor expliciet toepassen, annuleren, stale fingerprint, storage-falen, reload, herstel en oude data.
3. Sluit de nieuwe pagina aan op de bestaande navigatie zonder import/export, recepten, reviews of v5-live-functies te verbreken. Houd een featurepoort/rollbackpad aan.
4. Realistische Worker-benchmarks op mobiele apparaten met 20 gerechten en budgets 96/256/512.
5. Laat Claude de werkelijke PR-code onafhankelijk reviewen. Daarna pas eventueel afzonderlijk mergeakkoord.
6. Neem Claudes PR2-opmerkingen (lege slots, volledig menu later, score-tie-break, issue-contract) apart op in de scope en tests; wijzig de optimizer niet impliciet tijdens UI-integratie.

## Acceptatiecriteria voor volledige PR3

- Alle gerechten, gezamenlijke serveertijd, taken per kamado en risico's direct zichtbaar.
- Maximaal drie previews inclusief concrete verschillen, status, loading en budgetwaarschuwing.
- Geen impliciete veranderingen: toepassen alleen met actuele fingerprint, duidelijke bevestiging en gecontroleerd herstelpad.
- Geen regressie in v5-data of lokale opslagcontracten.
- CI groen, onafhankelijke review, mobiel bruikbaar, expliciet akkoord vóór merge en aparte toestemming vóór release.

## Testbeperkingen

Node/jsdom-tests zijn geen fysieke iPhone-tests. GitHub Chromium/WebKit-CI voor v5 is geen bewijs dat de nieuw geïsoleerde v6-view al op echte hardware werkt. Geen Home Assistant- of MEATER-hardwaretests uitgevoerd.
