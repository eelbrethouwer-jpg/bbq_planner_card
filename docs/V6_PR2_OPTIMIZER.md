# BBQ Regisseur v6 — PR2: begrensde optimizer, uitsluitend shadow-mode

> **Status:** implementatie op draft-PR, nog niet gereviewd of gemerged. Geen nieuwe publieke v6-appversie; v5.1.1 blijft leidend. Niet geladen door `dist/`, PWA of Home Assistant.

## Afbakening

- Nieuw: `engine/optimizer.mjs` met `optimize(input)`.
- Alleen een gerichte fix aan `engine/adapter.mjs` (behoud ongebruikte geldige preheat). Verder onaangeroerd: `engine/check.mjs`, `engine/time.mjs`, `dist/`, `sw.js`, `index.html`, HACS-configuratie, UI, data en appversie.
- `optimize` gebruikt `plan(input)` als read-only waarheid. Het top-level plan blijft de **ongewijzigde uitgangsplanning**. Een alternatief bevat uitsluitend een afzonderlijke suggestie (`suggestedPlan`), nooit een toepasactie. Geen opslag of klokaanroepen.
- PR2 ondersteunt het huidige `large`/`small`-model en daarnaast expliciet aangeleverde kamado-resource-ID's. Fysieke geschiktheid van een ander rooster/diameter/accessoire wordt **nooit** automatisch aangenomen.

## Contract

```js
import {fromLegacyState} from './engine/adapter.mjs';
import {optimize} from './engine/optimizer.mjs';
const {input,validation}=fromLegacyState(legacyJSON,{houseZone:'Europe/Amsterdam',now:INJECTED_EPOCH_MS});
input.limits={maxCandidates:96,maxAlternatives:3};
input.serveSlots.find(slot=>slot.id==='main').laterAllowedMaxMin=60; // expliciet toegestane vertraging
const outcome=optimize(input);
// outcome.planStatus is de status van de oorspronkelijke planning.
// outcome.searchStatus: 'not_run' | 'complete' | 'budget_exhausted'
// outcome.alternatives: 0..3 voorstellen zonder wijzigingen aan input
```

De output behoudt de huidige `plan()`-velden (`dishes`, `fires`, `proposedTasks`, `validation`, `conflicts`, `provenance`) en voegt toe:

- `optimization:{testedCandidates,totalCandidates,maxCandidates,maxAlternatives,reason}` — controleerbare zoekstatus.
- `alternatives:[{id,planStatus,changes,conflicts,suggestedPlan,feasibleUnderAssumptions,inputFingerprint,rationale}]`.
- `changes`: `{type:'kamado',dishId,from,to}` per gerecht, of `{type:'serve_delay',slotId,dishIds:[...],from,to,minutes}` voor de **gehele serveergang**. `dishIds` is gesorteerd; `from` en `to` zijn absolute instants. `suggestedPlan` bevat alleen `dishes`, `fires` en `tasks` als **preview**.

**Limits:** `maxCandidates` is een integer van 0 t/m 512; standaard 96. De teller bevat iedere daadwerkelijk beoordeelde nieuwe planning, ook afgewezen kandidaten, maar niet de uitgangsplanning. `maxAlternatives` is een integer van 0 t/m 3, standaard 3. Ongeldige limits krijgen `INVALID_LIMITS` en `searchStatus:'not_run'` (niet stil clammen); **`planStatus` van de baseline blijft exact behouden**. Bij `maxAlternatives:0` volgt `searchStatus:'not_run'` en `optimization.reason:'alternatives_disabled'`, zonder kandidaten te onderzoeken. Bij overschrijding volgt `budget_exhausted`. De uitvoer blijft deterministisch bij gelijke input, onafhankelijk van de systeemklok.

**Serveerverschuiving:** uitsluitend `laterAllowedMaxMin` van het **oorspronkelijke** serveerslot, integer 0 t/m 1440 (minuten); standaard 0. Opties in stappen van 15 minuten, plus exact het eindmaximum. Het oorspronkelijke inputmodel blijft staan. In de kandidaatkopie wordt **hetzelfde serveerslot-ID als geheel** opgeschoven en volgen alle gerechten die naar dat slot verwijzen. Geen nieuwe per-gerecht-slots. Slotvertraging is alleen toegestaan als **alle** slotgerechten `waiting` zijn, geen vaste start of werkelijk gemeten voortgang hebben en de gangvolgorde intact blijft. Ook bij een ongeldige vertraging blijft baseline `planStatus` ongewijzigd. Geen verschuiving van een gang over een volgende/vorige gang. Onbekende/foute flexibiliteit is `INVALID_FLEXIBILITY`, geen gok.

## Zoekstrategie

