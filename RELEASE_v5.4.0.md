# BBQ Planner v5.4.0 — Eigen schattingsmodule

**Status: releasekandidaat (draft-PR), niet gepubliceerd.** Basis: `7cdc4b6c747b1b215eabe01d1c7f7c07dcaf04d1` (main na PR #43; code v5.3.0).

## Wat is gewijzigd?
- **Eén schatting voor de hele app.** Een nieuwe, pure schattingsmodule (`dist/bbq-eta.js`, ook als ES-module `engine/eta.mjs`) rekent per gerecht uit wanneer de kern het doel haalt. De Live-kaart, het slimme advies (`smartPlan`), de oude MEATER-pagina (`v46Prediction`) en de meldingen gebruiken allemaal deze module.
- **Newton-opwarming** in plaats van een rechte lijn: de module schat de opwarmsnelheid robuust uit de laatste 12 minuten metingen en de omgevingstemperatuur. Zonder bruikbare omgevingstemperatuur valt hij terug op een rechte lijn met lagere betrouwbaarheid.
- **Geen meeschuivende tijd meer.** De schatting rekent vanaf het tijdstip van de laatste meting, niet vanaf de klok. Zonder nieuwe meting blijft "Op tafel rond" gelijk.
- **Geen terugval naar de planning voor een gerecht dat al op de BBQ ligt.** Volgorde: eigen curve → MEATER-ETA → werkelijke start + receptduur (+ ombouw) + rust → planning. Is de meting 5–15 minuten oud, dan toont de kaart "Laatste schatting HH:MM · verouderd". Daarna start + receptduur.
- **Fasedoel:** bij indirect → direct (reverse sear) ook de tijd tot het einde van de indirecte fase (doel − 7 °C, bijvoorbeeld 47 °C bij 54 °C).
- **Stall:** stijgt de kern 15 minuten lang minder dan 0,05 °C/min tussen 65 en 80 °C, dan toont de kaart "Stall rond 70 °C sinds HH:MM" zonder curvetijd, met de mediane duur uit je eigen reviews als die er is.
- **Marge** uit de spreiding van de metingen rond de curve, plus een modelfout. Een tijd verschijnt pas na minstens 5 minuten stabiele stijging met minstens 4 meetpunten.
- **MEATER-ETA als tweede mening.** Wijkt die meer dan 10 minuten af van de eigen schatting, dan staan beide op de kaart. De 2 °C-doelcheck geldt alleen nog voor de MEATER-ETA.
- **Doorgaren:** bij een rusttijd van minstens 10 minuten of een stuk van minstens 1 kg het advies om 2–3 °C eerder van het rooster te halen. Alleen advies; het doel verandert niet. Niet bij gevogelte.
- **Voortgangsbalk** vanaf de eerste meting van de sessie in plaats van vanaf 0 °C.
- **Meetgeschiedenis bij openen** (alleen in de Home Assistant-kaart): de kaart haalt eenmalig de kern- en omgevingstemperatuur van de laatste 3 uur op via de HA-opdracht `history/history_during_period` en stuurt die als `bbq-ha-history-v1` naar de planner. Lukt dat niet, dan werkt alles zoals voorheen met alleen live metingen.

## Niet gewijzigd
- Opslagschema en localStorage-sleutels. De meetgeschiedenis staat alleen in het geheugen (nu maximaal 480 punten per probe).
- v5.2.3-contract: een sensorupdate ververst alleen de vakjes van de kaart; één 1-s-timer en één 30-s-timer.
- De publieke PWA toont geen HA- of MEATER-data.
- `v6/` en de bestaande `engine/`-bestanden.

## Beperkingen
- Het Newton-model past exact op een Newton-curve. Bij een echte S-vormige opwarming (eerst buitenkant, dan kern) schat het in de test 14–17% te laat. Dat wordt kleiner naarmate het doel dichterbij komt.
- Na de omschakeling naar direct (reverse sear) mengt het venster twee omgevingstemperaturen; de schatting heeft dan een paar minuten nodig om bij te trekken.
- Geen echte Home Assistant-, MEATER- of iPhone-test; alle tests gebruiken gemarkeerde fixtures.
