# BBQ-planner v4.3.0 — releasekandidaat

**Status:** ontwikkelbranch / pull request. Er is nog geen tag of officiële HACS-release gepubliceerd.

## Nieuw

### 📚 Volledige receptenbibliotheek
- Recepten overzichtelijk in **Mijn receptenbibliotheek**: terugvinden, toevoegen aan planning, opnieuw bewerken, hernoemen, verwijderen.
- Bereidingsmethode, rooster, temperaturen, ingrediënten, rusttijden, bereidingstijden en alle individuele bereidingsstappen blijven bewaard.
- Oude recepten uit de lokale v4.1/v4.2-bibliotheek worden gemigreerd bij het openen.

### 🔐 Synchronisatie via Home Assistant
- De kaart synchroniseert automatisch met Home Assistant **per ingelogd gebruikersaccount** via de bestaande officiële `frontend/get_user_data`, `frontend/set_user_data` en `frontend/subscribe_user_data` WebSocket-functies.
- De browser heeft **geen nieuw API-token, wachtwoord of externe cloudservice** nodig.
- Op je iPhone én op je computer verschijnen dezelfde recepten als je de BBQ-planner binnen **dezelfde Home Assistant-installatie en hetzelfde gebruikersaccount** opent.
- Bij verbinding neemt de kaart de lokale en bestaande Home Assistant-recepten samen; per recept geldt de laatst opgeslagen wijziging. Verwijderingen worden met tijdstip onthouden, zodat oude versies niet zomaar terugkomen.
- Recepten staan onder `bbq_planner_cookbook_v1` in Home Assistants persoonlijke frontend-opslag (dus niet in de publieke GitHub-repo).
- Bij netwerkverlies werkt de planner lokaal door. Na herstel van de verbinding wordt opnieuw gesynchroniseerd.
- De **openbare GitHub Pages-planner synchroniseert niet automatisch met Home Assistant** en kan niet bij persoonlijke gebruikersgegevens.

### 💾 Exporteer en importeer je volledige bibliotheek
- Knop **Alle recepten exporteren** maakt een JSON-back-up van alle eigen recepten met ingrediënten en bereidingstappen.
- **Recepten importeren** met de keuze:
  - **Samenvoegen:** bestaande recepten met dezelfde naam bijwerken, alle andere laten staan.
  - **Vervangen:** alle eigen recepten vervangen na een duidelijke bevestiging.
- Gebouwde standaardrecepten (zoals **Pulled pork op brood**) blijven onderdeel van de planner en worden niet gewist door deze acties.
- Bestaande bereidingsreviews blijven intact; de export betreft uitsluitend de **eigen receptenbibliotheek**, niet de reviews of actieve planning.

## Niet gewijzigd
- Twee kamado's, datum/serveerplanning, roosteradvies en directe/indirecte fases, MEATER Pro/Plus, live grafieken en bereidingsevaluaties.
- De HA-dashboardkaart blijft `type: custom:bbq-planner-meater-card`; dezelfde resource-URL kan worden gebruikt met bijgewerkte cache-query `?v=430`.
- De website en Home Assistant blijven voor dezelfde plannerpagina het HTML-bestand `dist/BBQ_bereidingsplanner_MEATER_v4.html` gebruiken.

## Grenzen en veiligheid
- Synchronisatie werkt per HA-gebruiker, **niet automatisch tussen verschillende accounts**. Dat is privacyvriendelijk; JSON-bestanden bieden overdracht tussen accounts/website.
- Bewaar geregeld een JSON-back-up. Bij precies gelijktijdige wijzigingen aan hetzelfde recept op twee apparaten wint de meest recente wijziging; er is geen transactielock tussen alle actieve Home Assistant-sessies.
- De twee-meter thermometer-gegevens blijven alleen beschikbaar via Home Assistant; er worden geen live gegevens naar de publieke website verstuurd.
- De automatische test simuleert een HA-WebSocket-verbinding. Echte iPhone Safari, netwerkherstel en live HA metingen moeten nog door de gebruiker worden gecontroleerd vóór of na release.

## Publicatiechecklist
- [x] Syntax en browser-DOM-regressietests op branch.
- [ ] HACS-validatie afronden.
- [ ] Pull request reviewen en samenvoegen met `main`.
- [ ] GitHub Release `v4.3.0` aanmaken met tag gericht op `main`, niet de branch.
- [ ] Home Assistant HACS installeren en inloggen met hetzelfde account op iPhone en computer; recette op ene apparaat opslaan en op ander openen.
- [ ] JSON-export/import in iPhone Safari controleren.
