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
- `v6/storage-journal.mjs`: losstaande write-ahead journal- en recovery-adapter met een eigen `bbq-v6-apply-journal-v1` sleutel. De oude v5-backup `bbq-v5-previous-plan-v1` wordt **niet** hergebruikt. Iedere wijziging legt vóór het opslaan de originele JSON duurzaam vast, verifieert plan en live geheugen, en herstelt bij een mislukte commit. Na een onderbroken schrijfactie kan `recoverJournal()` vóór het opnieuw laden van v5 herstellen.
- `tests/v6-pr3-storage.mjs`: tests met uitsluitend fictieve/mock-localStorage voor succesvolle writes, stale opgeslagen en in-memory plannen, corrupte journal, write-/cleanup-fouten, rollback-fout, onderbreking na opslaan, hervatting, conflicterende derde partij en behoud van eerdere sessiebackup/recepten.

### PR3 stap 3 — geïsoleerde live-koppeling en meerdere tabbladen

- `v6/plan-lock.mjs`: gedeelde exclusieve browser-`Web Locks` lock voor **samenwerkende v6-tabbladen**, met `ifAvailable` en een fail-closed fout wanneer de lock bezet is of de browser Web Locks niet ondersteunt; bewust geen localStorage-lease-fallback.
- `v6/live-apply-adapter.mjs`: combineert `prepareLegacyApply()`, `applyWithJournal()` en `recoverJournal()` via expliciete, gecontroleerde live-statecallbacks. Controleert de in-memory/planningfingerprint en de exact opgeslagen JSON voordat een voorstel wordt doorgevoerd.
- `tests/v6-pr3-live-apply.mjs`: gesimuleerde twee-tabbladencontroletest, stale tabs, annuleren, onbetrouwbare live-bridge, herstel, oude v5-backup en geen onverwachte opslag.
- `tests/v6-pr3-lock-browser.mjs`: echte twee-tabbladen-`Web Locks` in Chromium en WebKit (bij browser zonder Web Locks een expliciet geteste fail-closed uitkomst).
- `tests/v6-pr3-legacy-bridge.mjs`: echte v5.1.1-HTML en scripts via jsdom; injecteert uitsluitend **in de test** een extra setter in de bestaande v5-bridge. Beoordeelt bevestigen, annuleren, daadwerkelijke in-memory en localStorage-status, sessiebackup en herladen. Geen wijziging in `dist/`.

**Blokkerende grens:** er zijn nog v5-tabbladen die de opslag wijzigen zonder een gedeelde lock. Oude reeds geopende browsers kunnen zelfs na een nieuwe versie blijven schrijven. Daardoor is exclusiviteit tussen alle bestaande tabbladen momenteel **niet bewezen**. De helperfuncties mogen niet worden gekoppeld aan de publieke PWA of Home Assistant zolang dit gat niet aantoonbaar is afgedicht. `recoverJournal()` moet bovendien altijd vóór het bestaande synchrone v5-opstartpad zijn voltooid. Pas daarna volgt een kleine feature-gegate runtime-integratie met volledig regressiebewijs.

Deze stap blijft een veilige **test- en infrastructuurslice**, niet een werkende productieknop.


**Grenzen van deze isolatie:** v5 heeft nu nog directe opslagwrites zonder gedeelde lock. `applyWithJournal()` accepteert daarom alleen expliciet aangeleverde `readLiveState`, `commitLiveState`, `rollbackLiveState` én `withExclusiveLock`-callbacks. Een nieuw JS-only mutex is nadrukkelijk **niet** voldoende voor meerdere tabbladen: bestaande v5-schrijvers moeten aan dezelfde lock deelnemen of de integratie moet aantoonbaar anders voorkomen dat andere tabbladen een update doen. `localStorage` biedt geen transactie over twee sleutels; de oplossing is herstelbaar via write-ahead logging, niet strikt atomair. `recoverJournal()` moet op start vóór het laden van de app worden uitgevoerd. Tot dan worden deze modules **niet** productief aangeroepen.
- `v6/sandbox.html` met `v6/sandbox.mjs`: apart, werkend browserharnas met duidelijk gelabelde fictieve data; bereikbaar via een lokale HTTP-server op `/v6/sandbox.html`, nooit via bestaande productie-ingang.
- `tests/v6-pr3-browser.mjs`: browserregressie via lokale HTTP-server voor echte module-Worker, Chromium en WebKit, 320/390/1024px, horizontale overflow en de uitgeschakelde opslagactie.

De view heeft geen automatische start, live-navigatie of opslag. Zonder `onApply` is de knop **Toepassen** uitgeschakeld. Met een expliciete callback vergt Toepassen een aparte bevestigingsstap. Een callback moet vóór productie-integratie atomair de huidige sessie-fingerprint controleren, de oorspronkelijke sessie als rollback-snapshot bewaren, pas na alle validaties schrijven, en kunnen terugdraaien bij fout. Een afzonderlijke backup-/commit-/rollbackadapter met journal bestaat nu en wordt met mocks getest. De koppeling met de echte v5-live state, de cross-tab-lock en recover-before-load ontbreken nog. De huidige PR3-slice is daarom **niet productie- of mergeklaar**.

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
