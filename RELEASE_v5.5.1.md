# BBQ Planner v5.5.1 — Kaart op volledig scherm in een HA-panel-view

**Status: draft-PR, niet gemerged en niet gepubliceerd.** Basis: `af9cf3fc730a9c5950fbd99f38aeb2fa9ebfbf20` (main na release v5.5.0). Soort wijziging: layout/fix in de Home Assistant-kaart, geen nieuwe data.

## Wat is gewijzigd?
- **Volledig scherm in een panel-view.** Staat de kaart in een Home Assistant-panel-view (`type: panel`), dan vult ze het scherm van haar eigen bovenkant (onder de HA-kopbalk) tot de onderkant van het scherm. De hoogte wordt gemeten (`getBoundingClientRect().top` van de kaart en `window.innerHeight`), niet meer geschat met `calc(100dvh - 118px)`.
- **Eén scrollgebied.** Alleen de planner in de kaart scrolt; de HA-pagina zelf scrolt niet. Daardoor blijft de vaste onderste navigatie van de planner altijd op de onderkant van het scherm. Heeft de HA-view onder de kaart nog opvulling, dan geeft de kaart die pixels op in plaats van de pagina te laten scrollen.
- **Opnieuw meten** bij formaatwijziging, draaien van de telefoon (ook nog eens na 350 ms, omdat iOS de nieuwe maat laat doorgeeft), `visualViewport`-resize en bij elke hoogtemelding van de planner (`bbq-child-height-v1`, ongewijzigd).
- **iOS safe area.** Onderaan de kaart staat ruimte ter grootte van `env(safe-area-inset-bottom)` in de planner-achtergrondkleur, zodat de navigatie niet onder de thuisbalk valt.
- **Optie in de kaart-YAML.** `fullscreen: true` = altijd volledig scherm (ook buiten een panel-view); `fullscreen: false` = het oude gedrag; niet ingesteld = automatisch in een panel-view, anders het oude gedrag.

## Installatie
Zie "Koken op volledig scherm in de Home Assistant-app" in [README.md](README.md).

## Niet gewijzigd
- Planner-engine, `engine/`, `v6/`, opslag, localStorage-sleutels en berichttypen. De versie in `dist/bbq-eta.js` is alleen opgehoogd omdat het versiecontract dat eist.
- Kaarten buiten een panel-view zonder `fullscreen`-optie: zelfde iframe-stijl als v5.5.0.

## Beperkingen
- Geen test in de echte Home Assistant-app op een iPhone: alle tests gebruiken een nagebootste HA-pagina (kopbalk 56 px, `hui-panel-view` met shadow root). Desktop-browsers melden een safe area van 0.
- De hoogte volgt bewust niet het schermtoetsenbord (de `visualViewport` krimpt dan); anders verspringt het invoerveld tijdens typen.

Zie ook [PROJECT_STATUS.md](PROJECT_STATUS.md) en [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md).
