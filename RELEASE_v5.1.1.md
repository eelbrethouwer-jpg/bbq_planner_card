# BBQ Planner v5.1.1 — Kookfuncties weer bereikbaar

**Status: gepubliceerd op 7 november 2026.** [GitHub Release v5.1.1](https://github.com/eelbrethouwer-jpg/bbq_planner_card/releases/tag/v5.1.1); code/tag-commit 8afb5a89c7d2af975f6cddcbb97598682906e543 (PR #28). Publicatie via PR #29. Echte iPhone/HA/MEATER-proeven nog open.

Bron: `main` commit `fad295cf7a147b0de160069e529da45bd2b7a13d`. Gepubliceerde v5.1.0-tag verwijst naar `e2b1a861d745c6fcd77ff39515330995673c4d43`.

## Wijzigingen
- Live krijgt **📈 MEATER-grafiek & focusmodus** naar de bestaande `legacy('cooking')`-pagina.
- In de kookpagina blijft de enige zichtbare ondernavigatie op **Live** en de terugknop is **← Live**.
- Legacy-planning markeert Live wanneer geopend vanuit Live, anders Vandaag.
- Taakregels en hero tonen datum en tijd bij een andere dag, anders alleen tijd.
- Een ongebruikte kamado toont **Niet in gebruik**.
- Cache, HTML/PWA-redirect, Home Assistant-bron en CSS/JS-querystrings hebben versie 5.1.1.

## Compatibiliteit
Opslagsleutels, v4-engine, MEATER-integratie, recepten en reviews ongewijzigd. Geen migratie.

## Validatie
Bestaande DOM- en PWA-regressietests uitgebreid met kookscherm en bereikbare MEATER-/focusknoppen, navigatie, daggrenzen en lege kamado. Alle bestaande checks moeten groen zijn. Fysieke iPhone, Home Assistant en echte MEATER-metingen blijven voor praktijkacceptatie open.

## Releasebeleid
**PR #28 en #29 gemerged; GitHub Release/tag v5.1.1 gepubliceerd en gecontroleerd.** De workflowmerge na de codecommit wijzigt geen appcode. Geïnstalleerde HACS-/PWA-versie is niet bevestigd.
