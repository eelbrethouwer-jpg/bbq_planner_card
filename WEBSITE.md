# Openbare BBQ-plannerwebsite (GitHub Pages)

**Repository:** https://github.com/eelbrethouwer-jpg/bbq_planner_card

**Websiteadres zodra Pages is ingeschakeld:**
https://eelbrethouwer-jpg.github.io/bbq_planner_card/

## Eenmalige activering door de repository-eigenaar

1. Open https://github.com/eelbrethouwer-jpg/bbq_planner_card/settings/pages
2. Selecteer onder **Build and deployment → Source**: **Deploy from a branch**.
3. Selecteer **Branch: main**, map **/(root)** en klik **Save**.
4. Controleer via **Settings → Pages** dat de website is gepubliceerd.
5. Open de website op een iPhone en test: gerecht toevoegen, uitklapbare recepten, receptimport en bereidingsevaluatie.

Er is geen aanvullende hosting, eigen domein, installatie, wachtwoord of Home Assistant-login nodig.

## Hoe dit werkt

De ingang `/index.html` verwijst naar `/dist/BBQ_bereidingsplanner_MEATER_v4.html`.
Die HTML is dezelfde zelfstandige planner als die bij de HACS-kaart wordt meegeleverd. 
Een update van die HTML komt daardoor ook op de website terecht bij volgende wijzigingen op `main`.

De website is openbaar maar **heeft geen toegang tot Home Assistant, jouw MEATER-sensoren of je eigen planningsgegevens**. 
Alle ingevoerde plannen, recensies en recepten worden uitsluitend in de browseropslag op de eigen telefoon/computer bewaard.
Er is **geen automatische synchronisatie** tussen apparaten of gebruikers.
Wie de browserdata wist, kan deze lokaal bewaarde inhoud verliezen. Gebruik voor je planning de bestaande JSON-export.

De knop **🔗 Deel website** in de planner opent op geschikte telefoons het standaard deelmenu (waaronder WhatsApp).
Anders wordt de link gekopieerd of verschijnt een kopieervenster.
Het delen van de *website* deelt **nooit je eigen planning of Home Assistant-gegevens**.

Op GitHub Pages werken de MEATER-grafieken alleen als lege offline weergave totdat een externe integratie expliciet wordt ontwikkeld.
De Home Assistant-bridge in `dist/bbq_planner_card.js` wordt niet door deze website gebruikt.
Bij import van een recept-URL gelden de normale CORS-beperkingen van de bronwebsite: kopiëren en plakken werkt als alternatief.

## Als de link (nog) niet werkt

- Controleer of **Settings → Pages** is geactiveerd op `main` en `/(root)`.
- Controleer of `index.html` en de `dist/`-map op `main` aanwezig zijn.
- De installatie via HACS blijft afzonderlijk verlopen en wordt niet aangepast door de Pages-instelling.
