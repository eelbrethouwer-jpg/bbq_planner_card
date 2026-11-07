# BBQ Regisseur v6.0 — 30 deterministische ontwerp-/testscenario's

> **Nog geen uitgevoerde tests.** Dit is een onafhankelijke testcatalogus voor Claude en de toekomstige engine. Verwachtingen zijn acceptatieontwerp, niet de huidige v5.1.1-uitkomst. Geen fictieve MEATER-waarden als echte live data presenteren.

## Standaard fixture en notatie

Tenzij anders vermeld: `timeZone=Europe/Amsterdam`, datum `2026-11-14` (zaterdag, normale CET-dag), serveertijd `18:30`, `now=2026-11-14 12:00 CET`, 1 grote (`large`) en 1 kleine (`small`) kamado, aparte vermelde capaciteit wanneer gedeeld gebruik wordt getoetst, en geen gewijzigde gebruikersdata. Bereidingsduur betekent *actieve tijd plus expliciete overgangstijd*, rust volgt daarop. `[start,end)` is een halfopen interval: einde exact gelijk aan volgende start telt niet als overlap. Opstooktijd is per kamado standaard 30 minuten groot en 25 minuten klein, **alleen voor de voorbeelden** (huidige presets zijn instelbaar). Als een scenario capaciteit of opwarmtijd niet specificeert, mag de engine dit niet invullen als bewezen haalbaar.

Elke rij noemt primair testtype: **E** = exact tijdstip, **I** = invariant, **C** = conflict/haalbaarheidsstatus. Claude vult vóór bouwen ontbrekende input/verwachtingen aan.

## A. Basis, tijden, vaste gebruikerskeuzes (S01–S10)

| ID | Input | Verwacht resultaat / toetsing | Type |
| --- | --- | --- | --- |
| S01 | Eén gerecht groot, 60 min actief + 15 min rust, serve 18:30, opstook 30 | Start **17:15**, van BBQ **18:15**, einde rust **18:30**, aansteken **16:45** | E |
| S02 | Twee onafhankelijke kamado's: groot 90 min actief + 15 min rust; klein 30 min actief + 0 min rust; serve 18:30; beide vooraf volledig beschikbaar | Groot start **16:45**, off **18:15**, vuur **16:15**. Klein start **18:00**, off **18:30**, vuur **17:35**. Beide ready 18:30; `feasible` zonder overlap op dezelfde resource | E/C |
| S03 | Twee gerechten met gelijke start op **dezelfde** kamado, direct 250 °C/gietijzer en indirect 120 °C/RVS, beide actief overlappend | `infeasible`; `INCOMPATIBLE_SETUP` bevat precies de twee gerecht-IDs, met overlappende halfopen segmenten | C |
| S04 | Twee gerechten 120 °C indirect dezelfde kamado en gelijktijdig, **geen** roostercapaciteit bekend | `conditional` of `unknown`, reden `CAPACITY_UNVERIFIED`; niet hard `feasible` | C |
| S05 | Twee gelijktijdige indirecte gerechten 120 °C, expliciete capaciteit van dezelfde kamado **één gerecht tegelijk** (`capacity={unit:'dishes',value:1}`) | `infeasible` en `RESOURCE_CAPACITY`; onbekende capaciteit zou **conditional** met `CAPACITY_UNVERIFIED` zijn, niet `feasible` | C |
| S06 | Eén reverse sear, actieve `cook=55` min (fase1 50, fase2 5), `transitionMins=15`, rust 10; serve 18:30 | Start **17:10**, fase1 **17:10–18:00**, ombouw **18:00–18:15**, fase2 **18:15–18:20**, off 18:20, ready 18:30, vuur groot **16:40** (30 min vooraf). Geen dubbel optellen van fase2 | E |
| S07 | Eén gerecht handmatige vaste start 17:00, actieve `cook=90` min, rust **0**, serve 18:30 | `feasible`; start **exact 17:00** ongewijzigd, off/ready 18:30. Mutatie naar 17:05 zonder serveverschuiving veroorzaakt `FIXED_START_MISSES_SERVE` | E/I |
| S08 | Start beschikbaar pas 18:00; één gerecht 60 min actief + 15 min rust, serve **vast** 18:30, groot preheat 30 | `infeasible`, `EARLIEST_START_AFTER_REQUIRED` én `PREHEAT_UNAVAILABLE`. Benodigd: gerecht 17:15, vuur 16:45. Geen automatisch uitgesteld diner | C/E |
| S09 | Grote kamado pas vanaf 17:00 beschikbaar; gerecht 60 min actief + 15 rust, serve 18:30, preheat groot 30 | Benodigde start **17:15** en vuur **16:45**; `PREHEAT_UNAVAILABLE` blocker, **geen** `EARLIEST_START_AFTER_REQUIRED` omdat gerecht wél na 17:00 start | E/C |
| S10 | Geldige serveertijd, maar **nul gerechten** en beide kamado's onbenut | `feasible`, `searchStatus='not_run'`, lege taken/geen conflicten, beide `fires=null`; geen fictief aansteekadvies | I |

