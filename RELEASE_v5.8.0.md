# BBQ Planner v5.8.0 — schatting zonder probe

**Status: gepubliceerd via release.yml na merge van PR #51.** Releaseakkoord van de eigenaar op 18 november 2026 (in de chat met de regisseur: "ja dat mag en publiceren mag ook"). Deze release bevat ook v5.7.0 (planning eenvoudiger, PR #50), die niet apart is gepubliceerd.

## Wat verandert er?
Ook zonder MEATER-probe (of zonder Home Assistant) zie je op Live per gerecht wanneer het ongeveer klaar is, en je kunt zelf een kerntemperatuur invoeren om de schatting te verbeteren. Alles wat zo geschat of ingevoerd is, heet ook zo: nooit "LIVE".

- **Bereik in plaats van één tijd.** Zonder probe-meting staat er "Op tafel tussen 18:05 en 18:35" met het label "geschat, geen meting". Basis: de echte starttijd van het gerecht plus de receptduur (en de omschakeltijd) en de rust. Het bereik is ±20 % van de resterende kooktijd, minimaal ±15 minuten, en wordt smaller naarmate het einde dichterbij komt. Het bereik is een **AANNAME**, geen meting.
- **Kern invoeren.** Elke gerechtkaart op Live (behalve een gereed gerecht) heeft de knop "Kern invoeren". Je typt de temperatuur van je handthermometer (0 tot 120 °C, komma of punt, numeriek toetsenbord op de telefoon). De app bewaart de invoer met het tijdstip, toont "handmatig, 14:20" en rekent het bereik opnieuw uit, smaller dan voorheen. Een tweede invoer geeft een helling. Een ongeldige invoer (leeg, negatief, boven 120, tekst) geeft een duidelijke melding en er wordt niets opgeslagen. Het invoerpaneel staat in de pagina: er is geen dialoogvenster, want dat werkt niet in de Home Assistant-app.
- **Een afwijkende kamadotemperatuur.** In hetzelfde paneel kun je één afwijkende kamadotemperatuur invoeren ("Het is nu 140 °C"). De schatting schaalt daarmee (zelfde opwarmmodel als de probe-curve waar dat kan, anders een eenvoudige schaling). De planning verandert niet; "Terug naar planning" wist de invoer.
- **Prik-melding.** Aan het begin van het bereik: "Tijd om te prikken: controleer <gerecht> met een thermometer en voer de kern in". Eén keer per gerecht, een herhaling pas na minstens 15 minuten (en niet kort na een invoer), maximaal drie keer. Zoals alle meldingen alleen zolang de planner open is in de Home Assistant-app.
- **Veiligheid.** Bij vlees en kip zonder live meting staat op de kaart: "Controleer de kern met een thermometer voordat je serveert".
- **Zodra een probe meet** verdwijnt het bereik en neemt de eigen curve het over, zoals in v5.4.0. Een verse probe-meting heeft altijd voorrang op een handmatige invoer.

## Je gegevens
Recepten, reviews, planningen en opgeslagen gegevens blijven zoals ze zijn. **Eén nieuw OPTIONEEL veld**: `manual` op een gerecht, in de bestaande opslag (`kamado-bereidingsplanner-v1`, geen nieuwe sleutel): `{points:[{t,core}], grill:{t,temp}|null}` met de handmatige kerntemperaturen (maximaal 12) en de ene afwijkende kamadotemperatuur. Oude data zonder dit veld laadt gewoon; het veld wordt gewist als een gerecht opnieuw op de BBQ wordt gelegd of teruggezet. Het veld wordt niet in de receptenbibliotheek of de recept-export opgenomen.

## Nog niet in de praktijk getest
Niet getest op een echte iPhone, in de Home Assistant-app of met een echte MEATER. De automatische tests gebruiken een nagebootste klok, fixtures en de echte planner in een browser. De bereikbreedte en de kamadoschaling zijn grove aannames: controleer tijdens een echte bereiding of de schatting klopt.

Projectinformatie: [PROJECT_STATUS.md](https://github.com/eelbrethouwer-jpg/bbq_planner_card/blob/main/PROJECT_STATUS.md).

Publicatie: goedgekeurd door de eigenaar op 2026-11-18
