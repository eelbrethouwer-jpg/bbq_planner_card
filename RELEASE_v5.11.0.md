# BBQ Planner v5.11.0 — receptgenerator herkent reverse sear

**Status: draft-PR, nog niet gemerged en niet gepubliceerd.** Dit bestand bevat bewust geen goedkeuringsregel: mergen publiceert niets. Een releaseakkoord van de eigenaar is nodig voordat zo'n regel in een aparte PR komt.

## Wat verandert er?
Bij "Recept uit tekst maken" koos de generator bij een reverse-sear-tekst (bijvoorbeeld de ribeye: indirect gaar tot circa 46 °C, bij ongeveer 47 °C opstoken naar 250 °C, schroeien tot 54 °C) het verkeerde kerndoel (47 in plaats van 54) en de verkeerde methode (indirect in plaats van combo). Een kerndoel van 47 plant een ribeye te rauw. Dat is verholpen; alleen de tekstanalyse is aangepast.

- **Kerndoel.** Een expliciet gelabelde waarde ("Kerntemperatuur 54 °C", "Eindkern", "Doelkern", "Kern: 54") gaat voor op een tussen-waarde uit de lopende tekst; "eindkern", "doelkern" en "doeltemperatuur" gaan nog weer voor op "kerntemperatuur". Zonder label is het doel de hoogste kernwaarde, maar alleen als die ook de laatste in de bereidingsvolgorde is. Anders (twijfel) blijft het veld leeg met de herkomst "meerdere kernwaarden, controleer"; de generator verzint niets.
- **Reverse sear = combo.** Staat er "reverse sear", of eerst indirect en daarna opstoken/schroeien naar 200 °C of meer, dan wordt de methode combo en is de schroeitemperatuur (bijvoorbeeld 250 °C) de BBQ-temperatuur van fase 2. Een kerntemperatuur is nooit een fase-2- of BBQ-temperatuur. Fase-2-duur en ombouwtijd blijven leeg ("ontbreekt"); die vul je zelf in.
- **Reverse sear zonder label.** Een kernwaarde die na de opstook-/schroeizin staat ("Haal van de BBQ bij 54 °C kern", "haal van het rooster bij 52 °C") is de eindkern; de waarde ervoor ("gaar tot 48 °C") is het opstookdoel en komt als voorstel bij die stap. Staat er alleen een waarde vóór de schroeizin, dan blijft de kern leeg met "controleer".
- **Rust en bereidingstijd.** "Rust 10 minuten" zonder "laat" wordt gelezen en een duur op dezelfde regel als een andere duur pakt de juiste.
- **Voorstel voor coreAt (v5.10) ongewijzigd.** De 47 uit "bij ongeveer 47 °C kern" verschijnt als voorstel bij de opstookstap ("Neem 47 °C over"); pas na jouw tik wordt het een fasedoel.
- **Twee kleine bijvangsten in dezelfde tekstanalyse.** "BBQ 120 °C" wordt als BBQ-temperatuur herkend ook zonder het woord "temperatuur" (en "Kerntemperatuur 54 °C" wordt niet meer als BBQ-temperatuur gelezen); "80" uit "BBQ 180 °C" wordt niet meer als fase 2 gelezen.
- Andere teksten (pulled pork, zalm, kip) geven dezelfde uitkomst als voorheen; behalve dat "tot 63 °C kern" zonder het woord "kerntemperatuur" nu wel als kerndoel wordt gelezen.

## Je gegevens
Geen nieuwe opslagvelden of -sleutels en geen wijziging van opgeslagen recepten; het gaat alleen om de analyse van geplakte tekst, en jij controleert en bewaart het concept zelf.

## Nog niet in de praktijk getest
Niet getest op een echte iPhone, in de Home Assistant-app of met een echte MEATER. De automatische tests gebruiken eigen testteksten in de echte planner in een browser.

Projectinformatie: [PROJECT_STATUS.md](https://github.com/eelbrethouwer-jpg/bbq_planner_card/blob/main/PROJECT_STATUS.md).
