# BBQ-planner v4.4.0 — releasekandidaat

**Status:** ontwikkelbranch / pull request. Er is nog geen tag of officiële HACS-release gepubliceerd.

## Nieuw

### ⭐ Bereidingshistorie op al je Home Assistant-apparaten
- Bereidingsevaluaties synchroniseren voortaan via Home Assistant **per ingelogd gebruikersaccount**.
- Een beoordeling bevat:
  - score van 1–5;
  - werkelijk ingevoerde eindkerntemperatuur;
  - ingestelde BBQ- en doelkerntemperatuur;
  - gekoppelde MEATER Pro/Plus;
  - recente MEATER-kern- en omgevingstemperatuur als die op het moment van opslaan beschikbaar en recent zijn;
  - vrije opmerkingen voor de volgende bereiding.
- Op de gerechtkaart verschijnen de **vijf meest recente** beoordelingen van hetzelfde gerecht.
- Maximaal 250 reviews worden bewaard.

### 🔄 Veilige migratie en samenvoegen
- Bestaande reviews uit `localStorage` blijven behouden.
- Bij openen als Home Assistant-kaart worden lokale en server-side reviews samengevoegd op een stabiele review-ID.
- Een review op iPhone kan daardoor ook op de computer verschijnen wanneer beide apparaten dezelfde Home Assistant-installatie en hetzelfde gebruikersaccount gebruiken.
- De kaart gebruikt de bestaande `frontend/get_user_data`, `frontend/set_user_data` en `frontend/subscribe_user_data` WebSocket-functies. Er is **geen extra token, wachtwoord of externe cloudservice** nodig.

## Bestaande functies behouden
- Persoonlijke receptenbibliotheek en Home Assistant-receptensynchronisatie uit v4.3.0.
- JSON-export/import van eigen recepten.
- Recept toevoegen via tekst of een publieke Recipe JSON-LD-link wanneer CORS dit toestaat.
- Uitklapbare stap-voor-stap bereiding met ingrediënten, voorbereiding, garen, rusten en aansnijden.
- Grote en kleine kamado, gezamenlijke serveertijd, conflictdetectie en directe/indirecte fasen.
- MEATER Pro + MEATER Plus met live kern- en omgevingstemperatuur, °C-schaal, tijdas en slimme tijdsbijsturing.
- Ingebouwde recepten zoals **Pulled pork op brood** en **Ribeye 500 g**.

## Privacy en grenzen
- Reviews synchroniseren alleen binnen het **Home Assistant-account** waarmee de kaart is geopend.
- Verschillende HA-gebruikers hebben gescheiden historie.
- De openbare GitHub Pages-versie heeft geen toegang tot Home Assistant en bewaart reviews alleen lokaal in de browser.
- De huidige recepten-JSON-back-up bevat geen reviewhistorie; v4.4.0 voegt daar bewust geen stille export van persoonlijke beoordelingen aan toe.
- MEATER-waarden in een review worden alleen opgeslagen wanneer ze recent beschikbaar zijn. Handmatig ingevoerde eindkern blijft duidelijk onderscheiden van een live meting.

## Techniek
- Plannerbestand: `dist/BBQ_bereidingsplanner_MEATER_v4.html`
- Home Assistant-kaart: `dist/bbq_planner_card.js`
- Kaarttype blijft: `type: custom:bbq-planner-meater-card`
- Cacheversie: `?v=4.4.0`
- Home Assistant user-data key voor reviews: `bbq_planner_reviews_v1`

## Test- en publicatiechecklist
- [x] Bestaande plannerfuncties behouden in de code.
- [x] Automatische smoke-tests uitgebreid voor lokale reviewopslag.
- [x] Gesimuleerde Home Assistant WebSocket-test uitgebreid voor recept- én reviewsynchronisatie.
- [ ] CI/HACS-validatie op de pull request controleren.
- [ ] Pull request reviewen en samenvoegen met `main`.
- [ ] Officiële GitHub Release `v4.4.0` aanmaken met tag op `main`.
- [ ] Na installatie via HACS: één review op iPhone opslaan en op computer met hetzelfde HA-account controleren.
- [ ] Safari-knoppen en uitklapbare stappen op een echte iPhone controleren.

Bereidingstijden, kerntemperaturen en MEATER-ETA's blijven hulpmiddelen. Controleer voedselveiligheid en de werkelijke gaarheid altijd afzonderlijk.
