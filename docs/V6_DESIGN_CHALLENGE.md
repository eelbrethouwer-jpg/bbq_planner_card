# BBQ Regisseur v6.0 — functioneel en technisch ontwerp (Design Challenge)

> **Status:** ontwerpvoorstel voor onafhankelijke Claude-review; geen implementatie, testbewijs, merge of release. **Controleer opnieuw live GitHub** voordat deze specificatie wordt gebruikt. De v6.0-naam is de geplande productrichting, geen bestaande HACS-/PWA-release.

## 1. Gecontroleerde startbasis — 7 november 2026

- Repository: `eelbrethouwer-jpg/bbq_planner_card`.
- `main` bij start: `8eb7c8253e2894fd9811fc33e941ed9f84bf6740`; laatste GitHub Release: `v5.1.1` (tag verwijst naar `8afb5a89c7d2af975f6cddcbb97598682906e543`).
- PR #30 voor ChatGPT–Claude-samenwerking is gemerged; bij start van deze ontwerpbranch waren geen open PR's.
- Uit `dist/BBQ_bereidingsplanner_MEATER_v4.html`: `calc()` (omgeving regel 865) berekent per gerecht terug vanaf serveertijd, inclusief `cook`, `rest`, `transitionMins`, vaste start en vuur aansteken; waarschuwt voor conflicten, maar zoekt geen integraal uitvoerbaar rooster.
- Bestaande `smartPlan()` (omgeving regel 1303) gebruikt ETA of voortgang voor **advies**, bewaart oorspronkelijke planning. Bestaande `v45Allocation()`/`v45Score()` (omgeving regel 2134) kiest tussen `large`/`small` via heuristische score en zoekt niet naar een globaal optimaal tijdrooster. `v46Tasks()` en `v46PrepTasks()` maken taken voor de dag en eerdere dagen.
- `dist/bbq-v5.js` gebruikt de v4-engine als bron van waarheid; `tests/smoke.mjs`, `tests/v510-smoke.mjs`, `tests/mobile-bounds.mjs` beschermen huidige routes. De huidige code ondersteunt **één grote en één kleine kamado** als machine-ID's; meer fysieke kamado's toevoegen is een aparte compatibiliteitsbeslissing.
- Hardware/iPhone/HA/MEATER-proeven voor v6.0 zijn **niet uitgevoerd**.

## 2. Productdoel en niet-doelen

**Doel:** bepaal voor een BBQ-menu of de gewenste serveermomenten en beschikbare kamado's met realistische voorbereiding, fasen, rust en handmatige vaste tijden samen haalbaar zijn. Geef bij onhaalbaarheid aantoonbare conflicten en maximaal drie onderbouwde alternatieven. In Live mag bij gewijzigde voortgang een nieuw **voorstel** verschijnen, maar nooit stilzwijgend een gerecht, tijd, bereiding of opslag wijzigen.

**Niet in eerste v6-scope:** automatische kamadobediening, cloud/AI-abonnement, food-safety-garantie, directe MEATER vanuit publieke PWA, automatische sync PWA ↔ HA, een nieuwe recepten-/reviewsopslag, automatische instructiegeneratie, en ongemeten roostercapaciteit als zekerheid opvoeren.

De MVP moet ook **zonder MEATER** bruikbaar blijven. Receptvoorkeur "geen ui" en bestaande recepten-/bibliotheekvelden blijven ongewijzigd.

## 3. Kerngebruiksroutes

1. **Menu samenstellen** — selecteer gerechten en serveertijd(en), markeer vaste/mogelijk te verschuiven starttijden, kies beschikbare kamado's en aanwezige accessoires.
2. **Plan beoordelen** — zie haalbaarheid `haalbaar | haalbaar onder voorbehoud | niet haalbaar | onvoldoende gegevens`, inclusief waarom; toon bezetting per kamado, kritieke afhankelijkheden, voorbereidende taken van eerdere dagen en tijdspeling.
3. **Alternatief kiezen** — één-klik *voorstel bekijken*, met before/after. Alleen na bevestiging in huidige planner toepassen; annuleren laat opslag en oude planning exact intact.
4. **Live bijsturen** — werkelijke start/uit-BBQ/rust klaar handmatig vastleggen; bereken een read-only scenario voor resterende taken, maar wijzig gestarte/afgevinkte/vaste taken niet automatisch.
5. **Na afloop leren** — toon een verklaarbaar tijdvoorstel op basis van voldoende vergelijkbare eigen beoordelingen; gebruiker kiest zelf of het plan wordt aangepast.

