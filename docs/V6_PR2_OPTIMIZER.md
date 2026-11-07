# BBQ Regisseur v6 — PR2: begrensde optimizer, uitsluitend shadow-mode

> **Status:** implementatie op draft-PR, nog niet gereviewd of gemerged. Geen nieuwe publieke v6-appversie; v5.1.1 blijft leidend. Niet geladen door `dist/`, PWA of Home Assistant.

## Afbakening

- Nieuw: `engine/optimizer.mjs` met `optimize(input)`.
- Onaangeroerd: `engine/check.mjs`, `engine/adapter.mjs`, `engine/time.mjs`, `dist/`, `sw.js`, `index.html`, HACS-configuratie, UI, data, appversie.
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
- `changes`: of `{type:'kamado',dishId,from,to}`, of `{type:'serve_delay',dishId,from,to,minutes}`. Het `to`-veld van een serveverschuiving is een absolute instant. `suggestedPlan` bevat alleen `dishes`, `fires` en `tasks` als **preview**.

**Limits:** `maxCandidates` is een integer van 0 t/m 512; standaard 96. De teller bevat iedere daadwerkelijk beoordeelde nieuwe planning, ook afgewezen kandidaten, maar niet de uitgangsplanning. `maxAlternatives` is een integer van 0 t/m 3, standaard 3. Ongeldige limits krijgen `INVALID_LIMITS` en `searchStatus:'not_run'` (niet stil clammen). Bij overschrijding volgt `budget_exhausted`. De uitvoer blijft deterministisch bij gelijke input, onafhankelijk van de systeemklok.

**Serveerverschuiving:** uitsluitend `laterAllowedMaxMin` van het **oorspronkelijke** serveerslot, integer 0 t/m 1440 (minuten); standaard 0. Opties in stappen van 15 minuten, plus exact het eindmaximum. De echte serveerslots blijven staan. Voor de vertraagde **niet-gefixeerde** dish wordt alleen in het kandidaatmodel een eigen serveerslot gemaakt. Geen verschuiving van een gang over een volgende/vorige gang. Onbekende/foute flexibiliteit is `INVALID_FLEXIBILITY`, geen gok.

## Zoekstrategie

1. Bereken de echte uitgangsplanning met `plan(input)`. Bij geldige invoer en een niet-feasible baseline kan de optimizer zoeken.
2. Bouw in stabiele ID-volgorde een eindige lijst van toegestane wijzigingen, **alleen** voor gerechten met status `waiting`, geen pinned start en geen daadwerkelijk geregistreerde start/rust/eindtijd.
3. Beoordeel eerst alle enkelvoudige wijzigingen; vervolgens combinatie van twee wijzigingen bij **verschillende** gerechten. Een wijziging kan een kamadoverplaatsing, toegestane latere serveertijd of beide bevatten.
4. Iedere kandidaat gaat terug door de bestaande checker; een kandidaat met `unknown` of `infeasible` wordt niet aangeboden als bruikbaar alternatief. Controleer daarnaast dat alle pinned/actieve gerechten exact dezelfde berekende tijden, kamado en serveerslot houden.
5. Kamadoverplaatsing zonder expliciete `kamado.verifiedDishIds` geeft `KAMADO_FIT_UNVERIFIED` (conditional); een gunstige tijdlijn betekent dus niet automatisch dat een stuk vlees fysiek past.
6. Sorteer deterministisch op `feasible` vóór `conditional`, dan blockers, unknowns, waarschuwingen, aantal ingrepen, herverdeling en minuten vertraging. Bied hoogstens drie daadwerkelijk verbeterende resultaten aan, met herkomst, waarschuwingen en diff.

Een resultaat `searchStatus:'complete'` betekent **volledige enumeratie van deze begrensde strategie (één/twee gerechten)**, **geen** bewijs van wereldwijde optimale planning. De zoeklimiet telt **kandidaten** en gebruikt geen nondeterministische tijdslimiet. Voor grotere menu's moet `budget_exhausted` zichtbaar blijven; een budgetuitkomst is niet een garantie dat de beste optie gevonden is.

## N04 — verplichte veiligheidsinvariant

Voor pinned gerechten, gerechten in `cooking`, `resting`, `done` en gerechten met werkelijke voortgangstijden geldt:

- Originele state blijft byte-identiek.
- Geen alternatief bevat een mutatie van zo'n gerecht.
- De voorgestelde tijd, kamado en serveerkoppeling van zo'n gerecht blijven exact gelijk.
- Ook als een andere dish hetzelfde serveerslot gebruikt, wordt dat oorspronkelijke slot **niet** veranderd.
- Feitelijke afvinkstatus/Live-sessie wordt in PR2 **niet** bijgewerkt. Dat is PR4.

## Testacceptatie

`tests/v6-optimizer.mjs` bevat aparte onafhankelijke orakels (N04 en O01–O20) voor herverdeling, toegestane serveervertraging, budget 0/1 en `budget_exhausted`, maximum drie voorstellen, onzekerheid over fysieke kamadogeschiktheid, ongeldige limits, geen Date.now/DOM/localStorage, determinisme, negen/meer gerechten en input-onveranderlijkheid.

Alle bestaande PR1-tests blijven staan, inclusief 56 scenario's en legacy-shadow. De CI-job `ui-smoke` roept één extra Node-test aan. CI-groen bewijst regressie in deze scenario's; **geen** iPhone-, HA-, MEATER- of real-life-BBQ-test is voor PR2 uitgevoerd.

## Buiten scope / latere PR's

- **PR3:** preview-UI met expliciet Toepassen / Annuleren; later pas gecontroleerde opslag.
- **PR4:** Live-herplanning, echte sessieverankering en gewijzigde lopende kooktijden.
- **v6.0-release:** aparte goedkeuring na onafhankelijke Claude-review, integratie- en praktijktests.

**Aan Claude:** val `candidateOptions`, `isLocked`, `preservedLocked`, `score`, budgetgrenzen, `KAMADO_FIT_UNVERIFIED` en het per-dish-splitting van serveerslots aan. Zoek tegenvoorbeelden van verborgen extra waarschuwingen, dubbele IDs, meerdere fasen, onhaalbare reassignments, cultuur-/DST-verschillen en onterechte 'feasible'. Geef een afzonderlijk GO/GO MET OPMERKINGEN/NO-GO. Niets mergen of publiceren.
