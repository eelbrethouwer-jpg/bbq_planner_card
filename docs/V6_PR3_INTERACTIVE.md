# BBQ Regisseur v6.0 — PR3 interactieve planning

**Status: draft, nog niet merge- of releaseklaar.** De gepubliceerde v5.1.1-app,
de bestaande sessiesleutels en main zijn niet veranderd. De featurebranch heeft
wel een **opt-in** wijziging in `dist/BBQ_bereidingsplanner_MEATER_v4.html`.
Er is geen v6-functie actief op de normale v5.1.1-productie-URL.

## Functionaliteit en bescherming

| Onderdeel | Geïmplementeerd in draft | Productie |
| --- | --- | --- |
| Engine/optimizer in module-Web-Worker | Ja; opzeggen en stale-responses | Uit |
| Mobiele v6-tijdlijnen, maximaal drie alternatieven | Ja, afzonderlijke view | Uit |
| Testweergave via `?v6preview=1` in echte v5-HTML | Ja; actuele *kopie* van v5-live-state | Uit |
| Een alternatief bewaren als apart concept | Ja, alleen na expliciete klik | Uit |
| Alternatief toepassen op de v5-planning | Isolatieadapter getest, **niet aangesloten** | Uit |
| Herstel na onderbroken schrijftransactie | Journal-helper en tests bestaan | Niet automatisch |
| Detectie onafgerond herstel **vóór v5-boot** | Ja; blokkeert boot zonder iets te schrijven | Alleen op draft |
| Bescherming tegen al geopende oude v5-schrijvers | **Niet afdwingbaar** in een reeds geopende v5-tab | Blokkerend |

### Preview en conceptopslag

De beta opent uitsluitend via
`/dist/BBQ_bereidingsplanner_MEATER_v4.html?v6preview=1`. Zonder de
queryparameter wordt geen v6-module geladen, geen v6-DOM-paneel opgebouwd,
geen globale read-only-bridge aangemaakt en geen opslag voor v6-concepten
aangeraakt.

`v6/legacy-readonly-entry.mjs` leest een diepe JSON-kopie van de bestaande
v5-sessie. De optimizer draait in `v6/optimizer-worker.mjs`, beheerd door
`v6/optimizer-client.mjs`. De resultaten zijn zichtbaar in
`v6/regisseur-view.mjs` en `v6/regisseur.css`. De knop **Toepassen** blijft
uitgeschakeld. Een `storage`-event uit een andere tab verwijdert alle
voorstellen en vereist een volledige paginaherlading om v5-stale-memory
te vermijden.

Er is nu een afzonderlijke, expliciete actie **Bewaar als concept**. De
helper `v6/proposal-draft.mjs` slaat **uitsluitend metadata en SHA-256-
controlesommen** op onder `bbq-v6-proposal-draft-v1`. Geen volledige
recepten, sessies of originele/plannings-JSON worden gekopieerd.
`kamado-bereidingsplanner-v1`, `bbq-v5-session-v1`,
`bbq-v5-previous-plan-v1` en oude bibliotheek/review-sleutels blijven
ongemoeid. Er wordt niets opgeslagen zonder de gebruikersklik.

Ook alternatieven onder voorwaarden kunnen worden bewaard, maar worden
als **fysiek nog niet geverifieerd** gelabeld; ze worden niet toegepast.
Een concept wordt bij laden opnieuw beoordeeld. Als de bestaande v5-planning
wijzigt, wordt het **verouderd**: het blijft bewaard tot expliciete
verwijdering, maar mag niet worden overgenomen. Zonder Web Locks of
Web Crypto wordt conceptopslag geweigerd; geen onveilige fallback.

### Apply en herstel — technisch aanwezig, bewust uitgeschakeld

- `v6/apply-proposal.mjs`: pure preflight. Valideert optimizer-
  provenance, gerechten, serveertijden, fysieke voorwaarden, tijdzone/DST
  en maakt alleen een kopie van de v5-planning.
- `v6/storage-journal.mjs`: afzonderlijke write-ahead journal onder
  `bbq-v6-apply-journal-v1`, met geteste commit-/rollback-/recovery-paden.
  Omdat localStorage geen transacties over meerdere sleutels heeft, is
  dit **herstelbaar, niet multi-key atomair**.
- `v6/plan-lock.mjs`: browser-Web Lock voor **meewerkende v6-tabbladen**.
  Oudere v5-tabs nemen deze lock niet.
