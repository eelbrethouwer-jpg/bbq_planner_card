# BBQ Planner — mobiele UX-herinrichting (ontwerp en impactanalyse)
**Status:** ontwerp + implementatie (Claude, 8 november 2026) in draft PR #36 als releasekandidaat v5.2.0. Niet gemerged of gepubliceerd.  
**Datum:** 8 november 2026  
**Baseline voor deze analyse:** `main` `d962e4e8ae5d93e117ca1737fb357acfbd9bbe24`, officiële GitHub Release `v5.1.1`; `v6/preview.html` is de apart toegankelijke read-only v6.0.0-beta.1. Controleer actuele HEAD en CI opnieuw vóór codewerk.  
**Gebruikersbron:** zes iPhone-PWA-screenshots (8 november 2026); de afbeeldingen zelf zijn niet in de repository opgenomen. Tracking: issue #35.

## 1. Bestaande navigatie en impact

| Gebruikersroute | Huidige techniek | Te beschermen |
| --- | --- | --- |
| Vandaag + nieuwe sessie / hervatten | `dist/bbq-v5.js`: `home()`, `start()`, `goto()`, `render()` | `bbq-v5-session-v1`, bestaande v4-plans, bevestiging en backup bij nieuwe sessie |
| Recepten | `dist/bbq-v5.js` → `legacy('recipes','library')`; tabs in `dist/bbq-v501.js` | generator, eigen bibliotheek, BBQ Junkie, tabkeuze, receptenfoto's, import/export, reviews |
| Live | `dist/bbq-v5.js`: `live()`, `liveDish()`, `toggleDone()` en `setPhase()` | serveertijd, taak-ID's, afvinken, fase, actuals, real-time of juist ontbrekende MEATER data |
| Meer + historie + utility's | `legacy('more')`, de oudere `v47`-pagina's in `dist/BBQ_bereidingsplanner_MEATER_v4.html` | voorraad, boodschappen, HA-instellingen, appupdate, opslag, export, import, print, historie |
| Onderste navigatie | `renderNav()` maakt één zichtbare `#v5-nav`; oudere `#v47-nav` is verborgen | tabfocus, tabstatus tijdens legacy Live/recepten, één bottom nav |
| Layout | `dist/bbq-v5.css`, `bbq-v501.css`, `bbq-v502.css`, `bbq-v510.css` | iOS safe areas, inputbreedtes, sticky acties, open `details`, keyboard & focus |

Belangrijk: `dist/BBQ_bereidingsplanner_MEATER_v4.html` is ondanks de naam het productie-HTML-bestand. Niet automatisch v6 in productie integreren. De zichtbaar gedrukte tekst 'App Edition v4.9.1' op een instellingenscherm is niet hetzelfde als de gepubliceerde GitHub Release `v5.1.1`.

## 2. Geobserveerde problemen / nog te reproduceren

1. **P0 — statusbar overlap. Oorzaak in code bevestigd.** `apple-mobile-web-app-status-bar-style` is `black-translucent`, dus de app tekent onder de statusbalk. `body.v5-ready .shell{padding:15px …}` in `dist/bbq-v5.css` overschreef de oudere safe-area-regels (zelfde specificiteit, later geladen). Met Chrome-emulatie van een iPhone-safe-area van 59 px stond de kop op 17 px (overlap); de sticky Live-balk plakte op 0 px en de focusmodus had 10 px marge. Opgelost met tokens `--v5-safe-top/--v5-safe-bottom` en een statusbalk-scrim. Fysieke bevestiging op iPhone blijft open.
2. **P1 — Live te lang.** Nu-doen-knop goed, maar grote kamadotegels, checklist, receptfasen, vier secundaire acties en detailgroepen kosten te veel verticale ruimte.
3. **P1 — Meer is een lange verzameling.** PWA-installatie, boodschappen, voorraad, HA, historie en export/print zijn even prominent en de onderkant is moeizaam te vinden.
4. **P2 — receptenoverzicht.** Grote brontegels, een lege bibliotheek en imports nemen de eerste viewport in zonder directe toegang tot een receptzoekactie.
5. **P2 — status van oude sessie.** Op screenshots wordt 25 oktober als afgelopen sessie getoond. Zorg dat oude geplande tijden eerlijk 'verstreken' blijven en knoppen nooit suggereren dat een taak vanzelf is uitgevoerd.