## 4. Harde regels (engine mag ze nooit stilzwijgend overtreden)

- H01: starttijd/fasering/rust zijn expliciete intervallen; `einde = start + duur` voor elk segment; geen negatieve of `NaN`-waarden.
- H02: serveervensters en vaste starttijden blijven intact zolang gebruiker geen toestemming geeft om te verschuiven; een onhaalbaar geval is een geldig resultaat, geen rechtvaardiging voor stille wijziging.
- H03: bezetting op dezelfde kamado kan alleen overlappen als configuraties *én* capaciteit expliciet verenigbaar zijn. Als roostercapaciteit onbekend is, label de overlap **onder voorbehoud**, niet bewezen haalbaar.
- H04: per kamado voldoende opstart-, ombouw-, temperatuurwissel- en accessoiretijd; waar duur onbekend: conservatief als **onbekend/te bevestigen**, niet automatisch nul.
- H05: voorbereidingstaken en afhankelijkheden vóór bereiding; ook bij daggrenzen. Een taak zonder expliciete tijd levert een taak met **datum + tijd onbekend**, geen verzonnen 12:00 als definitieve afspraak.
- H06: fasen van één gerecht behouden volgorde, wisseltijd, rust en expliciete afwerking; een al gestart, rustend of afgerond gerecht wordt niet herverdeeld of teruggezet.
- H07: meerdere gangen behouden eigen serveerslots; één serveertijd blijft de default.
- H08: datum/tijd met IANA-zone `Europe/Amsterdam` als expliciete planningscontext; ambigue of niet-bestaande lokale tijden vereisen expliciete keuze/fout, nooit een verborgen conversie.
- H09: ongeldige inputs leiden tot een zichtbaar validatieprobleem; geen `0` minuten / onbekende temperatuur stiekem als zeker gebruiken.
- H10: plan-generator is in de eerste fase **puur/read-only**: geen DOM, localStorage, HA-calls of `Date.now()` binnen `solve()`; tijd (`now`) en zone komen als input.
- H11: zelfde input + zelfde modelversie = zelfde voorstel en volgorde; deterministische tie-break op ID, expliciet gemelde score/afweging.
- H12: voedselveiligheid blijft een menselijke controle; geen advies om bederfelijke producten onbeperkt te laten wachten of een kerndoel te verlagen om de planning te halen.

## 5. Zachte doelstellingen (pas na harde regels)

1. Minimaliseer onhaalbare/ongewenste eindtijdafwijkingen **alleen binnen door gebruiker gekozen flexibiliteit**.
2. Minimaliseer omschakelingen tussen roosters, direct/indirect en temperatuur.
3. Minimaliseer krappe wissels en onzekerheidsrisico's; geef instelbare voorbereidingstoleranties.
4. Minimaliseer het aantal voorgestelde wijzigingen t.o.v. de bestaande planning.
5. Optimaliseer verdeling tussen kamado's en onnodig lange warmhoud-/rustvensters binnen receptbeperkingen.

**Geen één onverklaard 'magisch scoregetal'.** Sorteer lexicografisch: eerst haalbaarheid/vaste wensen, daarna veilige marge, dan gemakken. Noem niet-meetbare capaciteit/temperatuurherstel geen harde zekerheid.

## 6. Contract en statussen — Claude reviewronde 0 (D1/D2)

**Letterlijk contract van Claude, ronde 0 — door gebruiker overgedragen (7 november 2026):**

