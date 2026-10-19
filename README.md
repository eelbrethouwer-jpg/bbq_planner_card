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

**Let op:** handmatige bereidingstijden zijn schattingen; MEATER-waarden zijn echte metingen uit Home Assistant met mogelijke vertraging. De planner is geen vervanging voor voedselveiligheidscontroles. Live-informatie verschijnt alleen in de Home Assistant-dashboardkaart.

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

Huidige eerste GitHub/HACS-release: **v4.0.0** (gebaseerd op de werkende BBQ-planner v4).

Zie [CHANGELOG.md](CHANGELOG.md) voor wijzigingen. Publiceer een nieuwe GitHub Release met een versietag als je een versie wilt uitbrengen. De HACS-workflow controleert de repository automatisch op iedere push, pull request en via een geplande controle.

## Veiligheid

Bereidingstijden en MEATER-ETA's zijn indicaties. Controleer veilige kerntemperaturen volgens het gerecht, gebruik een geschikt meetpunt en ga niet uitsluitend op de planner af. Publiceer nooit Home Assistant-toegangstokens, wachtwoorden of persoonlijke netwerkgegevens in deze publieke repository.