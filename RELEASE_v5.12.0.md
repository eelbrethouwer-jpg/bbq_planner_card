# BBQ Planner v5.12.0 — geen pop-up-dialogen meer

**Status: draft-PR, nog niet gemerged en niet gepubliceerd.** Dit bestand bevat bewust geen goedkeuringsregel: mergen publiceert niets. Een releaseakkoord van de eigenaar is nodig voordat zo'n regel in een aparte PR komt.

## Wat verandert er?
De Home Assistant-app (en een iframe) kan de pop-ups van de browser (`window.confirm`, `window.alert`, `window.prompt`) blokkeren. Dan doet een knop stilletjes niets: de bevestiging geeft "nee" terug en de actie gebeurt nooit. Sinds v5.9.0 gold dat al niet meer voor de v5-schermen; de oudere pagina's Recepten en Meer gebruikten nog pop-ups. Die zijn nu vervangen door een paneel of melding in de pagina:

- **Voorbeeld herstellen** (Meer → Planning bewaren, laden en exporteren): paneel "Voorbeeld herstellen?" met "Ja, voorbeeld herstellen" en "Annuleren".
- **Recepten importeren** (Recepten): paneel met het aantal recepten en wat er gebeurt (samenvoegen of de bibliotheek vervangen; bij vervangen zegt de knop dat ook).
- **Recept verwijderen** uit de bibliotheek: paneel met de receptnaam.
- **Planning laden** (Meer): paneel met het aantal gerechten. "Kan planning niet laden" is nu een melding in de pagina met de reden.
- **Deel de app / Deel website** (Meer): als delen en het klembord niet lukken, staat de link in een leesbaar veld met een knop "Kopieer link" (lukt kopiëren niet, dan is de tekst geselecteerd).
- **Boodschappenlijst kopiëren** (Meer): lukt het klembord niet, dan staat de lijst in een tekstvak in de pagina met "Kopieer lijst".
- **"Controleer de eindkerntemperatuur"** (beoordeling bij een gerecht): een foutmelding direct bij het veld in plaats van een pop-up.

Annuleren (knop, Escape of een tik naast het paneel) verandert niets: de opslag blijft byte-gelijk. Bevestigen voert precies dezelfde code uit als voorheen. De panelen staan in het scherm (ook op 320 px) en de knoppen zijn minstens 44 px hoog.

## Bewust niet aangepast
- De installatievraag van de PWA (`prompt.prompt()` van de browser zelf) is geen pop-up van de pagina en blijft.
- De losse v6-voorbeeldpagina's onder `v6/` (voorbeeld en herstel van het journaal) zitten niet in de app en zijn beschermd; ze blijven ongewijzigd.

## Je gegevens
Geen nieuwe opslagvelden of -sleutels en geen wijziging van opgeslagen gegevens. Alleen de weergave van bevestigingen en meldingen is veranderd.

## Nog niet in de praktijk getest
Niet getest op een echte iPhone, in de Home Assistant-app of met een echte MEATER. De automatische tests blokkeren de pop-ups zoals de HA-app dat kan, in de echte planner in een browser (Chromium en WebKit).

Projectinformatie: [PROJECT_STATUS.md](https://github.com/eelbrethouwer-jpg/bbq_planner_card/blob/main/PROJECT_STATUS.md).
