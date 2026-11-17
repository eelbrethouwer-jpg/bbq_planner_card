# BBQ Planner — instructies voor Claude Code (bouwer)

Claude Code is de bouwer in dit project. Claude in de chat is regisseur en onafhankelijke reviewer. De gebruiker is eigenaar en beslist over merge en release.

1. Lees [PROJECT_STATUS.md](PROJECT_STATUS.md), [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md), [CLAUDE.md](CLAUDE.md) en de [PR-template](.github/PULL_REQUEST_TEMPLATE.md).
2. Controleer live de `main`-SHA, de nieuwste release/tag, open PR's, CI op de relevante commit en de broncode. De projectstatus is een momentopname; GitHub is leidend.
3. Werk per PR in een eigen branch vanaf de gecontroleerde `main`-SHA. Push nooit direct naar `main`. Bundel geen meerdere PR's in één branch.
4. Behoud de bestaande app-engine, opslag, localStorage-sleutels, recepten, reviews en MEATER/HA-functies. Een nieuw optioneel veld mag alleen met terugval voor oude data en een expliciete melding in de PR.
5. Draai de bestaande tests en voeg regressietests toe. Meld welke tests je zelf draaide en welke niet. Toon nooit nep-LIVE-data in de UI; gebruik in tests alleen duidelijk gemarkeerde fixtures.
6. Open een **draft-PR**, vul de PR-template volledig in en meld de link aan de gebruiker. Stop daarna en wacht op de review van de regisseur.
7. Verwerk reviewpunten op dezelfde branch en reageer per punt in de PR met de commit-SHA die het oplost.
8. Merge, tag of release nooit zelf. Voeg geen `release-*-once.yml`-workflows toe tenzij de gebruiker daarom vraagt. Claim geen echte iPhone-, Home Assistant- of MEATER-test zonder uitvoering.

De regisseur en de bouwer synchroniseren niet automatisch; ze werken via de PR op GitHub. De centrale werkwijze staat in [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md).
