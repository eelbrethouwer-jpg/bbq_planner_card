# Changelog

## v4.4.0 — releasekandidaat (nog niet gepubliceerd)

- **Bereidingshistorie per Home Assistant-gebruiker:** reviews synchroniseren tussen bijvoorbeeld iPhone en computer wanneer hetzelfde Home Assistant-account wordt gebruikt.
- Een review bewaart beoordeling, werkelijk ingevoerde eindkern, ingestelde BBQ-/kerntemperatuur, thermometerkeuze, recente MEATER-kern/omgeving indien beschikbaar en opmerkingen voor de volgende bereiding.
- Bestaande lokale reviews worden bij de eerste Home Assistant-koppeling **samengevoegd**, niet overschreven. De historie blijft begrensd op maximaal 250 beoordelingen.
- Op de openbare GitHub Pages-versie blijven beoordelingen bewust lokaal; persoonlijke historie wordt niet naar GitHub of een externe cloudservice gestuurd.
- Op de gerechtkaart worden nu de **vijf meest recente** beoordelingen van hetzelfde gerecht getoond.
- De bestaande receptenbibliotheek, JSON-receptenback-up, internet-/tekstimport, uitklapbare bereidingsstappen, twee kamado's, slimme planning en MEATER kern-/omgevingsgrafieken blijven behouden.
- De Home Assistant-bridge krijgt cacheversie `v4.4.0` en gebruikt dezelfde ingelogde WebSocket-sessie; er is geen extra toegangstoken nodig.
- Regressietests dekken lokale reviewopslag en gesimuleerde Home Assistant merge/synchronisatie van zowel recepten als bereidingshistorie.

**Status:** nog geen officiële HACS-release; zie [RELEASE_v4.4.0.md](RELEASE_v4.4.0.md).

## v4.3.0 — releasekandidaat (nog niet gepubliceerd)

- Eigen **Mijn receptenbibliotheek** met recepten zoeken, bekijken, opnieuw bewerken, gebruiken en verwijderen.
- **Complete JSON-receptenback-up** exporteren en importeren, samenvoegen of met bevestiging vervangen.
- **Receptensynchronisatie per Home Assistant-gebruikersaccount** op iPhone en computer via bestaande beveiligde WebSocket-user-storage.
- Bij gebrek aan HA-sessie blijft de bibliotheek lokaal werken; de publieke GitHub Pages-planner heeft geen toegang tot persoonlijke HA-data.
- Data uit v4.1/v4.2 wordt gemigreerd zonder bestaande reviews of geplande gerechten te wissen.
- De Home Assistant-bridge krijgt cacheversie `v4.3.0`.
- De interface meldt of Home Assistant-synchronisatie beschikbaar is. Bij gedeelde accounts verschijnen dezelfde recepten; andere accounts blijven gescheiden.

**Status:** nog geen officiële HACS-release; zie [RELEASE_v4.3.0.md](RELEASE_v4.3.0.md). 


## v4.2.0 — voorbereide release (nog niet gepubliceerd)

- **Datum:** standaard automatisch de lokale dag van vandaag; zelfgekozen datum blijft bewaard, met knop ‘Vandaag gebruiken’. Bestaande plannen worden voorzichtig gemigreerd; expliciet geïmporteerde datum blijft handmatig.
- **Receptenfilter:** categorieën rund, varken, gevogelte, lam, wild, vis, schaal- en schelpdieren, groenten, vegetarisch en dessert; filter en zoeken.
- **Kamado-methode:** direct, indirect, indirect → direct (reverse sear) of direct → indirect; roosterkeuze per fase en optionele accessoire-inventaris voor beide kamado's.
- **Roosteradvies:** RVS, gietijzer, plancha of pizzasteen, hitteschildvermelding en indicatie van ontbrekende accessoires.
- **Tijdlijn:** methodefasen en optelbare ombouw/opstooktijd bij gecombineerde bereidingen; waarschuwingen bij gelijktijdige temperatuur-, rooster- en opstellingsconflicten. Ombouw tussen losse gerechten wordt gewaarschuwd, niet automatisch verschoven.
- **Offline receptgenerator:** plak recepttekst, analyseer naam, ingrediënten, temperaturen, tijden, bereidingsmethode en losse stappen. Onduidelijke of ontbrekende waarden blijven zichtbaar als ontbrekend. Concept is te bewerken en wordt pas na bevestiging opgeslagen. Geen extern AI-model of sleutel nodig.
- **Receptstappen:** bewerken, toevoegen, verwijderen en herschikken op de gerechtkaart; uitgebreid draaiboek blijft beschikbaar.
- **Compatibiliteit:** oorspronkelijke serveertijd, MEATER Pro/Plus, beoordelingen, lokale bibliotheek, HACS-dashboardkaart en GitHub Pages behouden. JSON-plan import/export ondersteunt de nieuwe velden.
- **Standaardrecept:** ‘Pulled pork op brood’ met negen stappen, toegevoegd sinds de vorige tag.
- **Testen:** uitgebreider browser-DOM-testpakket en controle van JavaScript-syntax en HACS-repository.

**Let op:** kerntemperatuur en bereidingsduur uit automatisch gelezen recepten zijn géén veiligheidscontrole. Bij gecombineerde gerechten worden wisselminuten expliciet geteld; daadwerkelijke warmtestabilisatie blijft handmatig te beoordelen. Live MEATER-test en iPhone Safari hardwaretest zijn niet uitgevoerd door de CI.

# Wijzigingen

## v4.1.0 — Recepten, evaluaties en twee MEATER-temperatuurlijnen (voorbereid)

- Stap 04: elke bereiding is uitklapbaar met ingrediënten, voorbereiden, garen, rusten en aansnijden.
- Nieuw voorbeeldrecept Ribeye 500 g met reverse-sear, indirect/direct kamado-temperatuur en snijtips.
- Recepten importeren met publieke Recipe JSON-LD als CORS dit toestaat; plakken van recepttekst blijft altijd beschikbaar. Eigen recepten opgeslagen in lokale receptenbibliotheek.
- Uitgebreide instructies per gerecht bewerken via een uitklapbare recepteditor.
- Na een bereiding beoordeling, werkelijke eindkern en leerpunten bewaren; hergebruik via lokale reviewhistorie, los van je huidige planning.
- MEATER Pro en Plus: grafiek met *kerntemperatuur* en *omgevingstemperatuur*, tijdstippen, kleuren en Celsius-schaal. Alleen echte sensorwaarden, geen demo-grafiek.
- Home Assistant-dashboardbrug blijft ongewijzigd in werking; bron-URL krijgt een cache-bust naar v4.1.0.
- De bestaande planning, tijdlijnen, temperatuurconflicten, JSON-planexport, print, slimme bijsturing en mobiele bediening blijven intact.
- Let op: browseropslag is apparaatgebonden; een site die CORS blokkeert kan niet rechtstreeks automatisch worden ingelezen.

## v4.0.0 — Eerste GitHub/HACS-uitgave

- Bestaande complete BBQ-bereidingsplanner v4 opgenomen zonder wijzigingen aan de HTML-functionaliteit.
- Home Assistant-dashboardbridge verpakt voor HACS met alle benodigde bestanden in `dist/`.
- De dashboard-JavaScriptmodule heet nu `bbq_planner_card.js`, gelijk aan de naam van de GitHub-repository.
- Afzonderlijke voorbeeld- en livemeldingen blijven behouden; geen externe API-sleutels nodig.
- GitHub Actions HACS-validatie toegevoegd.