```text
Input = { now, houseZone, serveDate, availableFrom: Instant|null,
  slots:[{id, at:Instant, toleranceMin, laterAllowedMaxMin}],
  kamados:[{id, preheatMin:number|null, maxConcurrent:number|null}],
  dishes:[{id, name, slotId, kamadoId, status, pinnedStart:Instant|null,
    segments:[{id, kind:'cook'|'changeover', durationMin, setup:{method,grate,tempC}|null}],
    restMin, maxHoldMin:number|null,
    prep:[{id, localDate, at:Instant|null, durationMin}], actuals}],
  limits:{maxCandidates, maxAlternatives≤3}, params:{sameSetupDeltaC:25} }
Output = { planStatus, searchStatus:'not_run'|'complete'|'budget_exhausted',
  tasks:[{id, type, dishId?, kamadoId?, at:Instant|null, localDate, timeKnown}],
  conflicts:[{code, ids, severity:'blocker'|'unknown'|'conditional'}],
  validation:[{code, field, dishId?}], alternatives:[], provenance:{engineVersion, inputFingerprint, assumptions} }
```

**PR1-compatibiliteitsmapping (veldnamen mogen afwijken, semantiek niet):**

| Claude-contract | Bestaande PR1-naam | Betekenis |
| --- | --- | --- |
| `houseZone`, `serveDate` | `timeZone`, `localDate` | IANA-huiszone en lokale serveerdatum |
| `slots`, `toleranceMin` | `serveSlots`, `toleranceMin ?? 0` | Vaste serveerinstants, tolerantiewaarde standaard nul |
| `kamados.maxConcurrent` | `kamados.capacity={unit:'dishes',value}` | Expliciet bekend maximum; anders onbekend |
| `dishes.kamadoId`, `pinnedStart` | `currentKamadoId`, `startConstraint?.at` | Hardware-ID en vastgepinde start |
| `segments.kind/setup` | `segments.method/accessory/heatC` | Fasen en bijbehorende opstelling |
| `dishes.prep`, `maxHoldMin` | `preparation`, `maxHoldMin:null` | Kalendergebonden voorbereiding, onbekende veilige warmhoudtijd |
| `tasks` | `proposedTasks` | Read-only tijden, sorteervolgorde en taakidentiteit |
| `conflicts.ids/severity:'conditional'` | `affectedIds/severity:'warning'` | Zelfde voorwaardelijke uitspraak, andere veldnaam |
| `validation:{code,field,dishId?}` | `validation:{code,affectedIds}` | Veld-/gerechtidentiteit moet traceerbaar blijven |
| `limits`, `laterAllowedMaxMin`, `searchStatus` | PR1: `searchStatus:'not_run'`, `alternatives:[]` | Kandidatenbudget, tijdsflexibiliteit en optimizer pas in PR2 |

PR1 gebruikt `toleranceMin` (standaard **0**) en `maxHoldMin:null`; `laterAllowedMaxMin` en `limits` worden pas in PR2 daadwerkelijk gebruikt. PR1 bouwt **geen optimizer** en vervangt de huidige v5-engine niet. In PR1 worden `actuals` en `status` niet gebruikt voor het plan; veilige sessieverankering en Live-herplanning zijn uitgesteld naar PR4.

### Status- en validatievoorrang (D2)

