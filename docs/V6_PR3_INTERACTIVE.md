# BBQ Regisseur v6.0 — PR #34 (draft)

## Claudes reviewronde: route (b), **nog geen publicatieakkoord**

Claude bekeek main `f6f0d76` en PR-HEAD `1e4d528`: code **GO MET OPMERKINGEN**,
publicatie nog geen GO. Voor de volgende ontwikkelronde is uit voorzorg
**route (b)** voorbereid, niet definitief door gebruiker goedgekeurd:

- `dist/`, `index.html`, `sw.js`, de HACS-card, appversie en alle bestaande
  productie-artefacten zijn **byte-identiek aan main**. De eerdere v6-previewloader
  en journal-stop in `dist/BBQ_bereidingsplanner_MEATER_v4.html` zijn teruggedraaid.
- Nieuwe aparte `v6/preview.html` leest op **dezelfde origin** uitsluitend de
  opgeslagen v5-planning uit `kamado-bereidingsplanner-v1`. Dit vereist dat de
  gebruiker die site vanuit dezelfde browser en opslagcontext opent. Er is
  geen toegang tot een andere origin/HA-webview of andere apparaatopslag.
- De preview gebruikt de bestaande optimizer en max. drie voorstellen.
  **Toepassen wordt niet getoond**, omdat geen productie-`onApply` is gekoppeld.
- `Bewaar als concept` slaat alleen metadata + hashes apart op in
  `bbq-v6-proposal-draft-v1`. Een al bestaand concept wordt niet stilzwijgend
  overschreven: expliciete bevestiging is vereist. Binnen de exclusieve v6-Web
  Lock moet de conceptwaarde nog overeenkomen met de waarde waarop de
  bevestiging was gebaseerd. Anders volgt `DRAFT_CHANGED`.
- `v6/legacy-readonly-entry.mjs` detecteert planningwijzigingen vanuit een
  ander tabblad via `storage`, én dezelfde tab via **render, focus,
  visibilitychange en iedere twee seconden**. Bij wijziging verdwijnen alle
  alternatieven, berekeningen stoppen, de status meldt
  `Planning gewijzigd`, conceptstatus wordt opnieuw berekend en een volledige
  paginaherlading is nodig.
- Een onafgerond `bbq-v6-apply-journal-v1` blokkeert alleen de **aparte
  v6-preview**, vóór de v6-initialisatie. Daar biedt
  `v6/preview-recovery.js` knoppen voor `Download noodkopie` (alle drie de
  ruwe sleutels: journal, actieve v5-planning en v5-backup) en
  `Journal verwijderen en planner openen`. De laatste knop vergt
  expliciete bevestiging, verwijdert **uitsluitend** de journal en opent
  de ongewijzigde bestaande v5-planner. **Het verwijderen is geen rollback en
  kan herstel onmogelijk maken.**
  De gebruiker moet de noodkopie eerst controleren.
- Omdat route (b) `dist/` ongemoeid houdt, **kan de oude v5-pagina niet
  worden geblokkeerd bij een bestaande journal**. Dat is een bewuste beperking
  van deze route. De huidige v6-preview heeft **geen productie-apply** en
  kan zelf geen journal aanmaken, dus er ontstaat geen nieuw risico door
  de preview. Een oude journal door andere/experimentele code blijft
  een expliciet herstelvraagstuk.

## Waar werkt de beta?

**Voorlopige testpreview, nog niet gepubliceerd.** De losstaande pagina
`/v6/preview.html` leest alleen de sleutel
`kamado-bereidingsplanner-v1` op **dezelfde origin én in dezelfde
browseropslagcontext** als de v5-planner. De preview koppelt niet met
accounts of clouddata. Er vindt geen synchronisatie plaats.

- **Desktopbrowser:** open de gewone v5-planner en de preview in dezelfde
  browser en op hetzelfde domein. Bewaar in die browser eerst de v5-planning.
- **iPhone Safari:** gebruik beide pagina's in **Safari zelf** en controleer
  eerst dat Safari de planning onder dezelfde origin heeft opgeslagen.
  Een geïnstalleerde beginscherm-PWA kan een **eigen opslagcontext** hebben;
  verwacht niet dat een plan uit de geïnstalleerde app automatisch in Safari
  beschikbaar is, of omgekeerd. Dat moet afzonderlijk op een echte iPhone
  worden getest. De preview is geen vervanging voor de bestaande PWA.
- **Home Assistant/HACS:** deze losstaande preview heeft geen HA-data-bridge
  en is **niet beschikbaar als geïntegreerde HA-kaart**. Een iframe of
  WebView kan bovendien een afzonderlijke origin/opslagcontext hebben.
