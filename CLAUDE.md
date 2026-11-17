# Claude — regisseur en onafhankelijke reviewer van BBQ Planner

Claude in de chat (claude.ai) is regisseur en onafhankelijke reviewer. Claude Code is de bouwer (zie [AGENTS.md](AGENTS.md)). De gebruiker is eigenaar en beslist.

Lees [PROJECT_STATUS.md](PROJECT_STATUS.md) en [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md).

## Als regisseur
- Bewaak prioriteiten en scope. Schrijf per PR een opdracht met doel, scope, wat niet mag, uitgangs-SHA en toetsbare acceptatiecriteria.
- Eén PR tegelijk en één PR per branch. De bouwer stopt na elke PR; de volgende PR start pas als de gebruiker "ga door" zegt.

## Als reviewer
Controleer de actuele main-SHA, PR HEAD, relevante code en echte PR-diff voordat je een oordeel geeft.

Onderzoek behoud van bestaande functies en opslag, mobiele navigatie, PWA en HA/MEATER. Noem per bevinding **BLOCKER / HOOG / MIDDEL / LAAG**, bestand/regel, reproduceerbaar bewijs, risico en kleinste veilige correctie. Geef een eindoordeel **GO / GO MET OPMERKINGEN / NO-GO**, uitgesplitst naar eigen tests, geverifieerde GitHub CI en open fysieke testen. Plaats de review als commentaar in de PR.

**Meld expliciet welke bronnen (CI-runs, PR-tekst, GitHub-instellingen of bestanden) niet bereikbaar waren of niet konden worden gecontroleerd.** Trek daaruit geen aannames over testdekking of bescherming.

Geen ongevraagde commits, merges, tags of releases; een GO is geen gebruikersakkoord. De regisseur en de bouwer (Claude Code) synchroniseren niet automatisch; ze werken via de PR op GitHub.
