# BBQ Regisseur v6.0 — 30 deterministische ontwerp-/testscenario's

> **Nog geen uitgevoerde tests.** Dit is een onafhankelijke testcatalogus voor Claude en de toekomstige engine. Verwachtingen zijn acceptatieontwerp, niet de huidige v5.1.1-uitkomst. Geen fictieve MEATER-waarden als echte live data presenteren.

## Standaard fixture en notatie

Tenzij anders vermeld: `timeZone=Europe/Amsterdam`, datum `2026-11-14` (zaterdag, normale CET-dag), serveertijd `18:30`, `now=2026-11-14 12:00 CET`, 1 grote (`large`) en 1 kleine (`small`) kamado, aparte vermelde capaciteit wanneer gedeeld gebruik wordt getoetst, en geen gewijzigde gebruikersdata. Bereidingsduur betekent *actieve tijd plus expliciete overgangstijd*, rust volgt daarop. `[start,end)` is een halfopen interval: einde exact gelijk aan volgende start telt niet als overlap. Opstooktijd is per kamado standaard 30 minuten groot en 25 minuten klein, **alleen voor de voorbeelden** (huidige presets zijn instelbaar). Als een scenario capaciteit of opwarmtijd niet specificeert, mag de engine dit niet invullen als bewezen haalbaar.

Elke rij noemt primair testtype: **E** = exact tijdstip, **I** = invariant, **C** = conflict/haalbaarheidsstatus. Claude vult vóór bouwen ontbrekende input/verwachtingen aan.

## A. Basis, tijden, vaste gebruikerskeuzes (S01–S10)

| ID | Input | Verwacht resultaat / toetsing | Type |
| --- | --- | --- | --- |
| S01 | Eén gerecht groot, 60 min actief + 15 min rust, serve 18:30, opstook 30 | Start **17:15**, van BBQ **18:15**, einde rust **18:30**, aansteken **16:45** | E |
| S02 | Groot gerecht 90+15 min, klein gerecht 30+0 min, beide klaar 18:30, onafhankelijk | Groot start **16:45**, klein start **18:00**; geen kamadoconflict; beide eindigen 18:30 | E |
| S03 | Twee gerechten op dezelfde kamado, 120 °C indirect vs 250 °C direct, overlappende intervallen | Niet 'zonder voorbehoud haalbaar'; conflict `INCOMPATIBLE_SETUP` met beide ID's, alternatief vereist tijd-/kamadokeuze | C |
| S04 | Twee gerechten 120 °C indirect dezelfde kamado en gelijktijdig, **geen** roostercapaciteit bekend | `conditional` of `unknown`, reden `CAPACITY_UNVERIFIED`; niet hard `feasible` | C |
| S05 | Twee identieke temperatuur/roostersituaties, expliciete capaciteit 1 gerecht tegelijk | Geen overlap; bij onvermijdelijke overlap `RESOURCE_CAPACITY` | I/C |
| S06 | Reverse sear: fase 1 indirect 50 min, ombouw 15 min, fase 2 direct 5 min, rust 10 min | Totale kritieke keten **80 min**; bij serve 18:30 start **17:10**, omschakeling **18:00–18:15**, fase2 **18:15–18:20** | E |
| S07 | Gerecht vaste handmatige start 17:00, 90 min actieve bereiding, serve 18:30 | Start **17:00** behouden, geen stil verplaatsen; waarschuwing of alternatief bij eventuele afwijking | E/I |
| S08 | Beschikbaar vanaf 18:00, 60 min bereiding + 15 rust, serve vast 18:30 | `infeasible`, reden `EARLIEST_START_AFTER_REQUIRED`; bied expliciet later serveren aan | C |
| S09 | Serve 18:30, gerecht start 17:15, groot opstook 30, beschikbaar vanaf 17:00 | Aansteken 16:45 is vóór beschikbaarheid: expliciet `PREHEAT_UNAVAILABLE`; kookstart alleen haalbaar als gebruiker regel wijzigt | E/C |
| S10 | Geen gerechten | Leeg plan, geen fake-alarms, geen geplande vuurtijden, geen fout/crash | I |

## B. Identiteit, input, voorbereiden, daggrenzen en zomertijd (S11–S20)

