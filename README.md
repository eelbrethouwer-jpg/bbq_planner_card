# BBQ Bereidingsplanner + MEATER

Een mobiele BBQ-bereidingsplanner voor **één grote en één kleine kamado**, met live MEATER Pro/Plus-gegevens via Home Assistant.

![Schematische weergave BBQ-planner](assets/preview.svg)

*Illustratie van de interface, niet een live MEATER-meting.*

## Mogelijkheden

- Gerechten toevoegen, wijzigen, verwijderen en aan grote of kleine kamado koppelen.
- Eén gewenste serveertijd, automatisch teruggerekende start-, bereidings- en rusttijden.
- Temperaturen en mogelijke kamadoconflicten; visuele tijdlijnen en draaiboek.
- MEATER Pro en MEATER Plus: kerntemperatuur, omgeving, doeltemperatuur, kookstatus, resterende tijd en meetverloop.
- Slimme bijsturing: vaste of flexibele serveertijd met adviezen op basis van geldige MEATER-ETA's.
- Werkt als Home Assistant-dashboardkaart en behoudt de afzonderlijke zelfstandige HTML-planner.
- Klikbare stappen in **04 Draaiboek** met voorbereiden, garen, rusten en aansnijden, inclusief een uitgewerkt **Ribeye 500 g**-recept.
- Een recept toevoegen via internetlink (alleen als de bron CORS-toegang toestaat) of door de recepttekst te plakken. Eigen recepten blijven lokaal beschikbaar als voorbeeldgerecht.
- Bewaar een beoordeling na iedere bereiding, met je uiteindelijke kern, instellingen en optioneel de recente MEATER-kern/omgeving. Eerdere beoordelingen zijn zichtbaar als je hetzelfde gerecht opnieuw bereidt.
- MEATER-grafieken tonen nu **kern én omgeving** in °C, op een gezamenlijke schaal en met tijden.

**Let op:** handmatige bereidingstijden zijn schattingen; MEATER-waarden zijn echte metingen uit Home Assistant met mogelijke vertraging. De planner is geen vervanging voor voedselveiligheidscontroles. Live-informatie verschijnt alleen in de Home Assistant-dashboardkaart.

## Openbare website om met vrienden te delen

Je kunt deze planner ook **zonder Home Assistant** als website gebruiken, op iPhone of Android.
Het publieke websiteadres is **https://eelbrethouwer-jpg.github.io/bbq_planner_card/** zodra GitHub Pages is ingeschakeld.

**Eenmalig activeren:** Open [Settings → Pages](https://github.com/eelbrethouwer-jpg/bbq_planner_card/settings/pages), kies **Deploy from a branch**, stel **main** en **/(root)** in en klik op **Save**. Zie [WEBSITE.md](WEBSITE.md) voor de volledige uitleg.

De vaste webpagina `index.html` opent automatisch de bestaande zelfstandige HTML-planner onder `dist/`, zodat de Home Assistant-code en de openbare website dezelfde planner blijven gebruiken.

- Met **↗ Deel website** kun je vanaf een iPhone via het deelmenu (bijvoorbeeld WhatsApp) de openbare link doorsturen.
- Iedereen beheert **zijn eigen** gerechten, recepten en reviews in de lokale browseropslag. Er is nog geen accountsysteem of synchronisatie.
- De openbare website leest **geen** Home Assistant- of MEATER-gegevens. De bestaande ingelogde HA-dashboardkaart blijft de enige live-bron.
- De deelknop deelt alleen het **websiteadres**, nooit jouw eigen planning of sensorwaarden.

## Installatie via HACS (custom repository)

1. Open HACS in Home Assistant > menu met drie puntjes > **Aangepaste repositories**.
2. Voeg deze repository toe als categorie **Dashboard**.
3. Download de repository via HACS. HACS plaatst de bestanden in `config/www/community/bbq_planner_card/`.
4. Controleer of de planner op de volgende locatie opent, met je normale Home Assistant-host: `/hacsfiles/bbq_planner_card/BBQ_bereidingsplanner_MEATER_v4.html`.
5. Voeg als **JavaScript-module** de dashboardbron toe: `/hacsfiles/bbq_planner_card/bbq_planner_card.js`.
6. Plaats onderstaande handmatige kaart in je dashboard:

```yaml
type: custom:bbq-planner-meater-card
```

**Overstap vanaf handmatige versie:** voeg **niet** beide JavaScript-resources tegelijk toe. Vervang de oude `/local/BBQplanner/bbq-planner-ha-card.js`-resource door de nieuwe `/hacsfiles/...`-resource. Je bestaande kaart-YAML blijft gelijk. Maak eventueel eerst een back-up van je instellingen.

## Live-koppeling

De kaart leest Home Assistant-entiteiten via de ingelogde `hass`-sessie en stuurt alleen hun meetwaarden door aan de lokale planner-iframe. **Geen toegangstoken in de code.**

Deze release verwacht de volgende sensorprefixes (op maat voor deze installatie):

- MEATER Pro: `sensor.meater_probe_00e865be_`
- MEATER Plus: `sensor.meater_probe_c7dbf045_`

Bij andere apparaten of entiteitsnamen zijn deze prefixes in `dist/bbq_planner_card.js` aan te passen.

## Versies

Gepubliceerde versie: **v4.0.0**. **v4.1.0** is voorbereid in een aparte releasebranch en wordt pas actief na samenvoegen, taggen en het publiceren van een nieuwe GitHub Release.

Zie [CHANGELOG.md](CHANGELOG.md) voor wijzigingen. Publiceer een nieuwe GitHub Release met een versietag als je een versie wilt uitbrengen. De HACS-workflow controleert de repository automatisch op iedere push, pull request en via een geplande controle.

## Recepten en evaluaties (v4.1.0)

De receptenbibliotheek en bereidingsevaluaties staan in de **browseropslag (localStorage)** van het apparaat waarop de planner geopend is. Ze zijn niet automatisch gedeeld tussen iPhone, Safari of het Home Assistant-dashboard op een ander apparaat. Het laden van een planning in JSON bevat de receptvelden van de gerechten; de los opgeslagen reviewhistorie en receptenbibliotheek worden niet mee geëxporteerd. Wis de browseropslag niet zonder een aparte back-up van je gegevens. Het resetten van de voorbeeldplanning wist de bibliotheek en reviews niet.

Een gewone receptlink wordt alleen automatisch gelezen als de website toegang via de browser toestaat én gestructureerde Recipe-gegevens aanbiedt. Anders kun je de tekst plakken. Dit programma omzeilt geen CORS-beveiliging en maakt geen gebruik van externe scraping- of AI-services. Controleer de geïmporteerde bereidingsinstructies, allergenen en voedselveiligheid.

De gecombineerde MEATER-grafiek toont uitsluitend meetpunten die zijn binnengekomen **terwijl de planner openstaat**. Er is geen volledige Home Assistant-historie opgehaald; er worden geen voorbeeldcurves gegenereerd.

## Veiligheid

Bereidingstijden en MEATER-ETA's zijn indicaties. Controleer veilige kerntemperaturen volgens het gerecht, gebruik een geschikt meetpunt en ga niet uitsluitend op de planner af. Publiceer nooit Home Assistant-toegangstokens, wachtwoorden of persoonlijke netwerkgegevens in deze publieke repository.