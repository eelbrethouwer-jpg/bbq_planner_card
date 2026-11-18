# BBQ Planner v5.10.0 — vaste fasedoelen per recept

**Status: concept (draft-PR), niet gepubliceerd.** Dit bestand bevat bewust geen goedkeuringsregel van de eigenaar: mergen publiceert niets. Er is geen releaseakkoord gegeven. Let op: v5.9.0 (opruimen) is gemerged maar ook nog niet gepubliceerd; de laatste gepubliceerde release is v5.8.0.

## Wat verandert er?
Tot nu toe nam de app aan dat een reverse-sear-gerecht (zoals de ribeye) op "doel − 7 °C" moet worden opgestookt. Dat was een aanname. Nu kan een receptstap een vast fasedoel hebben.

- **Nieuw optioneel veld `coreAt` op een receptstap** (kerntemperatuur in °C, 0–120), naast de vrije tekst "Wanneer". Voorbeeld ribeye (reverse sear): 47 °C opstoken en schroeien, 54 °C eindkern.
- **Standaardrecepten.** Ribeye 500 g: stap "Opstoken en schroeien" op 47 °C en "Van de BBQ halen en rusten" op 54 °C (de stappen zijn afgeleid van de bestaande receptekst). Pulled pork op brood: "BBQ-saus aanbrengen" op 70 °C en "Doorgaren en malsheid testen" op 88 °C. De warmgerookte zalm en de overige standaardrecepten hebben geen `coreAt`: de bestaande tekst geeft er geen eenduidige waarde voor.
- **Schatting, Live en hero gebruiken `coreAt`** als fasedoel. Live toont "47 °C (einde indirect) rond HH:MM (uit recept)"; de hero zegt bijvoorbeeld "Ribeye 500 g bereikt 47 °C (einde indirect) over ±2 min · kern nu 45,5 °C · uit recept". Voor andere recepten (bijvoorbeeld pulled pork) komt de naam van de stap in beeld ("BBQ-saus aanbrengen"). **Zonder `coreAt` blijft alles zoals het was**: een reverse-sear-gerecht gebruikt doel − 7 °C en het label zegt "aanname". Een `coreAt` op of boven het kerndoel telt niet als tussendoel.
- **Meldingen per fasedoel** via de bestaande route (`notify.mobile_app_*`, tijdgevoelig): één keer per fasedoel, met de bestaande dedup-sleutels. Het opstookdoel van een reverse-sear-gerecht houdt zijn bestaande melding en sleutel; andere fasedoelen krijgen "Pulled pork op brood 70 °C bereikt — volgende stap: BBQ-saus aanbrengen" met de sleutel `…|phase|70`. Zoals bij alle meldingen: alleen zolang de planner open is.
- **Receptbewerker.** Bij elke stap staat een veld "Kern bij deze stap (°C)" (optioneel), in de pagina, zonder dialoog. Ongeldige invoer (geen getal, buiten 0–120) geeft een melding bij het veld en wordt niet opgeslagen; leeg laten betekent geen fasedoel. In de receptgenerator staat een **voorstel** uit de tekst ("bij ongeveer 70 °C kern"); het wordt pas een fasedoel als jij op "Neem 70 °C over" tikt.
- **Import, export, bibliotheek en Home Assistant-sync** behouden `coreAt`. Oude back-ups en oude planningen zonder `coreAt` laden ongewijzigd.

## Je gegevens
**Nieuw optioneel veld `coreAt` op een receptstap** (`recipeSteps[]`) in de bestaande opslag: de planning (`kamado-bereidingsplanner-v1`) en de receptenbibliotheek (`kamado-recipe-book-v1`, en bij Home Assistant `bbq_planner_cookbook_v1`). Er is geen nieuwe localStorage-sleutel en geen bestaand veld verandert. Oude data zonder het veld werkt gewoon (terugval: geen fasedoel, of de aanname doel − 7 °C bij reverse sear). Een ongeldige `coreAt` wordt bij het laden weggelaten, nooit verzonnen of afgerond naar iets anders. Bestaande gerechten in je planning of bibliotheek (bijvoorbeeld een eerder toegevoegde ribeye) krijgen de nieuwe stappen niet vanzelf; die blijven op de aanname totdat je het veld zelf invult.

## Wat niet verandert
De planning verandert niet zonder jouw tik. Handmatige en geschatte waarden blijven als zodanig gelabeld; er is geen nieuwe LIVE-bron. Het v5.2.3-contract (slots, één 1-s- en één 30-s-timer) blijft gelijk.

## Nog niet in de praktijk getest
Niet getest op een echte iPhone, in de Home Assistant-app of met een echte MEATER. De automatische tests gebruiken een nagebootste klok, fixtures en de echte planner in een browser. Of de meldingen op een echte kooksessie op het juiste moment en niet dubbel aankomen, en of 47 °C (midden van "circa 46–48 °C") voor jouw ribeye het goede moment is om op te stoken, is nog niet in de praktijk bevestigd.

Projectinformatie: [PROJECT_STATUS.md](https://github.com/eelbrethouwer-jpg/bbq_planner_card/blob/main/PROJECT_STATUS.md).