## B. Identiteit, input, voorbereiden, daggrenzen en zomertijd (S11–S20)

| ID | Input | Verwacht resultaat / toetsing | Type |
| --- | --- | --- | --- |
| S11 | Twee gerechten met dezelfde naam 'Ribeye', verschillende **unieke IDs**, onafhankelijk op groot en klein | Geen ID-menging of `DUPLICATE_ID`; taak-ID's, beide tijdlijnen en probe-koppelingen blijven bij juiste gerecht-ID | I |
| S12 | Ongeldige datum, '25:99' of ontbrekende serveertijd | `unknown`/validatiefout met veldnaam; geen stille fallback of `NaN`-tijd op tijdlijn | I/C |
| S13 | Onbekende cookduur of `null`/negatieve rust | Geen impliciete nulduur; validatie `DURATION_UNKNOWN` of `INVALID_DURATION` | I/C |
| S14 | Eén gerecht met `cook=600` min (10 uur) en rust 60 min, serve 14 nov om 18:30, groot preheat 30 | Start **14 nov 07:30**, off **17:30**, vuur **07:00**, ready **18:30**. Een daggrens wordt pas overgestoken als de werkelijke keten dat vereist, niet automatisch omdat het long/slow is | E/I |
| S14b | Serve 14 nov 2026 18:30, **20 uur cook + 60 min rust**, groot preheat 30, availableFrom 14 nov 16:30 | Start **13 nov 21:30**, vuur **13 nov 21:00**, off 14 nov 17:30, ready 14 nov 18:30. Alleen `AVAILABILITY_UNVERIFIED` (conditional), geen blocker door beschikbaarheid op serveerdag | E/C |
| S15 | Rub één kalenderdag vooraf, tijd 19:00, serve 14 nov | Voorbereiding op **13 nov 19:00**, vóór de bereiding, geen 'vandaag 19:00' | E |
| S16 | Pekelen twee dagen vooraf zonder expliciete tijd, serve 14 nov | Taakdatum **12 nov**, kloktijd **onbekend**; geen fictieve definitieve 12:00 | E/I |
| S17 | Lokale start `2027-03-28 02:30 Europe/Amsterdam` (voorjaar DST) | `NONEXISTENT_LOCAL_TIME`; niet stil doorschuiven naar 03:30 | C |
| S18 | Lokale start `2027-10-31 02:30 Europe/Amsterdam` (najaar DST) | `AMBIGUOUS_LOCAL_TIME` met expliciete eerdere/latere instantkeuze | C |
| S19 | Dezelfde UTC-instant gepland vanaf iPhone en desktop in andere systeemzone | Ongewijzigde absolute planning en expliciete huis-zone; geen uurverschuiving door apparaatlocale | I |
| S20 | Twee kamado's, drie unieke voorbereidingstaken, waarvan één zonder tijd; meerdere taken op gelijke tijd | Sorteer op `(at, type, kamadoId, dishId, id)`; `at:null` krijgt **begin van `localDate` in de huiszone** als sorteersleutel, `timeKnown=false` blijft, `prep`-typeprioriteit geldt, geen fictieve kloktijd in de taak | I |

## C. Live, echte voortgang, onzekerheid, leren en schaal (S21–S30)

