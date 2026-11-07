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

## 6. Gecorrigeerd PR1-contract — verifieer nog tegen de letterlijke Claude-review

**Bronstatus:** deze tabel volgt de expliciete gebruikersopdracht voor stap 1. De oorspronkelijke tekst van Claude (HOOG-1 t/m HOOG-4 en het gecorrigeerde contract) is **niet** beschikbaar via PR #31, GitHub-comments of de projectbestanden. De hier vastgelegde afspraken zijn daarom een *voorlopige implementatiebaseline*, niet een geverifieerde letterlijke kopie van Claude's review. Ontwerp-GO vereist bronvergelijking door Claude.

**Statusvoorrang:** `infeasible > unknown > conditional > feasible` — als zowel harde blokkade als onbekende invoer voorkomen, wint `infeasible`; anders wint `unknown` van `conditional`. `searchStatus='not_run'` is de enige geldige waarde in PR1: geen optimizer, geen alternatieven en geen claim op globale haalbaarheid.

**PR1-modules (read-only, niet in app geladen):**
- `engine/time.mjs`: `toInstant(localDate,localTime,zone,disambiguation?)` retourneert `{ok:true,at}` of `{ok:false,code}`; alleen Intl. Codes: `NONEXISTENT_LOCAL_TIME`, `AMBIGUOUS_LOCAL_TIME`, `INVALID_DATE`, `INVALID_TIME`. `localParts(at,zone)` voor presentatie. Geen verborgen DST-correctie.
- `engine/adapter.mjs`: `fromLegacyState(plainStateJSON,{houseZone,now})` retourneert `{input,validation}`. Bewaak **ruwe** waarden: `null` is niet nul; negatief is ongeldig; >10.000 minuten buiten bereik; dubbele gerecht-ID's en onbekende kamado's blijven zichtbare fouten. Compatibiliteitsmapping volgt `phaseSegments()`: `cook` is totale actieve fase-duur, `phase2Minutes` daarvan afgetrokken, `transitionMins` daarbovenop.
- `engine/check.mjs`: `plan(input)` retourneert een **deterministische**, bijwerkingsvrije backwards-planning per gerecht, inclusief preheat op kamado, voorbereiding met `localDate`/`timeKnown`, conflicten en gesorteerde taken. Geen DOM/localStorage/Date.now. Nooit zelf een fixed start of serveertijd wijzigen.

```ts
type ValidationIssue = {code:string; affectedIds:string[]};
type ServeSlot = {id:string; at:number|null};
type Kamado = {id:string; preheatMin:number|null;
  capacity:null|{unit:"dishes";value:number}};
type Segment = {id:string; durationMin:number; heatC:number|null;
  method:string; accessory:string};
type Preparation = {id:string; localDate:string|null;
  localTime:string|null; timeKnown:boolean; at:number|null; durationMin:number|null};
type Dish = {
  id:string; name:string; currentKamadoId:string; slotId:string;
  status:"waiting"|"cooking"|"resting"|"done";
  segments:Segment[]; restMin:number|null; preparation:Preparation[];
  startConstraint:null|{kind:"fixed";at:number|null};
  immutableActuals:{startedAt:number|null;restAt:number|null;doneAt:number|null};
};
type Input = {
  now:number;timeZone:string;localDate:string;
  serveSlots:ServeSlot[];availableAt:number|null;
  kamados:Kamado[];dishes:Dish[];validation:ValidationIssue[];
};
type Output = {
  planStatus:"infeasible"|"unknown"|"conditional"|"feasible";
  searchStatus:"not_run";
  dishes:Array<{id:string;kamadoId:string;slotId:string;
    start:number;cookEnd:number;end:number;serveAt:number;
    restMin:number;cookMin:number;fixed:boolean}>;
  fires:Record<string,number|null>;
  proposedTasks:Array<{id:string;type:string;at:number|null;
    end?:number;dishId?:string;kamadoId?:string;
    localDate?:string|null;timeKnown?:boolean}>;
  conflicts:Array<{code:string;affectedIds:string[];
    severity:"blocker"|"unknown"|"warning";explanation:string}>;
  alternatives:[];
  provenance:{engineVersion:string;inputFingerprint:string};
};
```

**Harde conflictregels van PR1:** `INCOMPATIBLE_SETUP`, `CAPACITY_UNVERIFIED`, `RESOURCE_CAPACITY`, `CHANGEOVER_UNVERIFIED`, `PREHEAT_UNAVAILABLE`, `EARLIEST_START_AFTER_REQUIRED`, `FIXED_START_MISSES_SERVE`, `HOLD_UNVERIFIED`, `PREP_AFTER_START`. Daarnaast invoervalidatie `DURATION_UNKNOWN`, `INVALID_DURATION`, `OUT_OF_RANGE`, `DUPLICATE_ID`, `UNKNOWN_KAMADO` en tijd-/datumcodes. Bewaak expliciet *halfopen* resource-intervallen `[start,end)`.

**Taakordening:** `(at, type, kamadoId, dishId, id)` met gedocumenteerde `type`-prioriteit en stabiele tie-break. Voorbereidingen zonder tijd krijgen `at:null`, `timeKnown:false` en behouden hun kalenderdatum.

**Geen stilzwijgende compatibiliteitsclaim:** `calc()` blijft huidige waarheid; PR1 mag bewust strengere statussen geven dan legacy. Verwacht exacte tijdpariteit S01/S02/S06/S14 en verklaarde semantische afwijkingen S03/S04/S08/S13/N03.

**Test- en releasepoort:** echte `node tests/v6-engine.mjs`-orakels + `node tests/v6-shadow.mjs` naast bestaande CI, <50 ms op S30, mutatietests (dubbele bezetting, vaste start), geen runtime-filewijzigingen. Nog geen v6-apprelease, geen import in de publieke app.

**Belangrijk:** deze types zijn een eerste ontwerp, géén toezegging van opslagwijzigingen. Maak een **adapter** van bestaande `state` naar het nieuwe model, schrijf geen nieuw schema naar de bestaande localStorage-sleutels. Behoud de bestaande `large`/`small`-mapping in legacy-modus. De gebruiker heeft fysiek meer kamado's genoemd, maar dwing uitbreiding niet via een ongeteste migratie af. Plan ondersteunt meer apparatuur pas wanneer compatibiliteit en configuratie betrouwbaar zijn ontworpen.

**Zoekstrategie om te onderzoeken:** eerst deterministische constraints/checker + eenvoudige greedy/beam-search met begrensde kandidaten, voor kleine menu's eventueel exacte backtracking/branch-and-bound. Voorkom factorial blow-ups en UI-blocking; geef bij budgetlimiet een **partieel/unknown** resultaat, niet 'haalbaar'. Laat Claude worst-case complexiteit, tie-breaks en resourcegrenzen controleren.

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