1. **Elke adapter- of validatiefout** (o.a. `DUPLICATE_ID`, `UNKNOWN_KAMADO`, `DURATION_UNKNOWN`, `TEMPERATURE_UNKNOWN`, `OUT_OF_RANGE`, `INVALID_DURATION`, tijd- en datumcodes) krijgt `severity:'unknown'`. Geen blocker zonder geldige invoer.
2. **`blocker` uitsluitend bij bewezen harde schending met geldige data.** Een bewezen harde schending is bijvoorbeeld een onverenigbare overlap, overschreden expliciete capaciteit of een te late vaste start.
3. **Vaste start:** `end > slot.at + toleranceMin` geeft blocker `FIXED_START_MISSES_SERVE`; `end < slot.at - toleranceMin` geeft uitsluitend voorwaardelijke waarschuwing `HOLD_UNVERIFIED`. Nooit een vastgepinde start wijzigen.
4. **`availableFrom` geldt alleen voor acties op `serveDate`.** Een handeling op een voorafgaande dag levert waarschuwing `AVAILABILITY_UNVERIFIED`, geen blocker wegens serveerdag-beschikbaarheid.
5. **Kamado-ombouw tussen gerechten:** daling van meer dan 60 °C zonder opgegeven afkoeltijd altijd `CHANGEOVER_UNVERIFIED` (voorwaardelijk); stijging >60 °C bij een tussenruimte korter dan 15 minuten eveneens. Vergelijk elk segment met de voorgaande relevante bezetting die daadwerkelijk het laatst eindigde, niet uitsluitend het voorafgaande item op starttijd.
6. **Voorbereidingen:** `prep.at + durationMin*60_000 > start` geeft blocker `PREP_AFTER_START`. Zonder kloktijd: een prep-datum na lokale startdatum is blocker; op startdatum is `PREP_TIME_UNVERIFIED` voorwaardelijk. Sorteer tijdloze prep-taken op het begin van hun `localDate`.
7. **Duur:** `cook=0` is `INVALID_DURATION`, niet een geldige bereiding. Null of negatieve data mogen nooit stilzwijgend naar 0 worden omgezet.
8. **Planstatus:** `infeasible > unknown > conditional > feasible`. Onbekende invoer wint van alleen voorwaardelijke warnings; een blocker vereist verifieerbare geldige gegevens. `searchStatus:'not_run'` blijft van kracht in PR1.
9. **Huiszone:** bewuste shadow-verschillen bij draaien op systemen buiten `Europe/Amsterdam` zijn mogelijk doordat legacy de systeemzone gebruikt; de nieuwe engine gebruikt de expliciete huiszone. De geplande legacy-pariteit moet onder `TZ=Europe/Amsterdam` worden gemeten.

### Scope en acceptatie

- `engine/time.mjs` gebruikt uitsluitend `Intl` voor DST-gap/fold validatie; lokale kalenderdagen worden in de huiszone berekend.
- `fromLegacyState(plainStateJSON,{houseZone,now})` leest ruwe invoer zonder `n()/minutes()`-clamping en maakt geen opslag-/DOM-wijzigingen.
- `plan(input)` is puur, deterministisch, read-only; geeft terugwaartse planning, kamado-vuurtijden, voorbereidingstaken, expliciete conflictcodes en geen alternatieven.
- Legacy `calc()` blijft leidend en wordt in PR1 alleen in de testharness aangeroepen.
- Eerst de 30 bestaande S-cases en Claudes tien nieuwe N-cases als orakels. PR1 test uitsluitend de aangewezen subset, PR2/PR3/PR4 krijgen hun eigen testcases.
- Geen wijziging aan `dist/`, `sw.js`, `index.html`, `manifest.webmanifest`, `hacs.json`, opslag, UI of appversie. Geen merge of publicatie zonder gebruikersakkoord.


## 7. Interface / UX voor iPhone

- Startscherm: `Serveertijd | Planstatus | eerstvolgende kritieke actie`, maximaal één primaire CTA.
- Tabblad **Planning**: per kamado horizontale tijdlijn (scrollbaar binnen het blok), duidelijke fasen, temperatuur/wissel/voorbereiding, tijdspeling; klik/drag is **voorstel in preview**, nooit meteen persist.
- Tabblad **Live**: één actie 'Nu doen', eerstvolgende 3–5 taken, verklarende updates bij vertraging; onderscheid `gepland`, `handmatig gemeld`, `geschat`, `live MEATER`.
- Tabblad **Waarom?** of uitklapdetail: harde conflictregel, wat vaststaat, alternatieven en risico. Geen extra navigatielaag die bestaande v5-onderbalk dupliceert.
- Responsief op 320/375/390/430/768/1024 px en HA iframe. Grote touchdoelen, toetsenbordbediening, reduced motion, VoiceOver-focus, veilige iPhone-randen.
- Geen modal die onbedoeld lokale data vervangt; preview met expliciet **Toepassen / Annuleren** en terugval. Toon datum naast tijd bij bereidingen over middernacht.

