# BBQ Planner v5.12.1 — paneel altijd in beeld

**Status: gepubliceerd als onderdeel van v5.13.1 (via release.yml).** v5.12.1 (PR #57) is niet apart gepubliceerd; de publicatie staat in RELEASE_v5.13.1.md.

## Wat verandert er?
In v5.12.0 kwamen de bevestigingen en kopieerpanelen (Voorbeeld herstellen, Planning laden, Deel de app, Boodschappenlijst kopiëren, recepten importeren en verwijderen) in de pagina in plaats van in een pop-up. Dat paneel stond in het midden van het scherm van de planner. Gebruik je de planner als gewone kaart in een Home Assistant-dashboard en is die kaart veel hoger dan je scherm (de kaart past zijn hoogte aan de inhoud aan), dan stond het paneel midden in de hoge kaart en kon het buiten beeld zijn tot je ernaartoe scrolde. In volledig scherm (panel-view) was het al in orde.

Nu schuift de pagina het paneel in beeld zodra het opent, ook de buitenste Home Assistant-pagina. Er verandert verder niets aan de panelen: annuleren, bevestigen, Escape en de focus werken zoals in v5.12.0.

De andere meldingen en bevestigingen (nieuwe sessie, sessie afronden, naar voorbereiding, meldingen in de v5-schil en de melding bij het eindkernveld) schoven al in beeld en zijn ongewijzigd. De korte toast-melding onderaan (bestaand sinds v4) is bewust niet aangepast.

## Je gegevens
Alleen weergave. Geen nieuwe opslagvelden of -sleutels, geen wijziging van opgeslagen gegevens en geen nieuw berichttype tussen kaart en planner.

## Nog niet in de praktijk getest
Niet getest op een echte iPhone, in de Home Assistant-app of met een echte MEATER. De automatische test gebruikt een nagebootste Home Assistant-pagina met een kaart-iframe van 3000 px hoog (Chromium en WebKit, 390 en 320 px).

Projectinformatie: [PROJECT_STATUS.md](https://github.com/eelbrethouwer-jpg/bbq_planner_card/blob/main/PROJECT_STATUS.md).
