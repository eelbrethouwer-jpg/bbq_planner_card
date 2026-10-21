# BBQ-planner v4.7.0 — Navigation & UX
Releasekandidaat voor de bestaande zelfstandige HTML-planner en de Home Assistant MEATER-kaart.

## Nieuw
- **Vaste navigatiebalk onderaan** met vijf schermen: **Overzicht, Planning, Koken, Recepten, Meer**. Actief scherm duidelijk herkenbaar; selectie wordt lokaal onthouden.
- **Overzicht**: serveertijd, eerstvolgende handeling, compacte gerechtkaartjes voor beide kamado's, aansteektijden en alleen uitgevouwen aandachtspunten bij een belangrijk conflict.
- **Planning**: maaltijddatum en BBQ-instellingen, afzonderlijke serveermomenten, compacte gerechtkaarten met inklapbare details, tijdlijn voor grote/kleine kamado.
- **Koken**: beide bestaande MEATER-grafieken met actuele bronstatus, interactief afvinkbaar draaiboek, voorspellingen en focus-kookmodus. Slimme bijsturing en uitgebreide stap-voor-stap instructies blijven bereikbaar in uitklapbare secties.
- **Recepten**: bestaande receptenbibliotheek, recepten van internet/tekst importeren, generator met voorbereidingen op eerdere dagen, recepten bewerken en direct gebruiken.
- **Meer**: boodschappenlijst, slimme kamadoverdeling, voorraadkast, Home Assistant notificaties, bereidingshistorie, import/export, printen en reset.
- **Compacte gerechtkaarten**: standaard alleen naam, kamado, start- en eindtijd, BBQ- en kerntemperatuur; één tik op **Details** toont alle originele velden, foto's, reviewformulier, recepten, voorbereidende handelingen en timers. Uitklapstand lokaal opgeslagen.
- **Sneller navigeren**: nieuw recept toevoegen vanuit Recepten opent automatisch de planningspagina bij het nieuwe gerecht.
- **Home Assistant mobiele weergave**: de kaart krijgt een viewporthoge scrollruimte in plaats van een veel te lange iframe. Daardoor blijft de onderbalk zichtbaar tijdens scrollen binnen de kaart. De bestaande same-origin MEATER- en bibliotheekkoppelingen blijven ongewijzigd.
- **PWA cacheversie en publiek adres** bijgewerkt naar 4.7.0.

## Compatibiliteit
De bekende bestanden blijven bestaan:
- \`dist/BBQ_bereidingsplanner_MEATER_v4.html\` — zelfstandige HTML.
- \`dist/bbq_planner_card.js\` — HACS Lovelace-kaart.
- \`index.html\` — GitHub Pages startpagina.
- \`sw.js\` — offline cache (alleen publieke Pages-site).

We verplaatsen de originele bedieningselementen naar nieuwe schermen in de DOM: **geen kopieën**. De planning, datumlogica, temperatuurwaarschuwingen, MEATER Pro/Plus, reviews en Home Assistant user-data synchronisatie blijven het bestaande systeem gebruiken. Metingen zijn alleen live wanneer er verse sensordata binnenkomen.

## Controle vóór publicatie
- [ ] GitHub Actions: HACS, JavaScript-syntax, uitgebreide DOM-regressie inclusief v4.7-navigatie
- [ ] iPhone Safari: navbalk zichtbaar bij scrollen, vijf tabs, Details-knop, recepten en keyboard/safe-area
- [ ] Home Assistant: vaste navigatie zichtbaar binnen iframe, touchscroll werkt en MEATER Pro/Plus blijven live
- [ ] Receptenbibliotheek: bewaren, bewerken, gebruiken en herladen met bestaande persoonlijke data
- [ ] Offline PWA na een online bezoek; offline data zijn nooit als live gemarkeerd

**Release blijft concept totdat ook de handmatige iPhone Safari- en Home Assistant-controles zijn afgerond.**