1. Bereken de echte uitgangsplanning met `plan(input)`. Bij geldige invoer en een niet-feasible baseline kan de optimizer zoeken.
2. Bouw in stabiele ID-volgorde een eindige lijst van **kamadoverplaatsingen per gerecht** (alleen `waiting`, niet-pinned, zonder daadwerkelijk geregistreerde voortgang). Bouw daarnaast **serveerslot-vertragingen per slot** in stabiele slot-ID-volgorde, alleen bij volledige toestemming van alle gerechten binnen dat slot.
3. Beoordeel eerst enkelvoudige wijzigingen; daarna uitsluitend (a) twee kamadoverplaatsingen op verschillende gerechten of (b) één **volledige slotvertraging × één kamadoverplaatsing**. Geen combinatie van twee slotvertragingen en nooit een slot opsplitsen. Iedere geteste kandidaat telt mee voor `limits.maxCandidates`.
4. Iedere kandidaat gaat terug door de bestaande checker; een kandidaat met `unknown` of `infeasible` wordt niet aangeboden als bruikbaar alternatief. Controleer dat alle pinned/actieve gerechten exact dezelfde berekende tijden, kamado en serveerslot houden **én** dat `fires[k]` op iedere kamado met een locked gerecht exact behouden blijft.
5. Kamadoverplaatsing zonder expliciete `kamado.verifiedDishIds` geeft `KAMADO_FIT_UNVERIFIED` (conditional); een gunstige tijdlijn betekent dus niet automatisch dat een stuk vlees fysiek past.
6. Sorteer deterministisch op `feasible` vóór `conditional`, dan blockers, unknowns, waarschuwingen, aantal ingrepen, herverdeling en minuten vertraging. Bij verder gelijke uitkomst blijft het eerder ingevoerde gerecht bij voorkeur op zijn originele kamado. Bied hoogstens drie daadwerkelijk verbeterende resultaten aan, met herkomst, waarschuwingen en diff.

Een resultaat `searchStatus:'complete'` betekent **volledige enumeratie van deze begrensde strategie (maximaal twee resourceverplaatsingen of één slotvertraging plus één resourceverplaatsing)**, **geen** bewijs van wereldwijde optimale planning. De zoeklimiet telt **kandidaten** en gebruikt geen nondeterministische tijdslimiet. Voor grotere menu's moet `budget_exhausted` zichtbaar blijven; een budgetuitkomst is niet een garantie dat de beste optie gevonden is.

## N04 — verplichte veiligheidsinvariant

Voor pinned gerechten, gerechten in `cooking`, `resting`, `done` en gerechten met werkelijke voortgangstijden geldt:

- Originele state blijft byte-identiek.
- Geen alternatief bevat een mutatie van zo'n gerecht.
- De voorgestelde tijd, kamado en serveerkoppeling van zo'n gerecht blijven exact gelijk.
- Als een locked gerecht in een serveerslot staat, wordt **dat slot in geen enkel voorstel verschoven**. Andere gerechten in die gang mogen nog wel een veilige kamadoverplaatsing krijgen.
- Feitelijke afvinkstatus/Live-sessie wordt in PR2 **niet** bijgewerkt. Dat is PR4.

## Testacceptatie

`tests/v6-optimizer.mjs` bevat aparte onafhankelijke orakels (N04, O01–O20 en K1–K7) voor herverdeling, toegestane serveervertraging, budget 0/1 en `budget_exhausted`, maximum drie voorstellen, onzekerheid over fysieke kamadogeschiktheid, ongeldige limits, geen Date.now/DOM/localStorage, determinisme, negen/meer gerechten en input-onveranderlijkheid.

Alle bestaande PR1-tests blijven staan, inclusief 56 scenario's en legacy-shadow. De CI-job `ui-smoke` roept één extra Node-test aan. CI-groen bewijst regressie in deze scenario's; **geen** iPhone-, HA-, MEATER- of real-life-BBQ-test is voor PR2 uitgevoerd.

## Prestatieafweging voor PR3

Claude rapporteerde voor de onafhankelijke review van 20 gerechten en een budget van 512 kandidaten circa **0,4 seconde in Node**. Dit is een **door Claude gerapporteerde meting**, geen garantie voor mobiele hardware. PR3 moet de berekening daarom **buiten de hoofdthread** uitvoeren (bijvoorbeeld een Worker) of de standaardlimiet van 96 handhaven totdat mobiel benchmarkbewijs beschikbaar is. De optimizer gebruikt geen `Date.now()`-time-out; `limits.maxCandidates` is de reproduceerbare stopvoorwaarde. `allowedDelayMin(slot)` is een minutenlimiet, geen dagberekening.

## Buiten scope / latere PR's

- **PR3:** preview-UI met expliciet Toepassen / Annuleren; later pas gecontroleerde opslag.
- **PR4:** Live-herplanning, echte sessieverankering en gewijzigde lopende kooktijden.
- **v6.0-release:** aparte goedkeuring na onafhankelijke Claude-review, integratie- en praktijktests.

**Aan Claude:** hercontroleer de herstelde hele-slot-vertraging, behoud van `fires` bij actieve kamado's, `candidateOptions`, `isLocked`, `preservedLocked`, `score`, budgetgrenzen en `KAMADO_FIT_UNVERIFIED`. Test uitdrukkelijk dat serveerslots nooit per gerecht worden gesplitst. Zoek tegenvoorbeelden van verborgen extra waarschuwingen, dubbele IDs, meerdere fasen, onhaalbare reassignments, cultuur-/DST-verschillen en onterechte 'feasible'. Geef een afzonderlijk GO/GO MET OPMERKINGEN/NO-GO. Niets mergen of publiceren.
