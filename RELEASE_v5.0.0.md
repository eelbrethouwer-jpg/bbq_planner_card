# BBQ Planner v5.0.0 — The Cooking Experience (releasekandidaat)

## Doel
Van een drukke verzameling instellingen en tabbladen naar een begeleide BBQ-sessie met compacte, mobielgerichte stappen. De bestaande v4-rekenmotor en opslag blijven de bron van waarheid.

## Nieuwe ervaring
- **Welkom** met 'Nieuwe BBQ-sessie', 'Bestaande planning', recepten en historie.
- **Stap 1 — Gerechten selecteren**: zoekbare receptkaarten (inclusief persoonlijke recepten en foto's), tik om toe te voegen, overzicht en verwijdermogelijkheid.
- **Stap 2 — Planning**: datum, serveertijd, beschikbaarheid, aantal personen, kamadoverdeling en zichtbare waarschuwingen. De uitgebreide legacy-editor blijft bereikbaar voor temperatuur, recepten en meerdere gangen.
- **Stap 3 — Voorbereiden**: afvinkbare voorbereidingen inclusief voorgaande dagen; geen fictieve kloktijd wanneer de bron geen exact tijdstip biedt.
- **Live cockpit**: één volgende actie centraal, twee kamadokaarten, geplande vervolgtaken, receptfasen met uitklapbare instructies, faseknoppen en expliciete afronding.
- **Navigatie**: vier compacte knoppen onderin; de oude vijf-tab-app blijft beschikbaar voor uitgebreide functies, instellingen en reviewhistorie.
- **Bewaarstatus**: voortgang via de bestaande `v46Done`, fase en tijdstippen via de bestaande planopslag; nieuwe v5 sessiestatus en bevestigde tijdstippen worden lokaal opgeslagen.
- **Veilige nieuwe sessie**: bij vervanging van een bestaande planning moet de gebruiker bevestigen; eerst wordt een lokale JSON-reservekopie van het vorige plan geschreven. Bij schrijffout wordt de planning niet vervangen.
- **PWA/Home Assistant**: nieuwe JS/CSS apart gecachet, URL-versie en HA iframe-cache vernieuwd.

## Gedrag en beperkingen
- De v4-planner berekent automatisch geplande aansteek-, start-, rust- en serveertijdstippen. **Automatische herplanning op basis van daadwerkelijk uitgevoerde handelingen is nog niet geïmplementeerd**: de app bewaart daadwerkelijke tijdstippen en toont het oorspronkelijke schema; wijzigingen aan serveertijd zijn expliciet via Planning.
- Receptfasen zonder betrouwbare kloktijd blijven **handmatige stappen** en worden nooit zomaar op een verzonnen minuut gezet. Er is geen volledig formeel dependency-schema voor alle bestaande recepten.
- MEATER Pro/Plus is **alleen live via Home Assistant** met verse metingen. De openbare PWA toont geplande temperaturen en een heldere afwezigheid van live meting.
- De publieke PWA en Home Assistant hebben verschillende lokale browseropslag; er is geen automatische plansynchronisatie. Receptensynchronisatie in Home Assistant blijft via de bestaande bridge.
- Reviews en afgelegde sessies blijven via de oude onderdelen toegankelijk; er is nog geen nieuw, volledig eigen v5 reviewscherm.
- De interne naam van het bestaande HTML-bestand blijft `BBQ_bereidingsplanner_MEATER_v4.html` om bestaande imports, links, HACS en automatisering niet te breken.

## Testmatrix
- Automatisch: JavaScript-parse, bestaande DOM-regressietests, PWA-assets/caching, HACS-validatie.
- Nieuwe synthetische DOM-smoke: welkomstscherm, veilige sessiestart en backup, menu, datum/serveertijd/kamado, voorbereiding, live acties, werkelijkheid opslaan, uitgebreide editor en hervatten.
- Handmatig nog vereist op een echte iPhone: PWA-update; browseropslag blijft behouden; wisselen/onderbreken; kleine schermen; receptimport, reviews en beide kamado's; VoiceOver.
- Handmatig nog vereist via Home Assistant: echte MEATER Pro/Plus, stale-data-melding, bridgesynchronisatie en cache-update.

**Status:** kandidaat op branch `feature/v5-cooking-experience`, niet samengevoegd of als definitieve GitHub-release gepubliceerd. Beoordeel GitHub Actions op de actuele commit vóór de merge.

## Release title
BBQ Planner v5.0.0 — The Cooking Experience

## Korte GitHub-releasebeschrijving (na acceptatie)
Compleet vernieuwde BBQ-beleving: selecteer je menu, plan grote en kleine kamado, werk voorbereidingen af en volg in de live kookmodus de eerstvolgende stap. Inclusief compacte navigatie, bewaarde voortgang en behoud van de bestaande receptenbibliotheek, MEATER/HA-koppeling en uitgebreide planner.