| ID | Input | Verwacht resultaat / toetsing | Type |
| --- | --- | --- | --- |
| S11 | Twee gerechten allebei 'Ribeye', verschillende unieke IDs | Taken, reviewtoewijzing en herplanning volgen IDs; geen verwisseling op naam | I |
| S12 | Ongeldige datum, '25:99' of ontbrekende serveertijd | `unknown`/validatiefout met veldnaam; geen stille fallback of `NaN`-tijd op tijdlijn | I/C |
| S13 | Onbekende cookduur of `null`/negatieve rust | Geen impliciete nulduur; validatie `DURATION_UNKNOWN` of `INVALID_DURATION` | I/C |
| S14 | 10 uur rookbereiding + 60 min rust, serve 18:30, start 07:30 | Toon start-, vuur- en rusttijd op juiste kalenderdag; bij duur >24u een duidelijke **vorige dag** en juiste datum | E/I |
| S15 | Rub één kalenderdag vooraf, tijd 19:00, serve 14 nov | Voorbereiding op **13 nov 19:00**, vóór de bereiding, geen 'vandaag 19:00' | E |
| S16 | Pekelen twee dagen vooraf zonder expliciete tijd, serve 14 nov | Taakdatum **12 nov**, kloktijd **onbekend**; geen fictieve definitieve 12:00 | E/I |
| S17 | Lokale start `2027-03-28 02:30 Europe/Amsterdam` (voorjaar DST) | `NONEXISTENT_LOCAL_TIME`; niet stil doorschuiven naar 03:30 | C |
| S18 | Lokale start `2027-10-31 02:30 Europe/Amsterdam` (najaar DST) | `AMBIGUOUS_LOCAL_TIME` met expliciete eerdere/latere instantkeuze | C |
| S19 | Dezelfde UTC-instant gepland vanaf iPhone en desktop in andere systeemzone | Ongewijzigde absolute planning en expliciete huis-zone; geen uurverschuiving door apparaatlocale | I |
| S20 | Recept met fasen inclusief drie voorbereidende taken; twee kamado's met gelijktijdige aansteekacties | Stabiele sortering `(tijd,prioriteit,ID)`; aparte taakidentiteit en geen dubbel ingevoerde voorbereidingen | I |

## C. Live, echte voortgang, onzekerheid, leren en schaal (S21–S30)

| ID | Input | Verwacht resultaat / toetsing | Type |
| --- | --- | --- | --- |
| S21 | Gerecht staat 25 min achter volgens handmatige voortgang; andere gerechten wachten | Scenario toont welke deadlines onder druk komen, maar originele start/serve blijven onveranderd tot bevestiging | I/C |
| S22 | Gerecht reeds `cooking` op groot, herplanner ziet betere score op klein | Geen kamadoverplaatsing of herstart van lopende bereiding | I |
| S23 | Taak is afgevinkt, gebruiker opent/sluit details, Live hertekent elke 30 sec | Afvinkstatus, identiteit, geplande/werkelijke tijd en open details blijven behouden | I |
| S24 | Publieke PWA zonder Home Assistant en zonder sensor | Geen live temp/ETA, label `geen live MEATER`; planningsvoorstellen blijven beschikbaar | I |
| S25 | Home Assistant-ETA ontbreekt of is ouder dan het expliciete versheidsvenster | ETA niet als live gebruikt; fallback op handmatige/plandata met herkomstlabel | I/C |
| S26 | Eén MEATER-probe aan twee gerechten toegewezen | Beide ETA-koppelingen geweigerd met `MEATER_DUPLICATE_ASSIGNMENT`; geen fictieve uitkomst | C |
| S27 | Slechts één review van pulled pork, geen overige vergelijkbare data | Geen schijnprecies persoonlijk leervoorstel; standaardduur blijft leidend | I |
| S28 | Meerdere beoordelingen van dezelfde bereiding, één evidente uitschieter en onvergelijkbare stukken | Verifieer filtering, steekproefgrootte, mediaan/bereik en uitleg; nooit automatische overname zonder akkoord | I |
| S29 | Gebruiker heeft fysiek 2 grote en 1 kleine kamado; huidige legacy-sleutels `large`/`small` | Optioneel 3-resource-ontwerp kan dit representeren, maar legacy krijgt geen stille migratie, hernummering of dataverlies | I |
| S30 | 12 gerechten met verschillende fasen en vaste tijdsloten; solver overschrijdt expliciete zoeklimiet | Deterministische begrensde zoektijd; uitkomst `unknown`/partieel met budgetreden, nooit ongefundeerde `feasible`; dezelfde input levert dezelfde output | I/C |

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