## 3. Gewenste mobiel-eerste wireflow

### Vandaag
- Compacte appheader met juiste safe-area (niet onder iOS statusbalk), naam en herkenbare huidige sessie.
- Eerste hoofdkaart voor **Hervat live bereiding** wanneer actief; anders **Nieuwe sessie** als hoofdfocus.
- Eén compacte secundaire route naar `Recepten` en `Historie`; geen herhaling van bottom-nav-acties.
- Sessiedatum, serveertijd en gerechten helder en kort.

### Recepten
- Titel, zoekveld en **+ Gerecht** in de eerste viewport; drie bronkeuzes (eigen recepten, import/genereren, BBQ Junkie) als compacte tabs.
- Toon bij nul eigen recepten een rustige lege staat en één actie tot toevoegen/importeren; export/synchronisatie niet vóór recepten tonen.
- Bewaar bestaande `v501SelectRecipeTab`, gebruikersrecepten en selectie; verander geen import-/opslagcontracten.

### Live — belangrijkste scherm
1. Bovenaan een compacte sticky statusregel **Serveertijd · teller · voortgang**. Houd rekening met safe-area en niet afdekken van header.
2. **NU DOEN** als primaire kaart: korte handeling, kamado, geplande tijd, één opvallende knop **Markeer uitgevoerd**; recept bekijken secundair. Als geen taak: afgeronde status met voedselveiligheidstekst.
3. Twee compacte kamado-statuskaarten naast elkaar op mobiele breedtes waar leesbaar, anders verticaal (geen afgekapt tekst). Per kamado naam, gerecht of 'Niet in gebruik', geplande grilltemperatuur, geen nep-MEATER-meting.
4. **Volgende taken** als compacte lijst van hoogstens de volgende drie zichtbare taken; rest achter **Toon alle**. Behoud de bestaande logica en IDs; niet ongevraagd taken verbergen die aandacht vereisen.
5. Receptfasen, afgeronde acties, MEATER/focus, planning wijzigen, voorbereiding en sessie beëindigen als duidelijk benoemde maar secundaire opties. Risicovolle beëindiging blijft met bevestiging.
6. Scrollpositie, open details en focus bij de 30-seconden live-rerender blijven behouden. De bestaande check in `tests/v510-smoke.mjs` is uitgangspunt, niet voldoende voor iOS-visuele regressies.

### Meer
- Een compact **functiemenu**, in logische groepen: **Koken** (voorraad, boodschappen, historie), **Koppelingen** (Home Assistant, MEATER-uitleg), **Gegevens** (backup/import/export/print), **App** (installatie, update en delen).
- Groepen in eerste instantie compact en bereikbaar via toegankelijk uitklapmenu/sectienavigatie; verplaats bestaande DOM-formulieren niet zonder opslag- en eventlistenercontrole.
- Geen lange disclaimer in de eerste viewport; bewaar noodzakelijke voedselveiligheidswaarschuwingen onder Help/Info.
- De oude legacy-terugweg en bottom-nav-status blijven correct functioneren.

### Visuele taal
- Donkere achtergrond, één warm oranje accent alleen voor hoofdactie, subtiele tegels voor secundaire keuzes.
- Consistente typografie en ruimte: grote paginatitel, compacte sectietitels, beschrijvingen kort; minimaal 44×44 CSS px voor touch.
- Eén zichtbare vaste ondernavigatie (Vandaag, Recepten, Live, Meer), met `env(safe-area-inset-bottom)` en voldoende ruimte voor laatste actie. Inputs mogen niet achter het toetsenbord verdwijnen.
- CSS gericht op schermspecifieke selectors; vermijd globale `overflow-x:hidden` als symptoombestrijding.

## 4. Technisch voorstel / veilige werkvolgorde

