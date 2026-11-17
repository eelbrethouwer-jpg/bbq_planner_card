# BBQ Planner v5.5.1 — kaart op volledig scherm

**Status: Gepubliceerd via release.yml na merge van deze PR.** App-code gelijk aan mergecommit `c214f064ca856ff2ea602c2b076ae348b4dc00ad` (PR #47). De release komt op de main-commit na de merge van de PR met de vaste releaseworkflow; die PR verandert geen app-code.

Publicatie: goedgekeurd door de eigenaar op 2026-11-17

## Wat verandert er?
Kook je in de Home Assistant-app met een dashboard waarop alleen de planner staat (een **panel-view**), dan vult de planner nu het hele scherm: van net onder de kopbalk van Home Assistant tot helemaal onderaan.

- **Eén scrollgebied.** Alleen de planner scrolt, de Home Assistant-pagina eromheen niet meer. Je ziet dus geen dubbele scrollbalk.
- **De onderste knoppenbalk blijft in beeld,** ook als je de telefoon draait of van app wisselt.
- **Ruimte voor de thuisbalk van de iPhone,** zodat de knoppen er niet onder vallen.
- De kaart **herkent een panel-view zelf**. Je hoeft niets in te stellen.

Er verandert niets aan je recepten, reviews, planningen of opgeslagen gegevens, en niets aan de kookfuncties of de MEATER-koppeling. Op een gewoon dashboard (geen panel-view) ziet de kaart er hetzelfde uit als in v5.5.0.

## Bijwerken via HACS
1. Open in Home Assistant **HACS**, kies **BBQ Bereidingsplanner + MEATER** en kies **Bijwerken** (of **Opnieuw downloaden**).
2. Ververs daarna de Home Assistant-app of de pagina. Zie je de oude versie nog, sluit de app dan helemaal af en open hem opnieuw, of leeg de cache van de app.

Wil je koken op volledig scherm? Maak een dashboard met een panel-view met alleen de planner-kaart. De voorbeeld-YAML staat in de [README](https://github.com/eelbrethouwer-jpg/bbq_planner_card#koken-op-volledig-scherm-in-de-home-assistant-app) onder "Koken op volledig scherm in de Home Assistant-app".

## Terugvaloptie
Bevalt het nieuwe gedrag niet, zet dan in de YAML van de kaart:

```yaml
type: custom:bbq-planner-meater-card
fullscreen: false
```

Dan gedraagt de kaart zich weer zoals in v5.5.0. Met `fullscreen: true` krijg je volledig scherm ook buiten een panel-view.

## Nog niet in de praktijk getest
Dit is **niet getest op een echte iPhone** in de Home Assistant-app. De automatische tests bootsen een Home Assistant-pagina na in Chromium en WebKit. Laat graag weten of de knoppenbalk onderaan goed staat, ook na draaien, na het toetsenbord en na wisselen van app. Bewust gekozen: de hoogte volgt het schermtoetsenbord niet, anders verspringt het invoerveld tijdens typen.

Projectinformatie: [PROJECT_STATUS.md](https://github.com/eelbrethouwer-jpg/bbq_planner_card/blob/main/PROJECT_STATUS.md).
