# BBQ Regisseur v6.0.0-beta.1 — releasevoorbereiding (route B)

**Status: kandidaat voor gecontroleerde openbare beta, GEEN publicatieakkoord.**
Dit document is een releaseplan en concept-release-notitie, **geen tag of GitHub Release**.

- Repository: `eelbrethouwer-jpg/bbq_planner_card`; PR: [#34](https://github.com/eelbrethouwer-jpg/bbq_planner_card/pull/34).
- Laatste vóór dit document gevalideerde code-HEAD: `b9b83cdde86a92d965c166cf64589fea655c8f1f`.
- Referentie-main: `f6f0d76322d41b9849ed7c417820e21b2e3f3712`.
- CI bij code-HEAD: [run 42425328639](https://github.com/eelbrethouwer-jpg/bbq_planner_card/actions/runs/42425328639), **5/5 groen**. Chromium en WebKit: 28 standalone-previewscenario's; daarnaast de bestaande mobile-bounds-, HACS-, JavaScript- en Node-tests.
- **Let op:** iedere volgende commit, ook documentatie, vraagt een nieuwe controle op de definitieve PR-HEAD en de complete PR-CI.
- Gebruikersbesluit: route B als ontwikkel-/publicatierichting; **geen toestemming voor merge, Pages-publicatie, tag of release**.

## Concept-releasetitel

**BBQ Regisseur v6.0.0-beta.1 — Slimme planning als veilige preview**

## Concept-release notes (nog niet gepubliceerd)

Een eerste, afzonderlijke testversie van BBQ Regisseur v6. De bestaande BBQ Planner v5.1.1 blijft exact gelijk.

**Nieuw**
- Losstaande `v6/preview.html` met een overzicht van de opgeslagen BBQ-planning en maximaal drie optimalisatievoorstellen, met tijdlijnen en waarschuwingen.
- Alleen-lezen optimizer in een Web Worker, zonder het actieve v5-plan te overschrijven.
- Optioneel **Bewaar als concept**: uitsluitend lokale metadata en hashes in een aparte opslagkey; vervanging vraagt bevestiging en bewaakt conflicten tussen tabbladen.
- Verouderde voorstellen worden ingetrokken als de v5-planning verandert, ook wanneer dat in hetzelfde tabblad of vanuit een ouder v5-tabblad gebeurt.
- Een hersteljournaal blokkeert uitsluitend de v6-preview. Er is een noodkopie-export en een expliciet bevestigde handmatige optie om alleen dat journaal te verwijderen. Dit is **geen automatische rollback**.
- Duidelijke Nederlandstalige foutmeldingen voor ontbrekende of corrupte planningen.

**Bewust nog niet aanwezig**
- Geen knop **Toepassen**; optimalisaties kunnen **niet** automatisch in de actieve v5-planning worden gezet.
- Geen Home Assistant/HACS/MEATER-live-integratie vanuit deze preview.
- Geen automatische synchronisatie tussen Safari, een geïnstalleerde beginscherm-PWA, andere browsers en apparaten.
- Geen offlinegarantie voor de preview: de bestaande v5-serviceworker cachet deze v6-bestanden niet.
- Geen opslagmigratie, automatische journal-recovery of wijziging van v5-opslagsleutels.
- Geen wijzigingen aan `dist/`, `index.html`, `sw.js`, `engine/` of de bestaande publieke v5-homepage.

## Waar komt de preview beschikbaar?

De bestaande projectwebsite is `https://eelbrethouwer-jpg.github.io/bbq_planner_card/`.
Als GitHub Pages de inhoud van `main` publiceert, maakt een merge de preview **publiek bereikbaar, ook zonder link in de navigatie**, op:

`https://eelbrethouwer-jpg.github.io/bbq_planner_card/v6/preview.html`

Dit is **geen privé-beta of toegangsbeveiligde omgeving**. De preview zelf leest wel uitsluitend opslag van de browser van de bezoeker. De exacte Pages-deployment en URL moeten **na** een toegestane merge apart worden gecontroleerd.

## Releasegates en besluiten

### Gate 1 — vóór eventuele merge (nu)

- [x] Route B gekozen: bestaande v5.1.1 ongewijzigd.
- [x] CI op code-HEAD `b9b83cd`: 5/5 groen; browserlogs gecontroleerd.
- [x] Versie- en file-pariteitscontroles staan in CI: `git diff --exit-code origin/main -- dist index.html sw.js`.
- [x] `onApply` is niet gekoppeld en de knop **Toepassen** verschijnt niet in de aparte preview.
- [ ] Alle CI-jobs opnieuw groen op de **actuele finale PR-HEAD**.
- [ ] Gerichte, onafhankelijke laatste review van de finale PR-HEAD (inclusief wijzigingen na de eerdere Claude-review).
- [ ] Expliciet akkoord van de gebruiker om de **publiek bereikbare beta via merge naar main te publiceren**.
- [ ] Pre-merge controle dat `main` niet is opgeschoven; als dat wel zo is, risico's en CI opnieuw beoordelen.

### Gate 2 — na een apart goedgekeurde beta-merge

- [ ] Publieke preview-URL reageert correct; geen ongewenste koppeling aan v5 of automatische v5-update.
- [ ] Echte **iPhone in Safari**, dezelfde projectorigin: een **fictief testplan** in de bestaande v5-pagina opslaan; de preview moet het plan en de gerechten tonen.
- [ ] Op die iPhone voorstellen berekenen; maximaal drie tonen; geen zichtbare knop Toepassen.
- [ ] Expliciet één voorstel als concept bewaren; terug naar v5; oorspronkelijke planvelden onveranderd; na herladen meldt de preview een actueel concept.
- [ ] Serveertijd in een **ander Safari-tabblad** met v5 wijzigen; bestaande v6-voorstellen verdwijnen; concept wordt als verouderd gemarkeerd.
- [ ] Twee gelijktijdige Safari-previewtabbladen: geen stille conceptvervanging; bevestiging/annuleren correct.
- [ ] Geïnstalleerde iPhone-PWA **apart** controleren: hoofdscherm en bestaande sessie werken; géén veronderstelling dat Safari en PWA dezelfde opslag delen.
- [ ] Werking zonder opgeslagen plan is begrijpelijk; oorspronkelijke v5-bibliotheek, reviews en opslag blijven intact.
- [ ] Een aparte fysieke iPhone-PWA-test is **niet vervangen** door Playwright WebKit.

**Geen productielaunch-/breed uitrol-GO vóór Gate 2 is uitgevoerd.** Een beta-merge maakt de preview wél direct publiek, nog voordat deze fysieke acceptatietests klaar zijn. Dat risico moet de gebruiker expliciet aanvaarden.

## Veilige uitvoering als de gebruiker later publicatie goedkeurt

1. Controleer op het laatste moment: actuele PR-HEAD, mergeability, reviewstatus, complete CI en diff naar `main`; nooit van een eerder groen SHA uitgaan.
2. Leg vast dat de gebruiker een **publiek bereikbare, ongelinkte beta** autoriseert, niet alleen een interne test.
3. Merge uitsluitend de getoetste HEAD volgens het normale PR-proces. **Geen automatische versie-, tag- of HACS-release.**
4. Controleer de Pages-deployment, de gewone v5-pagina en de separate v6-preview-URL.
5. Voer Gate 2 uit op een echte iPhone, bij voorkeur met **fictieve** gerechten en zonder live bereiding. Maak waar mogelijk eerst back-ups via de bestaande v5-functies; wis geen browserdata om een test te forceren.
6. Bij een mislukte Gate 2: **stop verdere uitrol**, laat v5 ongemoeid en beoordeel een gerichte revert van de v6-previewbestanden op main. Een revert verwijdert niet automatisch reeds lokaal bewaarde conceptmetadata uit browsers.

## Risico's, beperkingen en open werk

| Risico | Beoordeling / beperking |
| --- | --- |
| Preview publiek bereikbaar na merge | **Belangrijk.** Expliciete publicatietoestemming vereist, ook zonder navigatielink. |
| Safari/PWA gebruiken mogelijk verschillende opslag | **Gebruikersacceptatie open.** Test beide op echte iPhone; geen automatische import of synchronisatie. |
| Reeds geopende v5-tabbladen negeren v6-Web Locks | Preview wijzigt geen v5-planning. Een toekomstige schrijfende `Toepassen`-functie is nog **NO-GO**. |
| Toevallige/defecte hersteljournal | Preview blokkeert; noodkopie eerst controleren. Verwijderen is **niet** terugdraaien van v5-wijzigingen. |
| Offline preview | Niet in v5-serviceworker-shell; voor deze beta **niet gegarandeerd**. |
| v6-artefacten met concept- en toekomstige apply-code | Schrijfadapter is aanwezig als ongebruikte code, maar niet aan productie-UI gekoppeld; dit blijft reviewwaardig. |
| Browserworkflows getest in CI | Chromium/WebKit groen; **geen echte iPhone-, HACS-, MEATER- of fysieke kamadotest** uitgevoerd. |

## Eindoordeel bij opstellen

**Code:** GO MET OPMERKINGEN voor read-only route B op de eerder geteste code-HEAD.  
**Releasevoorbereiding:** gereed als controlelijst en concept-release-notities.  
**Merge:** **NOG GEEN GO** totdat finale HEAD, review en expliciet publicatieakkoord bevestigd zijn.  
**Breed uitrollen:** **NO-GO** tot de echte iPhone-acceptatietest is geslaagd.

Geen merge, tag, publicatie of productie-onApply uitgevoerd bij het opstellen van dit document.