1. Leg *vóór codewijzigingen* viewport-baselines en DOM-screenshots vast bij 320, 375, 390, 430, 768 px in Chromium/WebKit, plus PWA/iframe context waar simuleerbaar. Neem ook lange taaktekst, lege receptenlijst, sessie met oude serveertijd, actieve live en toetsenbord-open mee.
2. Fix in eerste aparte commit de safe-area/overlay op root én legacy: introduceer een consistente boven-offset zonder dubbele padding of gefixeerde terugknop over content. Controleer viewport-fit en statusbar-stijl in HTML voordat fallback CSS wordt toegevoegd.
3. Volgende commits: Live compact en toegankelijk; Recepten primaire taken prominenter; Meer menus in functionele groepen; behoud old-to-new route.
4. Raak engine/optimizer, `v6/**`, localStorage schema's en HA-/MEATER-bridge **niet aan**. Wijzig externe publicatie/caches/versie enkel met een expliciet en consistent releaseplan, niet in ontwerpcommit.
5. Voeg browser-bounds- en interactietests toe; voer de bestaande checks uit. Review echte diffs; houd PR draft tot volledige CI en onafhankelijke review.

## 5. Acceptatiematrix

| Controle | Methode | Vereist resultaat |
| --- | --- | --- |
| Header / iPhone safe area | WebKit screenshots + fysieke standalone PWA/Safari | Geen overlap met statusbalk, geen dubbele lege rand; ook bij legacy-terugknop |
| Breekpunten | 320, 375, 390, 430, 768 px + desktop | Geen horizontale overflow, verloren tekst, overlappende knoppen of dubbele nav |
| Live/MEATER | DOM + WebKit/Chromium, fixturedata expliciet als fictief | Elke taak zichtbaar/uitvoerbaar, MEATER alleen als werkelijk vers, fase en actuals ongewijzigd |
| Her-render | `tests/v510-smoke.mjs` + browsercheck | Open details, focus en scroll worden niet onverwacht gereset |
| Navigatie | Start → Recepten → Live → Meer → terug | Eén nav, correcte actieve tab, toegang tot alle bestaande functies |
| Recepten en gegevens | jsdom + browser import/export | Recepten, reviews, historie en opslag ongewijzigd; geen stille migratie |
| Publicatiegrenzen | checks van v5 CSS/HTML en v6-guard | Geen onbedoelde koppeling aan v6, geen release of automatische datamigratie |
| Hardware | echte iPhone, HA/HACS, MEATER Pro/Plus | Alleen als PASS vermelden wanneer daadwerkelijk getest; anders OPEN |

### Regressie- en publicatiebesluit
Test `tests/v5-smoke.mjs`, `v501-smoke.mjs`, `v510-smoke.mjs`, `mobile-bounds.mjs`, `pwa-smoke.mjs`, `version-consistency.mjs`, bestaande v6 guard en relevante GitHub workflows. Controleer hun daadwerkelijke CI-status op laatste PR HEAD. Een volledig groene browser-CI is **geen** echte iPhone-acceptatie. Een PR (ook groen) is **geen** merge- of release-akkoord.

## 6. Open beslissingen / onzekerheden
- Is de safe-area-bug specifiek voor standalone PWA, ook voor Safari, of uitsluitend in de huidige appcache? Hierover is op basis van screenshots alleen nog geen zekerheid.
- De gebruiker mag geen data verliezen door een update; voor PWA en Home Assistant gelden verschillende opslagcontexten.
- Extra functies of versienummer niet vooraf vastleggen: kies een versiebump op basis van daadwerkelijke diff en releasecontract.
- Claude kan als onafhankelijke reviewer een volledige check uitvoeren zodra **een code-PR en actuele HEAD** beschikbaar zijn. Deze ontwerpnotitie is geen voltooid herontwerp of testbewijs.


## 7. Fase A — onafhankelijke ontwerpcontrole (Claude, 8 november 2026)

Uitgangspunt: `main` `d962e4e`, PR #36 HEAD `99605ec`. Code gelezen: `dist/bbq-v5.js`, alle v5-CSS, `v47Init()` en de Meer-/Receptenmarkup in de productie-HTML, de bestaande tests en `validate.yml`.