- `v6/live-apply-adapter.mjs`: opt-in live-state-bridge met extra verplichte
  `assertLegacyWriterExclusion`-controle. Ontbrekende of niet-geverifieerde
  uitsluiting blokkeert zowel apply als automatische recovery. Het
  `()=>true`-bewijs bestaat alleen in geïsoleerde tests en is **geen**
  geldige productie-implementatie.
- Bovenaan de bestaande inline v5-opstartscript staat nu een
  `bbq-v6-apply-journal-v1`-controle. Een aanwezige journal (ook een
  corrupte) verhindert de hele **nieuwe v5-initialisatie**, toont een
  veiligheidsmelding en wist of herschrijft **niets**. Dit is een
  **preboot-stop**, géén automatische herstelprocedure.

**Bewezen beperking:** een al geopend oud v5-tabblad kan de oude
`kamado-bereidingsplanner-v1`-sleutel nog steeds zonder lock schrijven.
Dat is vanuit JavaScript in een nieuw tabblad niet betrouwbaar te voorkomen
of af te dwingen. Daarom mag PR3 geen live v5-plan muteren zolang deze
oude-schrijversituatie niet door een werkelijk veilige migratie- of
sessie-isolatiestrategie is opgelost. De nieuwe **conceptopslag onder een
andere sleutel** blijft wél buiten bereik van oude v5-writes; iedere
verandering van de onderliggende planning maakt het concept verouderd.

## Validatie

GitHub Actions draait het volgende (actuele commit-run vereist voor GO):

- `tests/v6-engine.mjs` en `tests/v6-shadow.mjs`: baseline en
  v5-v6-pariteit, waaronder tijdzonecases.
- `tests/v6-optimizer.mjs`: bounded optimizer (96 standaard, maximaal 512
  kandidaatbudget), null/locks, capaciteit en serveervertraging.
- `tests/v6-pr3.mjs` en `tests/v6-pr3-apply-proposal.mjs`: pure UI-,
  Worker-, annuleren-, tamper- en preflighttests.
- `tests/v6-pr3-storage.mjs`: 17 losstaande journal-/rollbacktests.
- `tests/v6-pr3-live-apply.mjs`: fail-closed uitsluiting,
  twee-tabbladen-, stale state- en rollbackcases.
- `tests/v6-pr3-proposal-draft.mjs`: metadata-only concepten, oude v5-
  tabwrites, stale-herkenning, write failures, conditiechecks en verwijderen.
- `tests/v6-pr3-preboot.mjs`: een onafgerond/corrupt journal blokkeert v5
  vóór het laden; opslag blijft byte-identiek.
- `tests/v6-pr3-legacy-bridge.mjs`: echte v5-HTML in jsdom met **alleen
  testmatig** geïnjecteerde setter; geen productie-integratie.
- `tests/v6-pr3-browser.mjs`, `tests/v6-pr3-lock-browser.mjs` en
  `tests/v6-pr3-real-v5-browser.mjs`: echte Chromium en WebKit op
  320/390/1024px, gewone URL zonder v6, opt-in v6-preview, expliciete
  conceptopslag, oude-tabwijziging, verouderd concept, herladen, verwijderen,
  preboot-stop en geen wijzigingen in bestaande v5-gegevens.

Een succesvolle CI-run is bewijs voor deze specifieke geteste scenario's,
niet voor een echte iPhone, live Home Assistant, MEATER-integratie of
onbewaakte schrijvers in reeds geopende oude v5-tabs.

## Vereist vóór merge en release

1. Controleer de **nieuwste** CI-run, analyseer afwijkingen en laat geen
   bekende regressies onopgelost.
2. Maak een aantoonbaar veilige migratie-/sessiestrategie voor oude v5-tabs.
   Als dit niet mogelijk is, beperk een eerste PR3-release expliciet tot
   de **read-only preview en losstaand concept opslaan** en laat
   `Toepassen` uitgeschakeld. Beslis dit afzonderlijk.
3. Controleer mobiele toegankelijkheid met een echte iPhone, v5-navigatie,
   recepten, reviews, MEATER en opslag na herladen.
4. Laat Claude de **actuele PR-HEAD** onafhankelijk reviewen en verwerk
   blokkerende punten.
5. **Geen merge, tag of release zonder expliciet akkoord.**

Bewaar onderscheid tussen testcode, draft-PR en daadwerkelijk
gepubliceerde versie v5.1.1.
