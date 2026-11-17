# BBQ Planner v5.6.0 — meldingen op je telefoon

**Status: draft-PR, nog niet goedgekeurd en niet gepubliceerd.** De goedkeuringsregel volgt pas na een expliciet releaseakkoord van de eigenaar.

## Wat verandert er?
Kook je met de planner in de Home Assistant-app, dan kan je telefoon je nu waarschuwen. Dat gaat via de Home Assistant Companion-app (`notify.mobile_app_…`).

- **Je telefoon wordt automatisch gevonden.** In stap 2 en op Live staat één regel: *Meldingen op je telefoon: [jouw telefoon] · aan/uit*. Heb je één telefoon met de Home Assistant-app en heb je nog niets gekozen, dan staan meldingen voor die telefoon **automatisch aan**. Dat staat er zichtbaar bij en je zet het met één tik uit. Heb je meer telefoons of tablets, dan kies je er zelf een; zonder keuze komen er geen meldingen.
- **Stuur testmelding**: één knop om te controleren of de melding aankomt.
- **Wanneer krijg je een melding?** Elk moment hooguit één keer per gerecht:
  - de kamado aansteken ("Steek nu de grote kamado aan (Ribeye om 17:12 erop)");
  - een gerecht op de BBQ leggen, op de geplande of aangepaste tijd;
  - het fasedoel bij reverse sear ("Ribeye 47 °C — stook op naar ~250 °C");
  - 5 minuten voor het einddoel volgens de schatting, en bij het bereiken van het doel;
  - een stall;
  - de rusttijd is voorbij: serveren;
  - de meting is weg: de MEATER geeft al 3 minuten niets door terwijl het gerecht op de BBQ ligt.
- Op een iPhone komen de tijdkritische meldingen binnen als **tijdgevoelig** (ze komen ook door een Focus-stand heen, als je dat in iOS toestaat). De stall-melding is een gewone melding.
- Op de publieke website verandert er niets: daar zijn geen meldingen.

## Belangrijk: alleen zolang de planner open is
Meldingen gaan **alleen af zolang de planner open is in de Home Assistant-app**. Live houdt het scherm aan (Wake Lock). Sluit je de app of gaat de telefoon op slot, dan komen er geen meldingen. Een automatisering in Home Assistant die ook werkt als de app dicht is, staat op de lijst voor later.

## Je gegevens
Je recepten, reviews, planningen en opgeslagen gegevens blijven zoals ze zijn. De keuze voor meldingen staat in de bestaande instellingen van de planner (dezelfde velden als de oude instelling onder Meer). Er is geen nieuw opslagveld. Hadden je meldingen al uit- of aangezet, dan blijft die keuze gelden.

## Bijwerken via HACS
1. Open in Home Assistant **HACS**, kies **BBQ Bereidingsplanner + MEATER** en kies **Bijwerken** (of **Opnieuw downloaden**).
2. Ververs daarna de Home Assistant-app of de pagina. Zie je de oude versie nog, sluit de app dan helemaal af en open hem opnieuw.
3. Ga naar stap 2 en tik op **Stuur testmelding**.

## Nog niet in de praktijk getest
Dit is **niet getest op een echte iPhone** met de Home Assistant-app en ook niet met een echte MEATER. De automatische tests bootsen Home Assistant, de telefoon en de metingen na. Controleer zelf of de testmelding aankomt, of hij als tijdgevoelig binnenkomt en of de naam van je telefoon klopt.

Projectinformatie: [PROJECT_STATUS.md](https://github.com/eelbrethouwer-jpg/bbq_planner_card/blob/main/PROJECT_STATUS.md).