## 8. Gefaseerde techniek / releases (geen releaseautorisatie)

- **Fase A — onafhankelijke ontwerp-review:** Claude beoordeelt dit document en [30 scenario's](V6_SCENARIOS.md); levert gecorrigeerde regels en een formeel uitvoerbaar contract, nog geen code of merge.
- **Fase B — adapter en read-only validatiemodel:** transparant `legacy state → kandidaatmodel`; snapshots in tests, zonder nieuwe opslagsleutels.
- **Fase C — deterministische engine in shadow-mode:** bestaande `calc()` blijft leidend; vergelijk legacy en kandidaatplanning voor hetzelfde menu, leg verschillen uit. Geen automatische toepassing.
- **Fase D — preview-UI & handmatige toepassing:** zichtbare scenario's en alternatieven; rollback, toegankelijkheid en opslagregressies.
- **Fase E — Live bijsturen & leren:** pas na bewezen engine, pure testfixtures zonder MEATER-hardware; handmatige informatie blijft bruikbaar.
- **Fase F — praktijkacceptatie:** echte iPhone/HA/MEATER waar beschikbaar, Claude herreview, gebruikersakkoord, aparte merge/release.

Een aparte M4/M7-releasemanagement-PR blijft buiten dit ontwerpproject. De bestaande éénmalige workflow wordt hier niet aangepast.

## 9. Acceptatiecriteria voor de ontwerpfase

- [ ] Claude heeft actuele `main`, `calc()`, `smartPlan()`, `v45Allocation()`, `v46Tasks()`, opslagcontracten en tests zelfstandig bekeken.
- [ ] Elk hard constraint heeft een uniek ID en een onafhankelijk toetsbare pass/fail-definitie.
- [ ] De 30 scenario's S01–S30 hebben eenduidige verwachting: exact tijdstip waar mogelijk, anders invariant + conflictcode + testtype.
- [ ] Minimaal één expliciete oplossing voor haalbaarheid, tijdzones/DST, overvolle kamado, vaste tijden, vóór-dag-taken en afwezige MEATER.
- [ ] Complexiteitslimiet en gedrag bij `unknown`/timeout op papier vastgelegd.
- [ ] Documentatie benoemt verschillen met huidige engine zonder bestaand gedrag als bewezen defect te etiketteren.
- [ ] Uitvoer is **ontwerp-GO / ontwerp-NO-GO**; geen appcode, storage of appversion aangepast.
- [ ] Na GO krijgt ChatGPT concrete modulegrenzen, adaptercontract, tests en één smalle implementatie-PR als eerste stap.

## 10. Nog te beslissen vóór implementatie

- **Roostercapaciteit:** benodigde actuele afmetingen/accessoires onbekend; zonder die gegevens geen automatische bewezen gelijktijdige bezetting.
- **Tijdspeling:** voorstel eerst parametrisch op 0/5/10/15 min; nul is geen impliciete veilige keuze.
- **Opstook- en ombouwtijden:** vanaf bestaande instellingen maar markeer ontbrekende fysische variatie; geen fictieve garantie.
- **Meerdere kamado's:** huidige engine modelleert `large` en `small`; uitbreiden naar twee groot + een klein is vervolgscope, niet stiekem een v6-datamigratie.
- **Meerdere gangen:** stel een expliciet slotmodel vast naast de legacy `v46MultiServe`-mapping.
- **Kookveiligheid:** recepten en kerntemperaturen niet automatisch herdefiniëren; review van adviesteksten op veilige formulering.

**Opdracht aan Claude:** gebruik [de onafhankelijke reviewbrief](V6_CLAUDE_REVIEW.md), voeg kritiek of alternatieven met bewijs toe, geef pas GO bij toetsbare harde regels en scenario's.
