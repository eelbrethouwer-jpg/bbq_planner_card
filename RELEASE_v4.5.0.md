# 🔥 BBQ-planner v4.5.0 — Slimme BBQ-coach & live kookmodus

## Nieuw in deze release

### 🌡️ Slimme BBQ-coach
- Live-aanwijzingen bij recente MEATER Pro- en Plus-metingen via Home Assistant.
- Temperatuurwaarschuwingen bij bijna bereiken van het ingestelde doel en bij overgang van indirect naar direct grillen.
- Geen livegetallen zonder verse HA-metingen; de coach verandert de kamado niet automatisch.

### 📱 Kookmodus voor iPhone
- Schermvullend overzicht met grote temperatuurwaarden, gerechtselectie en direct leesbare instructies.
- Vorige/volgende bereidingsstap en handmatige knoppen voor op de BBQ, rusten en klaar.
- Tijdstempels blijven opgeslagen in de bestaande planning.

### 📈 Leren van eerdere bereidingen
- Werkelijke BBQ-minuten kunnen automatisch worden vastgelegd met voortgangsstatussen of handmatig worden toegevoegd bij een review.
- Vanaf twee beoordelingen verschijnt een mediane bereidingsduur als voorstel.
- Alleen toepassen met de knop; nooit stiekem de bereiding aanpassen.

### 📷 Foto's bij recepten en beoordelingen
- Upload op mobiel, compressie naar kleine JPEG-miniatuur.
- Zichtbaar in persoonlijke bibliotheek en in reviewhistorie.
- Miniaturen synchroniseren via het bestaande Home Assistant-gebruikersaccount.
- Limiet: maximaal 30 bewaarde reviewminiaturen bij maximaal 250 reviews; de originele foto wordt niet centraal opgeslagen.

### 🛒 Boodschappenlijst
- Ingrediënten van geplande recepten combineren; gelijke ingrediënten in gelijke eenheden samenvoegen.
- Zelf personen en oorspronkelijke receptbasis instellen.
- Gerechten kiezen, boodschappen afvinken en lijst kopiëren.

### 🔥 Verdeling van beide kamado's
- Doorrekenen welke toewijzing de overlap in BBQ-temperatuur, methode en rooster vermindert.
- Toepassen na bevestiging; lopende bereidingen worden niet verplaatst.
- Let op: geen berekening van het fysieke roosteroppervlak.

## Bestaande functionaliteit behouden
- Receptenbibliotheek en HA-sync; reviewhistorie en HA-sync.
- Internet-/tekstimport, recepten-JSON, reviews, Pulled Pork op brood.
- Serveertijd, automatische planning, beide kamado's en tijdlijn.
- Direct/indirect + roosterwissels, temperatuurconflicten, stap-voor-stap recepten.
- MEATER Pro/Plus met kern- en omgevingstemperatuurgrafieken.
- Openbare HTML-planner zonder Home Assistant.

## Privacy en veiligheid
- Alleen bestaande Home Assistant-ingelogde user-data-synchronisatie; geen apart wachtwoord of API-token.
- Publieke website: lokale gegevens, geen Home Assistant-toegang.
- Raadpleeg de werkelijke kern en voedselveiligheidsrichtlijnen. MEATER-ETA's en historische tijden zijn geen garantie voor gaarheid.
- Foto's worden met een opslaglimiet als miniatuur bewaard; bewaar originele foto's elders.

## Test- en publicatiechecklist
- [ ] JavaScript-syntaxcontrole groen.
- [ ] DOM-/regressietests groen.
- [ ] HACS-repositoryvalidatie groen.
- [ ] iPhone Safari op echt toestel: knoppen, scrollen, foto-uploads, dialoog sluiten.
- [ ] Home Assistant: twee thermometers live en juiste gebruiker.
- [ ] Foto's/reviews en bibliotheek-sync op tweede apparaat testen.
- [ ] GitHub PR mergen naar `main`.
- [ ] Release-tag `v4.5.0` aanmaken op `main`.
- [ ] HACS updaten en dashboard herladen.

**Release-titel:** BBQ-planner v4.5.0 — Slimme BBQ-coach & live kookmodus

**Home Assistant-kaart:** `type: custom:bbq-planner-meater-card`
