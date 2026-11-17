# BBQ Planner v5.5.0 — Tijdlijn op Live en "Zo meteen"

**Status: releasekandidaat (draft-PR), niet gepubliceerd.** Basis: `948249decc1574d93f50c4141f7422d30e5b254d` (main na PR #44; code v5.4.0).

## Wat is gewijzigd?
- **Tijdlijn bovenaan Live.** Per kamado één baan van aansteken tot serveren: de planning als stippelkader, de verwachting in kleur (indirect, ombouw, schroeien, rust), een rode nu-lijn en een groene serveerlijn. Tik op een baan om naar de gerechtkaart te gaan. De tijdlijn ververst met de 30-secondentimer, nooit bij een sensorupdate. Daaronder "Alle stappen" naar de ene takenlijst.
- **"Zo meteen" volgt de werkelijkheid.** De bovenste actie komt uit de schatting en de fase van de gerechten op de BBQ, bijvoorbeeld "Stook de grote kamado op naar ~250 °C — Ribeye bereikt 47 °C (einde indirect) over ±1 min", daarna "Schroei … direct op ~250 °C" en "Haal … van de BBQ — kern bereikt". Het fasedoel komt uit de schattingsmodule.
- **Aansteken wordt automatisch afgevinkt** zodra een gerecht op die kamado op de BBQ ligt ("Steek grote kamado aan" verdwijnt na "Op BBQ gelegd").
- **Verwacht naast gepland** bij taken als die meer dan 5 minuten verschillen.
- **"Pas planning aan op verwachting"** verschijnt alleen als de verwachte serveertijd meer dan 10 minuten afwijkt. De knop toont eerst voor/na; pas na "Bevestig" verandert de serveertijd (dezelfde route als "Serveren om" in stap 2). Zonder bevestiging blijft de opslag byte-gelijk.
- **MEATER automatisch herkennen (Home Assistant-kaart).** De probe waarvan metingen binnenkomen, wordt gekoppeld aan het gerecht dat op de BBQ ligt (bij twee actieve vrije probes: de Pro). De kaart toont "MEATER Pro automatisch gekoppeld · wijzigen". Een keuze van de gebruiker wordt nooit overschreven en een probe wordt nooit van een ander gerecht afgepakt. Op de publieke website wordt geen probe meer automatisch gekoppeld.
- **Versheid van de meting.** Home Assistant schrijft alleen een nieuwe staat als de waarde verandert. Een ongewijzigde waarde van een beschikbare sensor heet nu "Geen verandering sinds HH:MM" in plaats van "verouderd", en de schatting vervalt dan niet. Wordt de sensor `unavailable` (MEATER offline) of verliest de HA-app de verbinding, dan verdwijnt de waarde. `last_reported` wordt gebruikt als de HA-frontend het ooit meelevert; de huidige frontend doet dat niet (zie de PR).
- **Publieke website:** de tekst bij een gekoppelde probe is nu "Live-metingen alleen in de Home Assistant-kaart".

## Opslag
- Nieuw **optioneel** veld per gerecht: `meaterAuto` (`true` = automatisch gekoppeld, `false` = keuze van de gebruiker, ook "Geen"; ontbreekt = oude data, behandeld als "niet gekozen" bij geen probe en als keuze bij een gekoppelde probe). Geen nieuwe sleutels, geen schemawijziging van bestaande velden.
- Bestaande taakstatus `v46Done` krijgt bij "Op BBQ gelegd" ook de aansteektaak van die kamado.

## Niet gewijzigd
- v5.2.3-contract: een sensorupdate ververst alleen de vakjes van de gerechtkaart; één 1-s-timer en één 30-s-timer.
- `v6/` en `engine/`. De v6-voorstel-/apply-route kan de productiepagina niet laden (publicatiebewaking) en is volgens zijn eigen contract niet bedoeld om in v5 te mounten.

## Beperkingen
- Fasedoel reverse sear = doel − 7 °C (AANNAME tot `coreAt` in PR 4).
- Geen echte Home Assistant-, MEATER- of iPhone-test; alle tests gebruiken gemarkeerde fixtures.

Zie ook [PROJECT_STATUS.md](PROJECT_STATUS.md) en [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md).
