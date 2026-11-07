# Claude-reviewopdracht — BBQ Regisseur v6.0 Design Challenge

**Rol:** onafhankelijke systeemarchitect + adversarial tester. **Niet coderen, committen, mergen of releasen.** Gebruik de huidige repository als enige feitelijke bron; maak geen aannames dat ChatGPT-analyses of de ontwerpdocumenten correct zijn.

**Reviewbronnen:**
1. [V6_DESIGN_CHALLENGE.md](V6_DESIGN_CHALLENGE.md) — doel, constraints, engine-contract, UI, fases.
2. [V6_SCENARIOS.md](V6_SCENARIOS.md) — 30 voorgestelde testorakels.
3. [../PROJECT_STATUS.md](../PROJECT_STATUS.md) en [AI_WORKFLOW.md](AI_WORKFLOW.md) — v5-bronnen en werkproces.
4. Actuele `main`, PR-diff en Actions in GitHub, met exacte commit-SHA; niet vertrouwen op deze handoff als live status.

## Specifiek te inspecteren code

- `dist/BBQ_bereidingsplanner_MEATER_v4.html`: `calc()`, `phaseSegments()`, `dateAt()`, `v46DishServe()`, `v46Tasks()`, `v46PrepTasks()`, `smartPlan()`, `v45Allocation()`/`v45Score()`, `v45Historical()`, `v45Probe()`.
- `dist/bbq-v5.js`: `b.calculate()`/ `b.getTasks()`/Live, v5 UI navigation, state writes, session metadata.
- `dist/bbq_planner_card.js`: HA sensorbron en personal storage (alleen inspecteren).
- `tests/smoke.mjs`, `tests/v510-smoke.mjs`, `tests/mobile-bounds.mjs`, `tests/version-consistency.mjs` en `.github/workflows/validate.yml`.

## Werkpakket A: aanval op de specificatie

- Kan het ontwerp harde en zachte constraints ondubbelzinnig onderscheiden?
- Welke scenario's zijn onterecht te stellig omdat kamadocapaciteit, warmteherstel, accessoire of serveertolerantie ontbreken?
- Zijn `feasible`, `conditional`, `infeasible`, `unknown` onderling sluitend en implementeerbaar?
- Hoe modelleer je resourcebezetting bij gecombineerde fasen, ombouw, preheat en overlap?
- Hoe sluit het voorgestelde tijdmodel aan op lokale kalenderdagen, DST-gap/fold, handmatige starts en meergangenschema's?
- Wat is de kleinste geschikte deterministische optimizer? Lever complexiteitslimieten en minimaal twee alternatieven met voor- en nadelen.
- Hoe garandeer je geen silent replan, geen schema-/opslagregressie en geen onterechte live/veiligheidsclaim?
- Wat is je aanbeveling voor ondersteuning van een extra grote kamado zonder oude localStorage-keys te veranderen?

## Werkpakket B: maak het testplan echt toetsbaar

- Review **alle 30** scenario's; markeer per ID `OK | ONDUIDELIJK | FOUT`, met ontbrekende input, bewijs, verwachte output en correctie.
- Controleer de exacte tijden S01/S02/S06/S14 handmatig en DST datums S17/S18.
- Voeg minimaal **10 extra adversarial gevallen** toe die geen duplicaat van de bestaande 30 zijn (indien nuttig).
- Scheid **bestaande code-eigenschappen** van **nog te bouwen gewenste eigenschappen**.
- Definieer een pure, minimale fixture-API en een betrouwbaar testoracle (geen echte sensor vereist).
- Beoordeel welke bestaande CI-routes voldoende zijn en welke nieuwe tests nodig zijn.

## Werkpakket C: concreet implementatieadvies aan ChatGPT

Lever een API-/moduleontwerp en implementatievolgorde in kleine PR's:
- eerste PR alleen pure engine + adapter + shadow-mode + echte tests, zonder UI-/storagewrites;
- volgende PR pas preview/tijdlijn;
- daarna handmatig toepassen en Live-herplanning;
- compatibiliteitsgrenzen, rollback, prestatiebudget en acceptatietests per PR.

## Verplichte oplevering

1. **Feitencheck** — main/PR HEAD/tag, codepaden, daadwerkelijk gelezen tests, wat niet bereikbaar was.
2. **Topbevindingen** — `BLOCKER | HOOG | MIDDEL | LAAG`, bestand/regel of scenario-ID, waarom, kleinste correctie.
3. **30-scenario audit** — per S01–S30 expliciet oordeel en correcties, in tabel.
4. **10 nieuwe aanvalsscenario's** — met invoer, oracle en risico.
5. **Ontwerpbesluiten** — harde/zachte constraints, tijdmodel, resources, determinisme, algoritme/complexiteit en impact op bestaande data.
6. **Bouwopdracht voor ChatGPT** — afgebakende eerste PR met exacte acceptatiecriteria en regressies.
7. **Eindoordeel** — `DESIGN GO | DESIGN GO MET PUNTEN | DESIGN NO-GO`; vermeld expliciet dat dit **geen** releaseautorisatie is.

**Belangrijk:** jij bent hier bewust de tegenkracht van ChatGPT. Zoek conceptuele fouten. Vraag geen fysieke MEATER-acceptatie voor de ontwerpfase. Schrijf nog geen appcode en wijzig de repository niet.