| ID | Input | Verwacht resultaat / toetsing | Type |
| --- | --- | --- | --- |
| S21 | Gerecht staat 25 min achter volgens handmatige voortgang; andere gerechten wachten | Scenario toont welke deadlines onder druk komen, maar originele start/serve blijven onveranderd tot bevestiging | I/C |
| S22 | Gerecht reeds `cooking` op groot, herplanner ziet betere score op klein | Geen kamadoverplaatsing of herstart van lopende bereiding | I |
| S23 | Taak is afgevinkt, gebruiker opent/sluit details, Live hertekent elke 30 sec | Afvinkstatus, identiteit, geplande/werkelijke tijd en open details blijven behouden | I |
| S24 | Publieke PWA zonder Home Assistant en zonder sensor | Geen live temp/ETA, label `geen live MEATER`; planningsvoorstellen blijven beschikbaar | I |
| S25 | De echte MEATER-status ontbreekt of de ETA is verouderd; **PR1 bevat geen probe-input** en rekent alleen met planduur | PR1 gebruikt geen MEATER-sensoren en geeft nergens LIVE-ETA; toekomstige Live-engine moet stale data afkeuren. **Niet** claimen dat PR1 MEATER-ETA al valideert | I |
| S26 | Eén MEATER-probe aan twee gerechten toegewezen | Beide ETA-koppelingen geweigerd met `MEATER_DUPLICATE_ASSIGNMENT`; geen fictieve uitkomst | C |
| S27 | Slechts één review van pulled pork, geen overige vergelijkbare data | Geen schijnprecies persoonlijk leervoorstel; standaardduur blijft leidend | I |
| S28 | Eerdere bereidingen met één uitschieter en niet-vergelijkbare stukken vlees; **geen reviewgegevens in PR1-checker** | **Vervolg (PR4):** vergelijkbaarheidscriteria, steekproef, mediaan/bereik en expliciete acceptatie testen. PR1 mag geen ongetest leeradvies of tijdsverandering genereren | I |
| S29 | Gebruiker heeft fysiek 2 grote en 1 kleine kamado; huidige legacy-sleutels `large`/`small` | Optioneel 3-resource-ontwerp kan dit representeren, maar legacy krijgt geen stille migratie, hernummering of dataverlies | I |
| S30 | 12 gerechten; checker in PR1, **nog geen optimizer**; dezelfde snapshot tweemaal | `searchStatus='not_run'`, `alternatives=[]`, `plan(input)` twee maal `deepEqual` inclusief `inputFingerprint`; Node-checkertijd **< 50 ms**. Geen claim over optimizer-timeout of bewezen globale haalbaarheid | I |

## Testmethodiek voor Claude

1. **Maak S01–S10 eerst ondubbelzinnig**: vaste invoervelden, precieze instant timestamps, expliciete resourcebezetting en verwachte tijden of blokkades.
2. Breid dezelfde discipline uit naar S11–S30. Aanvullende adversarial cases toegestaan, maar rapporteer minstens deze 30.
3. Schrijf per scenario een trace `input → constraints → plan of conflicts → uitleg`, zonder browser of echte sensoren.
4. **Negative oracle**: controleer dat verboden bewerkingen (andere start bij fixed, dubbel bezette resource, data wissen) daadwerkelijk falen.
5. **Shadow-mode**: draai legacy `calc()` en kandidaatengine op identieke fixtures; controleer wat *equivalent zou moeten zijn* (S01/S02) en verklaar bewust afwijkende uitkomsten (S03/S04).
6. **Geen tests claimen als uitgevoerd** totdat er echte code en uitvoer bestaat; dit document legt slechts de criteria vast.

## Formele acceptatie voor eerste implementatie-PR (na ontwerp-GO)

- Alle 30 scenario's omgezet naar machinale fixtures met expliciete expected outcome of invariant en duidelijke namen.
- Geen test die een scenario automatisch als 'passed' markeert omdat er geen exception optreedt.
- `solve(input)` heeft nul bijwerkingen, `now` is injecteerbaar, tie-breaks zijn deterministisch, alle ongeldige inputtypen worden geweigerd.
- Regressie op bestaande planningsberekening, taken, recepten/reviews, lokale opslag en mobiele UI blijft groen.
- Een fysiek niet-gevalideerde capaciteits- of opwarmclaim kan nooit als gegarandeerd haalbaar resultaat verschijnen.

**Beoordeling gevraagd:** aanvullen/corrigeren van onvolledige orakels vóór bouwen, niet bevestigen dat bestaande app dit al ondersteunt.



## V01–V10 — eerdere, door ChatGPT voorgestelde aanvalsscenario's

