# BBQ Planner v5.0.3 — Warmgerookte zalm op brioche

## Wijzigingen

- Nieuwe ingebouwde preset **Warmgerookte zalm op brioche**, naast bestaand algemeen **Zalm**.
- Teruggevonden recept: 800–1.000 g zalm, 110–120 °C indirect met appel-/kersenrook, 40–60 minuten indicatie, 5 min rust. Rub en beide sauzen volledig uitgeschreven: citroen-roomkaascrème en honing-mosterdsaus, zonder ui.
- Acht uitklapbare stappen voor de receptplanner en v5 kookflow.
- Downloadbare persoonlijke import: `recepten/warmgerookte-zalm-op-brioche.import.json` (**Recepten → Mijn receptenbibliotheek → Recepten importeren → Samenvoegen**).
- v5.0.3 cache-busting voor website/PWA en Home Assistant iframe.

## Eerdere recepten en data

- Geen migratie van het bestaande lokale receptarchief, geen veranderingen aan MEATER-koppeling, planning of historische beoordelingen.
- Het nieuwe ingebouwde voorbeeld wordt na publicatie zichtbaar in de receptkeuze maar **niet automatisch** in de persoonlijke bibliotheek gezet. Import via JSON is een bewuste stap, om meerdere bezoekers en bestaande data niet te raken.

## Veiligheid

Het oorspronkelijke gerecht gebruikte 50–52 °C kern: sappig maar niet door-en-door gaar. De app vermeldt zowel Voedingscentrum (60 °C) als FoodSafety.gov (63 °C). Voor jonge kinderen, zwangeren, ouderen en mensen met een verminderde weerstand goed doorgaren.

## Acceptatiecriteria

- Nieuwe preset zichtbaar in v5 'Nieuwe sessie', bestaande 'Zalm' behouden.
- Bij plannen blijven zalm, beide sauzen, 8 stappen en de gekozen kernwaarden behouden.
- JSON heeft het bestaande `bbq-receptenbibliotheek-v1` formaat; 'Samenvoegen' tast andere recepten niet aan.
- Automatische smoke-/PWA-/HACS-checks groen op de PR-HEAD.
- Handmatig te controleren: echte iPhone Safari/PWA na update, Home Assistant HACS-iframe, receptenimport en MEATER-livegebruik.

## Teststatus

- Statische eigenschappen bij schrijven gecontroleerd: JSON-parse en 8 stappen.
- Geautomatiseerde GitHub Actions: te beoordelen nadat PR is aangemaakt.
- Echte iPhone/HA/MEATER-hardware: niet hier getest.

**Releasekandidaat; geen automatische merge of GitHub Release.**
