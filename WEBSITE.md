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

## iPhone-app (v4.9.0)
De publieke website is een **Progressive Web App**. Open de publieke URL in **Safari**, tik op **Delen → Zet op beginscherm**, zet indien getoond **Open als webapp** aan en bevestig **Voeg toe**. Start daarna via het icoon op het beginscherm. De app draait in standalone-modus zonder Safari-balken.

In **Meer → BBQ Planner als eigen app** staan installatie-instructies, een knop om de link te delen en een updatecontrole. Als er een nieuwe service worker wacht, kan de gebruiker de update bewust activeren. Alle bestaande vijf navigatieschermen blijven behouden.

Het app-icoon, manifest, CSS en service worker staan in de root van de GitHub Pages-site. Cache bevat alleen statische appbestanden, nooit live MEATER-metingen of externe receptfoto's. Offline is alleen de reeds geladen publieke app met lokaal opgeslagen gegevens bruikbaar; dit is **geen** offline Home Assistant/MEATER-verbinding. iOS-versies en installatiemethoden kunnen verschillen.

**Belangrijk over gegevens:** Safari/PWA op dezelfde publieke herkomst delen doorgaans websiteopslag, maar de Home Assistant-dashboardkaart gebruikt een andere herkomst en eigen gesynchroniseerde gebruikersopslag. Er is geen automatische migratie. Bewaar je planning via de JSON-export voordat je van toegangsmethode wisselt, en wis geen websitegegevens als je recepten wilt behouden.

**Updates:** publiceer de gewijzigde bestanden naar de GitHub Pages-branch. Open de geïnstalleerde app met internet; controleer updates via Meer. GitHub Pages kan enige tijd nodig hebben om een publicatie zichtbaar te maken. Native iOS-pushmeldingen vanuit de openbare app zijn niet geïmplementeerd; voor meldingen blijft de bestaande Home Assistant-route beschikbaar.
