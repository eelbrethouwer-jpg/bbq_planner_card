# BBQ Planner v4.9.1 — Recepten betrouwbaar goedkeuren en bewaren

## Opgelost
- Receptgenerator herkent nu ook langere zinnen zoals "BBQ ... een temperatuur van ongeveer 230 graden", zoals in Big Smash Burgers.
- Verplichte velden krijgen **zichtbare, concrete foutmeldingen direct bij de goedkeuring én bij het ontbrekende veld**. Er worden geen ontbrekende temperaturen of bereidingstijden verzonnen.
- De knop leest bij het indrukken opnieuw de actuele invoervelden; dit vangt een laatste wijziging op mobiel/Safari op.
- Bij opslag in Safari wordt de echte lokale schrijfactie gecontroleerd: geen onterechte succesmelding bij geblokkeerde of volle browseropslag.
- Bij hernoemen van een recept wordt de oude versie pas vervangen nadat de nieuwe gegevens konden worden bewaard; mislukken houdt het concept beschikbaar.
- Na goedkeuring blijf je op **Recepten**, wordt de nieuwe kaart in **Mijn receptenbibliotheek** zichtbaar en krijgt het recept óók een plaats in de **Planning**. De navigatie naar Planning voor andere acties is ongewijzigd.
- Versieparameter en serviceworkercache vernieuwd zodat iPhone/PWA-gebruikers de bugfix kunnen ophalen.

## Controle
- Extra geautomatiseerde DOM-regressies voor Big Smash Burgers, zichtbare validatie, het lezen van velden bij klikken, navigatie naar de bibliotheek en een gesimuleerde lokale opslagfout.
- Bestaande tests voor receptbewerking, hernoemen, bibliotheek, tijdlijnen, MEATER, mobiele navigatie en PWA blijven onderdeel van de CI.

## Nog handmatig controleren na merge
- [ ] GitHub Actions: `html-javascript`, `ui-smoke`, `validate-hacs` groen.
- [ ] iPhone Safari: genereer Big Smash Burgers, keur goed en controleer Mijn recepten én Planning.
- [ ] iPhone Safari: maak recept zonder temperatuur, controleer de foutmelding en vul handmatig aan.
- [ ] Home Assistant: controleer of een goedgekeurd recept na herstart gesynchroniseerd terugkomt.
- [ ] PWA: herstart de app en voer de versie-update uit; recepten blijven bewaard.

**Opmerking:** de openbare GitHub Pages-app en de Home Assistant-kaart delen niet vanzelf lokale browseropslag. Gebruik de Home Assistant-kaart voor accountsynchronisatie of exporteer/importeer de JSON-receptenbibliotheek.
