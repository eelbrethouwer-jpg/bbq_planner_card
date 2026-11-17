# BBQ Planner v5.7.0 — planning eenvoudiger

**Status: draft-PR, nog niet gepubliceerd.** Er is nog geen releaseakkoord van de eigenaar; deze notitie bevat daarom bewust geen goedkeuringsregel. Mergen publiceert dus niets.

## Wat verandert er?
Je plant nu met minder gedoe en je ziet meteen wat er mis is, en wat je eraan kunt doen. De app past je planning nooit zelf aan: alles wat verandert is een tik van jou.

- **Slimmere kamadokeuze bij toevoegen.** Voeg je een gerecht toe (stap 1, ook "+1"), dan kiest de app de kamado waarop het de minste conflicten geeft, met dezelfde conflictscore als "Verdeling voorstellen". Is het gelijk, dan blijft de standaard van het recept. Dit gebeurt **alleen bij het toevoegen, alleen voor het nieuwe gerecht**. Een keuze die je zelf maakte, of een bestaand gerecht, wordt nooit veranderd.
- **Urgente conflicten staan in rood bovenaan stap 2**, met een directe oplossing. Bijvoorbeeld "Zet Kippenpoten op de kleine kamado" (met een knop om het te doen) of "Begin om 08:00 of serveer om 03:00". Drie meldingen over hetzelfde paar gerechten worden één kaart.
- **"Naar voorbereiding" vraagt om bevestiging** zolang er urgente conflicten zijn. Annuleren laat alles zoals het is.
- **Te laat gestart: "Plan opnieuw vanaf nu".** Is de serveertijd al voorbij, of had je meer dan 15 minuten eerder moeten beginnen en is er nog niets gestart, dan staat er in stap 3 en bovenaan Live een aanbod. Je ziet eerst voor en na (nieuwe serveertijd = nu + benodigde tijd) en niets verandert tot je bevestigt. Gaat het over middernacht, dan schuift de datum van de planning mee en blijven afgevinkte taken afgevinkt. "Beschikbaar vanaf" wordt zo nodig niet later dan nu.
- **Voorbereiding "de avond vooraf" al voorbij.** In stap 3 staat dan een duidelijke melding met een alternatief (nu doen, de serveertijd opschuiven of de stap bewust overslaan). Afvinken haalt de melding weg.

## Je gegevens
Recepten, reviews, planningen en opgeslagen gegevens blijven zoals ze zijn. Er zijn **geen nieuwe opslagvelden of sleutels**. "Plan opnieuw vanaf nu" gebruikt de bestaande velden `mealTime`, `date`, `dateMode` en `availableFrom` en verplaatst bij een nieuwe datum de bestaande afvinkstanden (`v46Done`, `v5Actual`) naar de nieuwe datumsleutel.

## Nog niet in de praktijk getest
Niet getest op een echte iPhone, in de Home Assistant-app of met een echte MEATER. De automatische tests gebruiken een nagebootste klok en de echte planner in een browser (Chromium en WebKit). Controleer zelf of het rode paneel, de bevestiging en "Plan opnieuw vanaf nu" op je telefoon prettig lezen en bedienen.

Projectinformatie: [PROJECT_STATUS.md](https://github.com/eelbrethouwer-jpg/bbq_planner_card/blob/main/PROJECT_STATUS.md).
