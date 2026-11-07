# BBQ Planner v5.1.0 — Eén app, rustig koken

**Status: gepubliceerd op 7 november 2026.** [GitHub Release v5.1.0](https://github.com/eelbrethouwer-jpg/bbq_planner_card/releases/tag/v5.1.0), code/tag-commit e2b1a861d745c6fcd77ff39515330995673c4d43 (PR #26). Oorspronkelijke ontwikkelbasis: 0283c500ecee39dab940b575ce79cb1a3d33b1cb. Inmiddels opgevolgd door v5.1.1.

## Visueel/navigatie
- Eén vaste onderbalk voor Vandaag, Recepten, Live en Meer, ook in de uitgebreide recepten- en planningsschermen. Actieve pagina wordt met `aria-current` aangegeven.
- Contextuele terugknop Vandaag/Live; dubbele oude intro en navigatie verborgen. De kop toont een leesbare datum en geen versienummer.
- Live toont bovenaan serveertijd, resterende tijd en voortgang. Eén hoofdtaak, kamadokaarten en maximaal vijf volgende handelingen; de hoofdtaak wordt niet herhaald. Alle volgende taken zijn op verzoek zichtbaar.
- Afgeronde handelingen tonen zowel het geplande als het geregistreerde uitvoertijdstip.
- Verse MEATER-metingen krijgen een groot cijfer en LIVE-label. Zonder verse meting staan de geplande BBQ-temperatuur en de bestaande verklaring in kleine tekst. Live MEATER blijft uitsluitend via Home Assistant beschikbaar.
- Compacte recepttegels, drie kolommen vanaf 600 px, tekstactie “Recept uit tekst maken” in beide receptschermen en touchdoelen van minimaal 44 px.

## Functioneel (F1–F3)
- **F1:** stabiele keys voor uitklapbare onderdelen; open én gesloten status en scrollpositie blijven behouden tijdens interval-, visibility- en commit-renders. Deze toestand blijft alleen in geheugen.
- **F2:** de hoofdtaak opent het gerecht via zijn ID. Aansteektaken openen het eerst startende gerecht op die kamado. Gelijke gerechtnamen veroorzaken geen verkeerde selectie.
- **F3:** read-only herkomstfunctie in de bestaande brug. Recepten krijgen Eigen/Voorbeeld en tijdelijke filters Alle/Eigen/Voorbeelden; geen wijziging aan receptenopslag.
- Schermwisselingen zetten de scrollpositie onmiddellijk bovenaan zodat de nieuwe primaire actie zichtbaar is.

## Compatibiliteit
De volledige inline v4-engine is bytegelijk aan de bron na uitsluiting van uitsluitend de nieuwe read-only brugfunctie. Berekeningen, taakgeneratie, MEATER-ophalen/v45Probe, import/export, reviews, recepten en opslagsleutels zijn behouden. Geen migratie of nieuwe localStorage-sleutel. Bestaande ui-vrije recepten en het filter “Zonder ui genoemd” blijven behouden.

## Verificatie
- Zelf uitgevoerd: syntax, bestaande smoke-, v5-, v501- en PWA-tests plus nieuwe v510-DOM-regressie.
- Nieuwe DOM-test: navigatie, taakvolgorde, interval-/visibility-/commit-renders, exacte gerechtkoppeling inclusief aansteken, verse/verouderde probeweergave, badges en opslagstructuur.
- Zelf uitgevoerd en geslaagd: browsermatrix in Chromium en WebKit; 320, 360, 375, 390, 393, 430, 768 en 1024 CSS-pixels; zelfstandig en in een nagebootst Home Assistant-iframe. Planning, Live, receptselectie, oude Recepten en Meer worden gecontroleerd.
- Screenshots op 390×844 staan in `docs/screenshots/v5.1.0/`. Dit zijn browsersimulaties, geen fysieke iPhone-screenshots.
- Definitieve CI-uitslag en commit-SHA staan in de PR. Alleen daadwerkelijk afgeronde checks tellen als geslaagd.

## Niet getest / praktijkacceptatie
- Fysieke iPhone Safari en geïnstalleerde PWA: service-workerupdate, bestaande persoonlijke planning/recepten/reviews, safe areas en onderbalk.
- Fysieke iPad staand/liggend en desktop vanaf 1280 px.
- Echte Home Assistant HACS-iframe, MEATER met verse en meer dan vijf minuten oude hardwaremeting.
- VoiceOver, tabvolgorde en aangekondigde actieve tabs/uitklapkoppen.
- Een echte kooksessie met vijf minuten geopende receptstap.

## Risico’s
De v5-laag vervangt nog steeds DOM bij hertekenen; stabiele keys beschermen uitklapstatus, maar fysieke touch-, focus- en schermlezeracceptatie blijft nodig. De openbare PWA en HA hebben hun bestaande afzonderlijke opslag; deze release voegt geen synchronisatie toe.