- **Openbare bereikbaarheid:** een merge via GitHub Pages maakt
  `v6/preview.html` **ook zonder navigatielink bereikbaar via de URL**.
  Deze pagina is dus niet privé. Ze leest alleen de lokale browsersessie,
  niet gegevens van de server of van andere gebruikers.
- **Openbare testpagina:** `v6/sandbox.html` is herkenbaar gelabeld als
  **TESTPAGINA – FICTIEVE DATA**; ze is geen echte planner.
- **Beta-cache:** `v6/preview.html` en de dynamische module-import
  gebruiken dezelfde `6.0.0-beta.1`-token. De CI vergelijkt deze
  tokens en bewaakt `dist/`, `index.html` en `sw.js` tegen main.
  Dit is een **ontwikkelversie**, geen tag of gepubliceerde release.

## Wat dit nadrukkelijk NIET is

- Geen productiepublicatie, release, versie-update of merge.
- Geen automatische recovery, rollback, schrijfende v6-planning, v5-migratie
  of generatieteller in de bestaande v5-persistent state.
- Geen mogelijkheid om oude niet-meewerkende v5-tabbladen achteraf met
  Web Locks te blokkeren.
- Geen gegarandeerde preview in HACS/Home Assistant: de HA-context kan op
  een andere origin/opslagcontext draaien; route (b) werkt daar niet zonder
  een apart ontworpen data-bridge. De preview is voorlopig uitsluitend een
  **GitHub Pages/same-origin browserfunctie** als er later publicatieakkoord is.

## Belangrijkste bestanden

`engine/*`, optimizersemantiek, `kamado-bereidingsplanner-v1`-formaat en
`bbq-v5-previous-plan-v1` zijn ongewijzigd.

- `v6/optimizer-client.mjs`, `v6/optimizer-worker.mjs`: moduleworker,
  annulering, stale responses
- `v6/preview-model.mjs`, `v6/regisseur-view.mjs`,
  `v6/regisseur.css`: interactieve voorstellen, zonder productie-apply
- `v6/legacy-readonly-entry.mjs`, `v6/preview-entry.mjs`,
  `v6/preview.html`: aparte same-origin preview en invalidatie
- `v6/preview-recovery.js`: herstelmelding, export en bevestigd
  verwijderen journal — alleen in aparte v6-preview
- `v6/proposal-draft.mjs`: metadata-only conceptopslag met conflictcontrole
- `v6/apply-proposal.mjs`, `v6/storage-journal.mjs`,
  `v6/live-apply-adapter.mjs`, `v6/plan-lock.mjs`: voorbereide
  maar **niet gekoppelde** schrijf-/herstel-infrastructuur

## Review en testcriteria

- `tests/v6-pr3-real-v5-browser.mjs`: Chromium/WebKit 320/375/390/768/1024px,
  normale v5-URL ook met `?v6preview=1` onveranderd,
  nieuwe standalone preview, conceptopslag, hetzelfde-tabblad-veroudering
  binnen 3 seconden, oud tweede tabblad, verplichte overschrijfbevestiging,
  herladen en bewaren/verwijderen. Browsercontrole van journal-download
  (journal + plan + backup), annuleren en bevestigen.
- `tests/v6-pr3-preboot.mjs`: jsdom-noodkopie en handmatig
  journaldeleren in aparte preview; geen mutatie van de bestaande v5-plankey.
- `tests/v6-pr3-proposal-draft.mjs`: stale concepten, metadata-only,
  weigeren bij onbedoeld overschrijven, race tussen twee tabbladen,
  storagefouten en behoud v5-data.
- Bestaande v4/v5-tests, 56 v6-oracles, 27 optimizer-oracles,
  storage-/rollback-/cross-tabtests blijven verplicht.
- Geen echte iPhone-PWA-, HA-, MEATER- of hardwaretests uitgevoerd.
  Een geslaagde GitHub CI is niet hetzelfde als gebruikersacceptatie.

## Volgende beslissingen

1. Laat de actuele HEAD en CI onafhankelijk opnieuw reviewen, inclusief
   de vijf punten uit Claudes overdracht. Reparaties mogen in deze draft,
   maar geen stilzwijgende release.
2. Vraag gebruiker expliciet of **route (b)** de gewenste
   publicatiestrategie is. Route (a) is een formele, geversioneerde
   beta-release met aanpassingen aan de productiebundel, service worker,
   changelog en expliciete publicatietoestemming.
3. Realistische iPhone-PWA-test plus test van dezelfde-origin opslag,
   daarna expliciet merge-/releaseakkoord.
4. Echte `Toepassen` kan pas na generatieteller, legacy-tab-strategie,
   rolloutperiode en aparte veiligheidsreview.

**Status:** PR blijft draft. Geen merge, tag of release toegestaan zonder
expliciete toestemming.
