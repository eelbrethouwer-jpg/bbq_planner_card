# BBQ-planner v4.2.0 — releasevoorstel

**Status: releasekandidaat; officiële GitHub Release / HACS-update is nog NIET gepubliceerd.**
Vervangt na officiële publicatie v4.1.0, zonder de gebruikersgegevens bewust te wissen.

## Wijzigingen voor de releasenotes

**🔥 Slimmer grillen**
- Kies per gerecht direct, indirect, indirect → direct (reverse sear) of direct → indirect.
- Advies voor RVS, gietijzer, plancha of pizzasteen; hitteschild waar nodig.
- Geef desgewenst de aanwezige accessoires voor beide kamado's op.
- De tijdlijn telt bij gecombineerde gerechten de instelbare ombouwtijd mee en tekent fase 1, ombouw en fase 2 afzonderlijk.
- Waarschuwt bij overlappende temperatuur- en opstellingsconflicten en wanneer er vermoedelijk te weinig omschakeltijd tussen aparte gerechten is.

**📚 Recepten & generator**
- Kies categorie (rund, varken, gevogelte, lam, wild, vis, schaal- en schelpdieren, groenten, vegetarisch, dessert) en zoek recepten.
- Plak volledige tekst in de nieuwe, offline receptgenerator.
- Bekijk een bewerkbaar concept met gedetecteerde naam, ingrediënten, temperatuur, kerntemperatuur, tijden en instructiestappen.
- Bewerk, verwijder, herschik of voeg stappen toe voor je opslaat; bewerk ook stappen later op de gerechtkaart.
- Geen API-account en geen verborgen verzending van ingeplakte recepten. Ontbrekende bronwaarden blijven onbekend totdat gebruiker ze expliciet invult.
- Nieuw standaardrecept: **Pulled pork op brood**, met negen uitklapbare stappen, RVS-rooster/hitteschild en aandacht voor de priktest.

**📅 Vandaag als standaard**
- Automatische lokale datum bij openen en bij dagwissel.
- Handmatig gekozen datums blijven bewaard tot je **Vandaag gebruiken** kiest.
- Migratie van oude v4.1-opslag; toekomstplannen blijven behouden.

**🌡️ Bestaande functies behouden**
- Twee kamado's, gezamenlijke serveertijd, MEATER Pro en Plus via Home Assistant, kern-/omgevingstemperatuurgrafieken, bereidingsevaluaties, deelbare GitHub Pages-site.
- Backwards-compatible lokale browseropslag, inclusief JSON import/export met nieuwe velden.
- Nieuwe cache-bust-versie in HACS-kaart.

## Checklist vóór publiceren

- [x] HTML/JavaScript-syntax geslaagd op featurebranch.
- [x] Browser-DOM-smoketests op de branch: datum, filters, recepten, methodefasen, conflicten, review, opslag, import, share-knop en oude plannen.
- [x] HACS-repositoryvalidatie geslaagd op de branch.
- [ ] Pull request reviewen en naar `main` mergen.
- [ ] Na merge GitHub Release maken met **tag `v4.2.0`** die naar de nieuwste main-commit verwijst, met bovenstaande release notes.
- [ ] Controleer HACS-aanbod/download en eventueel dashboard-JavaScript-resource `/hacsfiles/bbq_planner_card/bbq_planner_card.js?v=420`.
- [ ] Op echte iPhone Safari controleren: categorie, generator, uitklapbare stappen, datumknop en roosterkeuze.
- [ ] Live Home Assistant + MEATER Pro en Plus testen, bij voorkeur tijdens een echte bereiding.
- [ ] De publieke GitHub Pages-planner controleren na merge.

Dit releasevoorstel is geen garantie dat browser-specifiek gedrag of fysieke grilltemperaturen perfect overeenkomen met de planning. Een ketting van twee kamado's met meerdere gerechten kent praktische limieten: de code waarschuwt voor conflicten en rekent de expliciete **interne** ombouwtijd mee, maar herschikt losse gerechten niet volledig automatisch.
