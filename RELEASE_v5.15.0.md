# BBQ Planner v5.15.0 — afgeronde sessies komen vanzelf in je bereidingshistorie

## Het probleem
Na een echte kooksessie rondde je af met "Sessie afronden", maar de sessie stond daarna niet onder "Vorige bereidingen". Die lijst werd alleen gevuld uit reviews, en een review ontstond alleen via het handmatige reviewformulier in de oude kookpagina. "Sessie afronden" bewaarde niets.

## Wat verandert er?
- **Sessie afronden bewaart de bereidingen.** Het paneel toont per gerecht dat echt is gestart (op de BBQ gelegd, aan het rusten of gereed; niet de gerechten die nog niet begonnen waren) een regel met de naam, de werkelijke tijd op de BBQ en de eindkern. "Bewaar in bereidingshistorie" staat standaard aan per gerecht; zet je het uit, dan wordt dat gerecht niet bewaard.
- **Score en opmerking zijn optioneel.** Per gerecht kun je 1 tot 5 kiezen; standaard staat er "Geen score". Zonder score blijft de score leeg en telt dat gerecht niet mee in het gemiddelde. Eén opmerking voor de volgende keer geldt voor alle bewaarde gerechten.
- **Alleen echte gegevens.** De duur is de tijd tussen "Op BBQ gelegd" en "Begin rusten" (of "Gerecht gereed" bij een gerecht zonder rusttijd). Staat het gerecht nog op de BBQ, dan is er geen eindtijd en blijft de duur leeg ("duur niet vastgelegd"); er wordt niets geschat. De eindkern is de laatste verse MEATER-meting, anders je laatste handmatig ingevoerde kern, anders leeg. Een handmatige kern wordt nooit als MEATER-meting bewaard of getoond.
- **Geen dubbelen.** Rond je twee keer af, of bewaarde je al een review voor dezelfde bereiding, dan staat het gerecht er al (het paneel zegt "Staat al in je bereidingshistorie") en wordt er niets bijgemaakt. Als "dezelfde bereiding" geldt: een review met dezelfde naam, gemaakt op of na het moment dat het gerecht op de BBQ werd gelegd. Een oudere review van een andere keer telt niet.
- **Vorige bereidingen vind je gemakkelijker.** Op Vandaag staat nu "Eerdere bereidingen (N)" en na het afronden zie je een melding met "Bekijk in bereidingshistorie". De lijst toont nu al je bewaarde gerechten (ook gerechten die niet meer in je huidige planning staan en bereidingen zonder werkelijke duur) en zegt zonder historie: "Historie verschijnt na je eerste afgeronde sessie of review."
- Een korte regel in het paneel zegt dat dit alleen in je eigen opslag op dit apparaat en, in de Home Assistant-kaart, in je eigen Home Assistant-account komt. Niets wordt gedeeld. Er komen geen pop-ups; "Annuleren" laat alles zoals het was.

## Je gegevens
Geen nieuwe opslagsleutel en geen nieuw veld. De bereidingen gaan door dezelfde route als een handmatige review (`kamado-reviews-v1`, met dezelfde Home Assistant-synchronisatie) en tellen dus mee in de "mediane duur" van een gerecht. Eén kleine uitbreiding op het bestaande veld `rating`: het mag nu leeg zijn ("geen score") in plaats van stilzwijgend 5 te worden; bestaande reviews hebben altijd een score en blijven ongewijzigd. Een leeg `rating` werkt ook in de Home Assistant-kaart (`bbq_planner_card.js`).

## Nog niet getest op een echte telefoon
Niet getest op een echte iPhone, in de Home Assistant-app of met een echte MEATER. Het gedrag is getest met een nagebootste klok en een gezaaide opslag in Chromium en WebKit (390 en 320 px). Of de live MEATER-kern bij het afronden werkelijk wordt overgenomen (alleen als de meting nog vers is, maximaal vijf minuten), en of de synchronisatie met je Home Assistant-account de nieuwe items netjes meeneemt, is nog niet in de praktijk gezien.

Projectinformatie: [PROJECT_STATUS.md](https://github.com/eelbrethouwer-jpg/bbq_planner_card/blob/main/PROJECT_STATUS.md).
