# BBQ-planner v4.6.0 — BBQ Regisseur (releasekandidaat)

## Wat is nieuw
1. **Interactief draaiboek:** tijdgestuurde handelingen per kamado met Nu/Hierna/Afgevinkt, lokale afvinkstatus en receptgebonden kooktimers.
2. **Live kernvoorspellingen:** gebruikt uitsluitend verse Home Assistant / MEATER-gegevens. MEATER ETA heeft voorrang; als die ontbreekt gebruikt de planner een duidelijk als ruwe extrapolatie gemarkeerde temperatuurtrend (minimaal drie minuten, stabiele stijging). Geen gefingeerde metingen.
3. **Meerdere serveermomenten:** optioneel voorgerecht, hoofdgerecht en dessert. Per gerecht een gangkeuze; de oude enkele gezamenlijke serveertijd blijft standaard actief en compatibel.
4. **Home Assistant pushmeldingen:** expliciet opt-in. Configureer een bestaande \`notify.mobile_app_...\` service. Alleen vanuit de ingelogde Home Assistant-kaart en bij actieve verbinding; afgemelde/openbare pagina's sturen nooit push. Kamado wordt niet op afstand bediend.
5. **Recepten schalen:** hoeveelheden per gerecht op basis van gasten en instelbare bronrecept-porties; oorspronkelijke ingrediënten blijven ongewijzigd. Geen automatische aanpassing van temperatuur of bereidingstijd.
6. **Bereidingshistorie:** min/max/mediaan werkelijke kooktijd, aantal sessies, sterren en geregistreerde eindkern uit bestaande reviews. Zonder reviews geen gefingeerde statistieken.
7. **Voorraadkast:** lokaal opgeslagen voorraad (g/ml/stuks/el/tl) verminderen de resterende boodschappenhoeveelheden voor identieke ingrediënten + eenheden. Bewaar via JSON-planexport; geen automatische HA-cloudsynchronisatie van voorraad.
8. **Offline webapp:** publieke GitHub Pages-installeerbare PWA met service-worker-cache, zolang eerder online geopend. Live metingen en HA-synchronisatie werken alleen online.

## Extra: planning op meerdere dagen
- **Duidelijkere starttijdbewaking:** een tijdsverschil op een toekomstige BBQ-datum is een planningsadvies, geen onterechte melding dat je vandaag te laat bent. Datum en tijd worden volledig getoond; zodra de benodigde starttijd werkelijk verstreken is, wordt het wel een waarschuwing.
- **Voorbereidingen op eerdere dagen:** per gerecht handelingen tot veertien dagen voor de serveerdatum toevoegen en bewerken, met voorbeeldstappen voor vis pekelen, vlees marineren en deeg maken, of een eigen stap.
- **Apart voorbereidingsschema:** iedere voorbereidende handeling komt gedateerd in het gedetailleerde draaiboek, het afvinkbare kookoverzicht, een afzonderlijke voorbereidingstijdlijn en de tekstexport.
- **Opslag:** voorbereidingen zitten in JSON-planback-ups en kunnen expliciet worden opgeslagen bij de receptenbibliotheek (in Home Assistant per gebruiker synchroniseerbaar).
- **Beschikbare begintijd:** is uitdrukkelijk alleen voor de dag van het diner bedoeld. Dag-ervoor-taken hebben eigen tijden.
- **Voedselveiligheid:** voorinstellingen zetten niet automatisch de pekelduur op 24 uur; bewaartemperatuur en werkelijke pekeltijd moeten volgens het betreffende recept worden gecontroleerd.

## Nieuw: receptgenerator herkent voorbereidingen op eerdere dagen
- De generator analyseert expliciete uitspraken zoals **“de avond ervoor”**, **“avond tevoren”**, **“een dag van tevoren”**, **“twee dagen vooraf”** en **“24 uur marineren”**.
- Een aparte sectie **“Voorbereidingen vóór de BBQ”** toont de herkende handelingen in het bewerkbare receptconcept. Hier kun je titel, dag-offset, datum-afgeleid van de gekozen serveerdatum, tijdstip, beschrijving en eventuele werktijd aanpassen of verwijderen, of zelf een nieuwe taak toevoegen.
- **Geen gefingeerde kloktijden:** alleen “de avond ervoor” geeft wel de vorige kalenderdag maar **geen 19:00**. Het exacte tijdstip blijft leeg tot je het zelf kiest. Zonder opgegeven werktijd wordt ook geen werkduur verzonnen.
- Bij goedkeuren worden de taken opgeslagen in de gerechtenplanning en receptenbibliotheek. De oude snelle import herkent dezelfde aanwijzingen.
- Het ingebouwde recept **Pulled pork op brood** heeft nu een expliciete voorbereiding op de avond ervoor voor het bijsnijden, kruiden en gekoeld wegzetten van de procureur.
- Dit is tekstherkenning, geen garantie dat een recept correct of voedselveilig is geïnterpreteerd. **24 uur marineren** moet ook echt voldoende tijd tussen de gekozen start en het garen opleveren; controleer dat zelf. Bij rauw vlees en vis gekoeld bewaren volgens recept en voedselveiligheidsrichtlijnen.
- Teksten met kortere wachttijd, zoals **12 uur marineren**, worden niet automatisch op een specifieke kalenderdag gezet als de dag niet eenduidig is.

## Compatibiliteit & veiligheid
- Zelfstandige HTML blijft: \`dist/BBQ_bereidingsplanner_MEATER_v4.html\`.
- Receptenbibliotheek, HA per-gebruiker reviewsync, MEATER Pro/Plus-grafieken, foto's, bestaande planning en flexibele adviezen blijven intact.
- De werkelijke planning verandert alleen na gebruikersactie; schattingen zijn geen bewijs van gaarheid.
- Gewone cook-status- en ingrediënteninstellingen blijven functioneren in Safari en desktop; browser-smoketests zijn geen fysieke iPhone-test.
- Offline mode geldt uitsluitend voor \`eelbrethouwer-jpg.github.io/bbq_planner_card/\` en nooit de HA-sessie.

## Acceptatiechecks
- [ ] GitHub Actions HTML/JavaScript-syntax en HACS-validatie groen
- [ ] Regressie en v4.6.0 rooktesten groen
- [ ] iPhone Safari: alle knoppen en invoervelden, timers na opnieuw openen
- [ ] Home Assistant: echte sensoren en juiste \`notify.mobile_app_...\` service, met expliciete toestemming
- [ ] Offline: na online bezoek vliegtuigmodus; recepten en plan zichtbaar maar MEATER niet live
- [ ] Handmatig: 3 gangen en beide kamado's; controleer alle start- en opwarmtijden
- [ ] Test morgen gepland diner: toekomstig starttijdconflict is advies, niet een melding dat vandaag al te laat is
- [ ] Test vis een dag eerder pekelen en beide dagen afzonderlijk in het draaiboek, bewaren, heropenen en afvinken
- [ ] Receptgenerator: 'de avond ervoor' en '24 uur marineren' -> bewerkbare voorbereiding zonder verzonnen tijd, bewaren in bibliotheek en planning

**Nog niet mergen of taggen tot CI en handmatige controles klaar zijn.**