| Ernst | Bevinding | Besluit |
|---|---|---|
| HOOG | P0 statusbalk: oorzaak is één CSS-regel, niet de PWA-cache (zie §2.1). | Opgelost bij de bron, niet met een extra override-laag. |
| HOOG | CI-stap `git diff --exit-code origin/main -- dist index.html sw.js` (route B) maakt elke UX-wijziging onmogelijk. | Vervangen door een controle dat v5-publicatiebestanden nooit naar `v6/`, `v6preview` of `engine/` verwijzen. Dit versoepelt een bestaande bewaking en vraagt reviewer- en gebruikersakkoord. |
| HOOG | Een merge van deze PR publiceert `dist/` direct op GitHub Pages. | Versie 5.2.0 consistent doorgevoerd (cache-busting); merge = publicatie, dus apart akkoord. |
| MIDDEL | Focus-kookmodus (`#v45-cook-screen`) had geen safe-area en lag onder de onderbalk (z-index 400 < 450). | Safe-area + z-index 480. |
| MIDDEL | Tests leggen DOM-contracten vast (`nav`-aantal = 2, `.v5-hero` vóór `.v5-kamados` als directe kinderen, ≤ 5 vervolgtaken). | Contracten behouden; alleen ≤ 5 → ≤ 3 bewust aangepast. Geen extra `<nav>` in Meer. |
| LAAG | Ontwerp stelde "sectienavigatie" voor in Meer. | Snelkeuzeknoppen in een `role=group`, geen tweede navigatie. |
| LAAG | Repo stapelt per versie een CSS-bestand. | Safe-area bij de bron gerepareerd; nieuwe schermstijlen in één `bbq-v520.css`. Opschonen van de CSS-lagen is apart onderhoud. |

Eenvoudiger alternatief overwogen: alle legacy-schermen herschrijven in v5. Afgewezen: veel groter regressierisico op recepten, import, reviews en HA-sync. Gekozen: bestaande DOM-knooppunten **verplaatsen** (nooit klonen), zodat event listeners, ID's en opslag gelijk blijven.

## 8. Geïmplementeerd (v5.2.0-kandidaat)

| Scherm | Wijziging | Bestanden |
|---|---|---|
| Alle | Safe-area-tokens, statusbalk-scrim, rustige terugknop, focusmodus boven de onderbalk | `bbq-v5.css`, `bbq-v501.css`, `bbq-v510.css`, `bbq-v520.css` |
| Vandaag | Eén primaire kaart (hervatten óf nieuwe sessie), compacte lijst met nieuwe sessie / recepten / historie; historie opent direct de juiste uitklapper | `bbq-v5.js` `home()`, `openHistory()` |
| Live | Volgorde statusbalk → NU DOEN (enige oranje knop) → tikbare kamadokaarten → 3 vervolgtaken → details → 2×2 acties | `bbq-v5.js` `live()`, `liveDish()` |
| Recepten | Compacte brontabs; import/export/sync achter één uitklapper; importfeedback blijft zichtbaar | `bbq-v5.js` `organizeRecipes()`, `bbq-v520.css` |
| Meer | Groepen Koken, Koppelingen, Gegevens, App en info + snelkeuze; MEATER-uitleg met knop naar grafiek/focus | `bbq-v5.js` `organizeMore()` |

Niet gewijzigd: v4-engine, `calc()`, taak-ID's, `toggleDone()`/`setPhase()`, opslagsleutels en -schema's, recepten/reviews/historie, HA/MEATER, `v6/**`, `engine/**`.

## 9. Open risico's en beperkingen
- Geen fysieke iPhone-, iPad-, Home Assistant- of MEATER-test uitgevoerd; safe-area alleen geëmuleerd.
- jsdom-suites (`smoke`, `v5-smoke`, `v501-smoke`, `v510-smoke`, v6-jsdom) konden lokaal niet draaien (geen netwerk voor jsdom); CI moet ze bevestigen.
- WebKit lokaal niet beschikbaar; alleen CI draait WebKit.
- Receptenbibliotheek heeft nog geen eigen zoekveld; zoeken gebeurt in *Kies gerechten* en BBQ Junkie.
- De iOS-PWA heeft een eigen opslag, los van Safari; de update vervangt niets, maar test bestaande gegevens na update op het toestel.
