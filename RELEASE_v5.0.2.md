# BBQ Planner v5.0.2 — iPhone Picker Layout Fix (releasekandidaat)

## Probleem
Op de iPhone binnen de Home Assistant-kaart lopen **Datum**, **Serveren om** en **Beschikbaar vanaf** in stap 2 / Serveermoment zichtbaar buiten de rechterrand van het formulier. Het numerieke invoerveld blijft op dezelfde screenshot wel binnen de kaart. Dit wijst op intrinsieke breedte van iOS Safari's ingebouwde datum- en tijdkiezers die niet krimpt binnen een CSS Grid.

## Oplossing
- **Datum, tijden en personen** hebben voortaan elk een aparte begrensde control-wrapper. De zichtbare rand zit op de wrapper en kan niet breder worden dan de beschikbare kaart.
- **Mobiele Serveermoment-indeling** gebruikt flexbox met één kolom onder 800 CSS-pixels; zo wordt de native min-content-breedte geen impliciete gridkolom-breedte.
- De standaard HTML-types `date`, `time` en `number` blijven intact; op de iPhone moeten de ingebouwde datum-/tijdkiezers blijven werken.
- Tekst is minimaal 16 px om het automatisch inzoomen op Safari te beperken.
- Geen `overflow-x:hidden` op de hele pagina, zodat onverwachte breedteproblemen niet worden verstopt.
- De v5.0.1 receptentabbladen, Home Assistant/MEATER en de volledige oude planner blijven ongewijzigd.

## Techniek
- `dist/bbq-v5.js`: extra klasse voor de serveervelden en `v5-input-frame` wrappers rond de vier bestaande inputs.
- Nieuw `dist/bbq-v502.css`: lokale styling van deze formuliervelden, zonder globale resets.
- `dist/BBQ_bereidingsplanner_MEATER_v4.html`: v5.0.2 versie, stylesheet.
- `sw.js`, `index.html` en `dist/bbq_planner_card.js`: PWA-cache en Home Assistant-iframeversie opgehoogd.
- `tests/mobile-bounds.mjs`: nieuw Chromium- en WebKit-schermbreedteonderzoek voor 320, 360, 375, 393, 430 en 768 px, zelfstandig en binnen een gesimuleerd HA-iframe; controleren dat vier inputs en hun native HTML-types behouden blijven en niet buiten de kaart uitsteken.

## Verificatie
- Syntax, bestaande jsdom-functietests, PWA en HACS-validatie via GitHub Actions.
- De browsermeting simuleert mobiel gedrag in **Chromium en WebKit (Safari-engine)**, geen fysieke iPhone. **Echte iOS Safari en Home Assistant moeten na het samenvoegen nog handmatig worden gecontroleerd.**
- Voor het publiceren de actuele CI-uitslag van de nieuwste commit controleren.

**Titel:** BBQ Planner v5.0.2 — iPhone Picker Layout Fix

**Status:** releasekandidaat, nog niet op `main` of in HACS gepubliceerd.