**Historische herkomst:** dit zijn de oude voorlopige N-scenario's van ChatGPT, nu **V** om niet te botsen met Claudes originele N01–N10. V04 was een duplicaat van S18 en is geschrapt.

| ID | Invoer | Verwacht oracle | Scope |
| --- | --- | --- | --- |
| V01 | Cookduur −5 of rust negatief | Validatie `INVALID_DURATION`, `unknown` | PR1 |
| V02 | Twee gerechten met dezelfde dish-ID | `DUPLICATE_ID` met severity `unknown`; slechts eerste gerecht verwerkt en geen dubbele taak-ID's | PR1 |
| V03 | Gerecht met niet-bestaande kamado | `UNKNOWN_KAMADO` met severity `unknown`; geen ongefundeerde automatische toewijzing | PR1 |
| V05 | Twee opeenvolgende gerechten met andere roosters en grote temperatuurstijging zonder bevestigde wisseltijd | `CHANGEOVER_UNVERIFIED`, `conditional` als verder geldige invoer | PR1 |
| V06 | Voorbereiding eindigt na verplichte start | `PREP_AFTER_START` blocker | PR1 |
| V07 | Open Live-details gevolgd door hertekenen/reload | Geen verlies van afvinkstatus of sessie-identiteit | PR4 |
| V08 | Vertraagde lopende bereiding en vast serveermoment | Alle verschuivingen eerst preview, geen automatische wijziging | PR4 |
| V09 | Cook/transition >10.000 minuten | `OUT_OF_RANGE`, `unknown`, geen truncatie | PR1 |
| V10 | `Date.now`, DOM en storage geven fout bij gebruik | Adapter en checker blijven puur en onveranderlijk | PR1 |

## N01–N10 — Claude, onafhankelijke reviewronde 1 (letterlijke overdracht)

| ID | Invoer | Correct oracle | Scope |
| --- | --- | --- | --- |
| N01 | Serve **2027-03-28 12:00**, cook **14 uur**, geen extra rust | Start **2027-03-27 21:00 CET** (de DST-nacht kent 23 uren) | PR1 |
| N02 | Serve **2027-10-31 12:00**, cook **14 uur**, prep **1 kalenderdag vooraf 19:00** | Start **2027-10-30 23:00 CEST**, prep **2027-10-30 19:00 CEST** | PR1 |
| N03 | Eerdere sear **250 °C tot 16:20**, low **120 °C vanaf 17:00**, dezelfde kamado | `conditional` en `CHANGEOVER_UNVERIFIED`; daling >60 °C zonder opgegeven afkoeltijd | PR1 |
| N04 | Optimizer stelt alternatieven voor terwijl een gerecht pinned of cooking is | Vaste en lopende gerechten blijven ongewijzigd | PR2 |
| N05 | Voorgerecht eindigt na hoofdgerecht | `SLOT_ORDER` voorwaardelijke waarschuwing; geen stil wijzigen serveermomenten | PR1 |
| N06 | Prep 16:50, duurt 30 min; kookstart 17:15 | `PREP_AFTER_START` blocker vanwege eindtijd 17:20 | PR1 |
| N07 | Datumwijziging in Live met afgevinkte taken | Afvinkstatus blijft behouden, geen stil dataverlies | PR4 |
| N08 | Automatische datummodus passeert middernacht tijdens een lopende sessie | Actieve sessiedatum blijft verankerd, geen automatisch doorrollen | PR4 |
| N09 | MEATER-probe toegewezen aan afgerond én lopend gerecht | Duplicaatcontrole telt alleen niet-afgeronde gerechten | PR4 |
| N10 | Cook 20.000 / rust −5 / dubbele ID | `OUT_OF_RANGE` / `INVALID_DURATION` / `DUPLICATE_ID`, alle `unknown` | PR1 |

**Statusvoorwaarde:** adaptervalidatie is unknown, niet blocker. Alleen met bewezen geldige data mag een harde planinvariant tot blocker leiden. Het PR1-shadowmodel negeert `actuals` en `status` totdat PR4 dat veilig implementeert.

**Volgorde:** D1–D3 documentatie-PR eerst afronden, dan P1–P8 en onafhankelijke tests in PR #32; beide blijven draft en ongemerged. PR2 pas na expliciet GO op beide PR's.
