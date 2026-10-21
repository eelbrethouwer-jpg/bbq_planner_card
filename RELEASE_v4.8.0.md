# BBQ-planner v4.8.0 — Receptencatalogus & Inspiratie 🔥

## Nieuw
**Een visuele receptencatalogus binnen de pagina Recepten.** Eerst inspiratie opdoen met foto's en bereidingstijden, en daarna per gerecht zelf kiezen voor Toevoegen aan mijn bibliotheek.

- **11 geselecteerde BBQ Junkie-recepten** met originele externe receptfoto's en duidelijke bronlink.
- Op iedere kaart staan categorie/type vlees, voorbereiding, BBQ-tijd, totale tijd, BBQ-temperatuur en waar bekend een kerntemperatuurrichtlijn.
- **Zoeken en filters:** categorie, maximale BBQ-tijd, direct/indirect en 'zonder ui genoemd'. Dit is géén garantie dat kant-en-klare rubs of sauzen uivrij zijn.
- **Bekijken:** beknopt voorbereidings- en kookadvies, ingrediënten, voedselveiligheidsnotities en een link naar het volledige bronrecept.
- **Bibliotheek-import per recept:** alleen na je expliciete klik. Geen bulkimport, geen ongevraagde overschrijvingen, grens van 80 eigen recepten gerespecteerd.
- **Plannen:** apart, pas nadat het recept in je bibliotheek staat; de planner opent vervolgens het Planning-scherm.
- De afbeeldingen blijven als links naar BBQ Junkie bewaard en worden niet gekopieerd of gehost. Bij offline of geblokkeerde afbeeldingen verschijnt een fallback.
- Bij Texas Style Buikspek wordt voorbereiden op de dag vóór het BBQ-diner automatisch als taak meegenomen; een onbekend kloktijdstip wordt niet verzonnen.
- Catalogusteksten zijn in de offline HTML opgenomen, maar bronfoto's en externe recepten vereisen internet.

## Eerste selectie
Texas Style Buikspek; Ribeye met groene asperges en smashed potatoes; Hot Honey Chickenwings; Omgekeerde Ananas Cake; Varkensrack met kruiden-Parmezaankorst; Jalapeño Popper Pig Shots; Cheesy Garlic Hotdogs; Smoked Creamcheese; Gegrilde Perzik; Gegrilde Bimi met citroen en knoflook; Iberico Secreto met Mojo Verde.

## Technisch
- Bestaande zelfstandige HTML (dist/BBQ_bereidingsplanner_MEATER_v4.html) bevat catalogus UI, geen extra externe module nodig.
- Bestaande HACS Lovelace bridge (dist/bbq_planner_card.js), planning, receptenbibliotheek, Home Assistant user-data-synchronisatie, MEATER Pro/Plus en reviews intact.
- GitHub Pages-versieparameter en serviceworker-cache vernieuwd naar 4.8.0.
- Nieuwe automatische regressietests voor catalogus, filter, preview, afbeeldingen, bewuste bibliotheekimport en planning.

## Goedkeuring vóór publicatie
- [ ] GitHub Actions (ui-smoke, html-javascript, validate-hacs) groen
- [ ] iPhone Safari: filter, kaartafbeeldingen, bekijk, import en plan
- [ ] Home Assistant: import overleeft herladen en bestaande bibliotheek/reviews blijven intact
- [ ] Offline: tekst zichtbaar; fotofallback verschijnt bij geblokkeerde bronfoto's
- [ ] Voedselveiligheid: tijden indicatief en originele receptbron controleerbaar

**Releasekandidaat, nog niet gepubliceerd.** Merge PR en publiceer een GitHub-release onder tag v4.8.0.