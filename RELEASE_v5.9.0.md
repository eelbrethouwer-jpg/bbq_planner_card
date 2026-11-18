# BBQ Planner v5.9.0 — opruimen

**Status: gemerged in main (PR #52) en gepubliceerd samen met v5.10.0.** Er is geen aparte v5.9.0-release of -tag; de eigenaar gaf op 18 november 2026 akkoord voor de publicatie. Deze notitie bevat daarom bewust geen eigen goedkeuringsregel.

## Wat verandert er?
Opruimen, zonder nieuwe functie. De gewone navigatie wordt rustiger en er blijft één takenlijst over.

- **Oude pagina's uit de gewone navigatie.** De knop "📈 MEATER & focus" op Live is weg. De oude kookpagina, het "Interactief draaiboek" en het "Uitgebreid stap-voor-stap draaiboek" zijn nu bereikbaar onder **Meer → Geavanceerd** (nieuwe laatste groep, drie knoppen). De pagina's zelf zijn niet veranderd; alleen de route ernaartoe.
- **Eén takenlijst.** In de gewone navigatie (Vandaag, Recepten, Live, Meer, Planning aanpassen, Voorbereiding) is "Volgende handelingen" op Live de enige takenlijst. De twee oude draaiboeken delen dezelfde afvinkstand (`v46Done`) en staan alleen nog onder Geavanceerd.
- **Geen dialogen meer in de v5-schil.** "Nieuwe sessie" en "Sessie afronden" vragen om bevestiging in een paneel in de pagina (zoals "Naar voorbereiding" in v5.7.0 en het invoerpaneel in v5.8.0). Dat werkt ook als de Home Assistant-app of iframe `window.confirm` blokkeert. Annuleren verandert niets: de opslag blijft byte-gelijk. Ook de overige meldingen van de v5-laag ("al gestart", "thermometer al gekoppeld", "reservekopie opslaan mislukt") staan nu in de pagina in plaats van in `window.alert`.

## Functies die alleen onder Geavanceerd staan
- MEATER-grafiek (kern en omgeving in de tijd, opgebouwd terwijl de pagina openstaat) en de ruwe MEATER-velden per probe (doel, status, piek).
- Focus-kookmodus: schermvullend, per gerecht stap voor stap door de receptfasen met Vorige/Volgende en fase-knoppen.
- Slim bijsturen: aan/uit en de instelling "Vast houden / Flexibel" voor de serveertijd, met vergelijking per gerecht.
- Volledige BBQ-coach (alle adviezen) en de knop "Gebruik X min" om een historische mediane duur toe te passen.
- Interactief draaiboek en Uitgebreid stap-voor-stap draaiboek: vervangen door Live (hero, Volgende handelingen, tijdlijn); alleen de beschrijving per stap staat nog uitsluitend in het uitgebreide draaiboek.

## Je gegevens
Geen wijziging in localStorage-sleutels of schema's, geen nieuwe velden. Recepten, reviews, planningen en gegevens blijven zoals ze zijn. Eén bestaande opslagregel is anders geschreven (de foutafhandeling bij de reservekopie van "Nieuwe sessie"); sleutel, waarde en moment blijven gelijk. De publicatiebewaking kent daarvoor een letterlijk gedeclareerd vervangingspaar.

## Nog niet in de praktijk getest
Niet getest op een echte iPhone, in de Home Assistant-app of met een echte MEATER. De automatische tests gebruiken een nagebootste klok, fixtures en de echte planner in een browser. Het blokkeren van dialogen in de HA-app is niet op een echt apparaat bevestigd; de tests blokkeren `window.confirm`, `alert` en `prompt` zelf. Niet vervangen: de dialogen op de oudere pagina's (zie de PR-tekst).

Projectinformatie: [PROJECT_STATUS.md](https://github.com/eelbrethouwer-jpg/bbq_planner_card/blob/main/PROJECT_STATUS.md).
