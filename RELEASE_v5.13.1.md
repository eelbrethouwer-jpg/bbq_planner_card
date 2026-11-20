# BBQ Planner v5.13.1 — planningsmeldingen werken vanzelf bij

**Status: gepubliceerd via release.yml.** Releaseakkoord van de eigenaar op 20 november 2026 (in de chat met de regisseur: "Graag en daarna mergen en publiceren je hebt mijn akkoord", na het afmaken van PR #59). Deze release bevat ook v5.11.0 (receptgenerator, PR #55), v5.12.0 (geen pop-up-dialogen, PR #56), v5.12.1 (paneel in beeld, PR #57) en v5.13.0 (meer BBQ Junkie-recepten, PR #58); die zijn niet apart gepubliceerd. Zie de bestanden RELEASE_v5.11.0.md t/m RELEASE_v5.13.0.md voor de details.

## Wat verandert er?
De meldingen "Je begint later dan gepland" (met de knop "Plan opnieuw vanaf nu"), "Voorbereiding al voorbij" en de rode urgente conflicten in stap 2 werden alleen bijgewerkt als je zelf iets deed. Nu verschijnen en verdwijnen ze vanzelf terwijl de planner open staat: elke 30 seconden controleert de app de klok. Het scherm wordt daarbij niet opnieuw opgebouwd: alleen de melding zelf verandert, en alleen als de inhoud anders is. Wat je aan het typen bent, een open bevestiging, je plek op de pagina en de uitklapstatus blijven zoals ze zijn.

Er wordt niets bijgewerkt als het tabblad verborgen is; zodra je terugkomt klopt de melding weer. Een open voorstel "Plan opnieuw vanaf nu" blijft staan tot je bevestigt of annuleert; de nieuwe serveertijd wordt op het moment van je tik opnieuw berekend.

## Je gegevens
Geen nieuwe opslagvelden of -sleutels en geen wijziging van opgeslagen gegevens. De app past de planning nooit zelf aan: opnieuw plannen blijft een tik met bevestiging.

## Nog niet in de praktijk getest
Niet getest op een echte iPhone, in de Home Assistant-app of met een echte MEATER. Het gedrag is getest met een nagebootste klok in Chromium en WebKit (CI).

Projectinformatie: [PROJECT_STATUS.md](https://github.com/eelbrethouwer-jpg/bbq_planner_card/blob/main/PROJECT_STATUS.md).

Publicatie: goedgekeurd door de eigenaar op 2026-11-20
