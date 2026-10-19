# Installatie: overstap van lokale bestanden naar HACS

## Eerst: back-up

Je huidige installatie blijft werken totdat je de oude dashboardresource vervangt. Laat de oude map `homeassistant/www/BBQplanner/` voorlopig staan.

## GitHub

1. Maak een **openbare** GitHub-repository met de exacte naam `bbq_planner_card` (bij voorkeur eigenaar `eelbrethouwer-jpg`).
2. Voeg alle inhoud van dit pakket toe, **met de mapstructuur intact** (niet alleen het ZIP-bestand uploaden).
3. Controleer het HACS-validatieresultaat onder GitHub Actions; corrigeer eventuele meldingen.
4. Maak na succesvolle controles een GitHub Release aan met de tag `v4.0.0`.

## HACS

1. Open HACS -> menu -> Aangepaste repositories.
2. Voeg `https://github.com/eelbrethouwer-jpg/bbq_planner_card` toe en kies **Dashboard**.
3. Download de versie via HACS.
4. Test in de browser `/hacsfiles/bbq_planner_card/BBQ_bereidingsplanner_MEATER_v4.html` op je eigen Home Assistant-host. Ga pas door als dit werkt.
5. Ga naar Instellingen -> Dashboards -> Bronnen. **Bewerk** je bestaande BBQ-resource naar `/hacsfiles/bbq_planner_card/bbq_planner_card.js` (JavaScript-module). Voeg geen tweede toe.
6. Vernieuw het dashboard en controleer de bestaande kaart `type: custom:bbq-planner-meater-card`.
7. Controleer dat beide MEATER-temperaturen doorkomen en dat de slimme planning reageert zoals verwacht.

## Terugrollen

Bij een probleem: wijzig de dashboardresource terug naar `/local/BBQplanner/bbq-planner-ha-card.js?v=40` (mits de oude bestanden nog aanwezig zijn), ververs de browser en onderzoek de fout. Maak geen tweede actieve resource met dezelfde kaartnaam.

## Updateproces

Wijzig `dist/BBQ_bereidingsplanner_MEATER_v4.html` en waar nodig `dist/bbq_planner_card.js`; test de bestaande functies; commit; controleer de HACS-validatie; publiceer een nieuwe release met oplopende versietag, bijvoorbeeld `v4.0.1`; controleer/download de update via HACS; ververs de dashboardpagina.