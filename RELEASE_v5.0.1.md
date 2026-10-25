# BBQ Planner v5.0.1 — iPhone Layout & Receptkeuze (releasekandidaat)

## Wat is nieuw
- Boven aan **Recepten** een duidelijke keuze met drie tabbladen:
  1. **✨ Recept genereren** — de bestaande lokale generator opent direct; recepttekst of URL invoeren, gegevens beoordelen en expliciet goedkeuren.
  2. **📚 Mijn bibliotheek** — je opgeslagen recepten bekijken, bewerken, importeren/exporteren en inplannen.
  3. **🔥 BBQ Junkie** — de bestaande gecureerde catalogus met foto's, zoekfilters en per-recept importeren; nooit automatisch importeren.
- Vanuit **Nieuwe sessie → Gerechten** nieuwe snelkoppelingen naar generator, bibliotheek en BBQ Junkie.
- De receptschermen hergebruiken de originele DOM-elementen en event handlers: bestaande recepten, goedkeuren, bewerken, importeren, reviews en filters blijven intact.
- Tabkeuze wordt lokaal opgeslagen; een bezoek vanuit v5 start overzichtelijk bij Mijn bibliotheek. Toetsenbordnavigatie met pijltoetsen, Home/End en correcte ARIA-relaties.

## iPhone-verbeteringen
- Datum/tijd/personen vallen op smalle schermen in één kolom.
- Invoervelden/selects en kaarten kunnen krimpen binnen beschikbare breedte.
- Meer ruimte bovenaan voor notch/statusbalk (safe area).
- Oude planningsfilters breken naar één of twee kolommen afhankelijk van schermbreedte.
- **Terug naar v5** is een kleine sticky actie binnen de pagina, geen grote knop die over formuliervelden ligt.
- Korte titel/datebadge-layout aangepast voor smalle schermen.

## Compatibiliteit en beveiliging
- Bewaart oude sleutels en structuren voor sessies, recepten en reviews; geen datamigratie nodig.
- `sw.js`, de publieke redirect en HA-iframeversie gebruiken v5.0.1 en cachen de extra CSS/JS.
- **BBQ Junkie** blijft een beperkte geselecteerde catalogus, niet de volledige/livestreaming website. Bronfoto's werken alleen met internet.
- **Recept genereren** gebruikt de bestaande lokale tekstparser, **geen AI-model** of server. Een website uitlezen is afhankelijk van toestemmingen van de bron.
- **MEATER** blijft alleen live via de Home Assistant-dashboardkaart, niet via de openbare PWA.

## Testen
- `node --check` voor oude en nieuwe scripts.
- Bestaande plannerregressies: `tests/smoke.mjs`.
- v5-sessie en regressies: `tests/v5-smoke.mjs`.
- Nieuw: `tests/v501-smoke.mjs` test tabs, toetsenbord, generator, library, bestaande catalogus en toegang via v5.
- PWA-cache/asset checks en HACS-validatie blijven verplicht.
- **Nog niet op fysieke iPhone Safari getest**: horizontale overflow bij verschillende zoom/tekstgroottes, gebruik met notch, navigatie en PWA-cache-update.
- **Nog niet live in Home Assistant getest**: nieuwe iframeversie, recepten-opslag en echte MEATER-metingen.

## Status
Releasekandidaat op branch `fix/v5.0.1-mobile-recipes`. Niet publiceren zonder review van de actuele GitHub Actions en een iPhone/HA-praktijktest.

**Voorgestelde releasetitel:** BBQ Planner v5.0.1 — iPhone Layout & Receptkeuze
