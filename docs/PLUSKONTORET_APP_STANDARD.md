# Pluskontoret App Standard

## Formål

Denne standard beskriver fælles principper for Pluskontorets interne webapplikationer.

Den gælder blandt andet:

- Frokost
- IT-hjælp
- fremtidige mindre interne værktøjer

Apps må have vidt forskellige funktioner, men skal opleves som dele af samme interne digitale miljø.

Standarden dækker:

- visuel identitet
- navigation
- komponenter
- login
- brugeridentitet
- sprog
- interaktionsmønstre
- sikkerhed

Produkt-specifik forretningslogik hører til i den enkelte apps `PRODUCT_INTENT.md`.

## Fælles identitet

En medarbejder skal kunne genkende en Pluskontoret-app med det samme.

Apps bør derfor dele:

- typografi
- farveprincipper
- knapdesign
- formularstil
- cards
- dialoger
- spacing
- ikoner
- navigation
- login-side
- fejl- og succesbeskeder

Apps behøver ikke have identisk navigation eller informationsarkitektur.

Fælles design betyder konsistens, ikke at funktionerne skal organiseres ens.

## Navngivning

Appnavnet skal fremgå tydeligt.

Eksempler:

- Plusfrokost
- Pluskontoret IT-hjælp

Pluskontoret-navnet må gerne bruges som afsenderidentitet, men produktnavnet skal være det primære element i brugerens daglige navigation.

## Layout

Desktopindhold bør som udgangspunkt centreres i en begrænset indholdsbredde frem for at fylde hele skærmen.

Typiske bredder:

- almindeligt indhold: ca. 900–1100 px
- brede tabeller/kalendere: ca. 1200–1400 px
- formularer: ca. 400–700 px

Brug god luft mellem sektioner.

Undgå meget tætte administrationsinterfaces med mange samtidige kontroller.

## Navigation

Primære områder skal være let tilgængelige.

Desktop:

- simpel topnavigation eller tilsvarende
- ikon + tekst, når pladsen tillader det

Mobil:

- navigation skal være brugbar uden hover
- kritiske handlinger må ikke være skjult bag komplekse menuer

Aktivt område skal kunne identificeres visuelt.

Undgå mere end ét primært navigationsniveau, medmindre produktets kompleksitet kræver det.

## Komponenter

Genbrug samme grundkomponenter mellem apps, hvor det giver mening.

Det gælder især:

- Button
- Input
- Select
- Checkbox
- Switch
- Card
- Dialog
- AlertDialog
- Tabs
- Badge
- Tooltip
- Toast
- Skeleton
- Date picker
- Dropdown menu

Apps bør så vidt muligt bruge samme shadcn/Radix-baserede komponentstil.

## Knapper

### Primær handling

Brug én tydelig primær handling pr. kontekst.

Eksempler:

- Opret sag
- Gem
- Tilmeld
- Bestil forplejning

### Sekundær handling

Brug outline eller neutral styling.

Eksempler:

- Annuller
- Luk
- Tilbage

### Destruktiv handling

Handlinger som:

- Slet
- Annuller bestilling
- Fjern bruger

skal være tydeligt destruktive og kræve bekræftelse, når handlingen har væsentlige konsekvenser.

## Formularer

Formularer skal være korte og konkrete.

Undgå at spørge brugeren om information, systemet allerede kender.

Eksempler:

- brugerens identitet kommer fra login
- mødedata kommer fra Microsoft 365
- dato/tid bør genbruges fra eksisterende kontekst
- medarbejderinformation bør komme fra fælles brugerdata

Validering bør ske så tidligt som muligt.

Fejl skal beskrive:

1. hvad der gik galt
2. hvad brugeren kan gøre

## Feedback

Alle handlinger med mærkbar ventetid skal vise loading-state.

Efter en handling skal brugeren tydeligt kunne forstå resultatet.

Brug eksempelvis:

- toast ved mindre handlinger
- inline feedback ved formularfejl
- dialog ved handlinger med store konsekvenser

Undgå tekniske fejlbeskeder som:

- HTTP 500
- PGRST116
- Graph API error

i det almindelige UI.

Tekniske detaljer må logges separat.

## Sprog

Apps skal som udgangspunkt være på dansk.

Sproget skal være:

- kort
- konkret
- professionelt
- uformelt nok til intern brug

Undgå unødvendig teknisk terminologi.

## Ikoner

Brug primært samme ikonbibliotek på tværs af apps.

Aktuel anbefaling:

Lucide Icons.

Ikoner skal understøtte tekst og forståelse.

Vigtige handlinger bør ikke være afhængige af et ikon alene, medmindre betydningen er helt entydig.

## Farver

Apps skal bruge et fælles Pluskontoret-designsystem.

Farver bør defineres som design tokens/CSS variables frem for direkte værdier spredt gennem komponenterne.

Eksempel:

- `--primary`
- `--primary-foreground`
- `--secondary`
- `--muted`
- `--accent`
- `--destructive`
- `--background`
- `--foreground`
- `--border`

Farverne er faste og defineres som CSS-tokens i hver app: Frokost bruger grønne nuancer, og IT-hjælp bruger blå. Farver kan ikke ændres i administrationen.

Apps deler layout og komponentmønstre, mens grøn og blå giver hver app sin egen identitet.

## Typografi

Brug samme font og samme typografiske skala på tværs af apps.

Definér faste niveauer for:

- appnavn
- sidetitel
- sektionsoverskrift
- brødtekst
- hjælpetekst
- labels

Undgå tilfældige fontstørrelser i enkeltkomponenter.

## Responsivt design

Alle medarbejdervendte funktioner skal fungere på:

- desktop
- tablet
- mobil

Administrationsfunktioner må være desktop-first, hvis arbejdsprocessen reelt kræver større skærm.

Vigtige brugerflows skal altid fungere på mobil.

## Login

Pluskontorets interne apps skal så vidt muligt have samme loginoplevelse.

Den ønskede standard er Microsoft 365-login.

Brugeren skal genkende loginoplevelsen på tværs af apps.

Foretrukket flow:

1. Åbn Pluskontoret-app.
2. Ikke logget ind.
3. Vis enkel Pluskontoret-login-side.
4. “Log ind med Microsoft”.
5. Microsoft Entra ID håndterer identiteten.
6. Appen kontrollerer efterfølgende, om brugeren har adgang.

Der bør ikke etableres separate passwords i hver app.

## Adgang er ikke det samme som Microsoft-login

At en person kan autentificere sig med Microsoft betyder ikke automatisk, at personen skal have adgang til en app.

Hver app skal efter login kontrollere adgang ud fra sin autoriserede brugerbase.

Eksempel:

Microsoft identificerer:

`navn@pluskontoret.dk`

Derefter kontrollerer appen:

- findes brugeren?
- er brugeren aktiv?
- har brugeren adgang til denne app?
- hvilken rolle har brugeren?

## Fælles brugeridentitet

Apps bør på sigt anvende samme princip for Pluskontorets medarbejderidentitet.

En medarbejder bør ikke være konceptuelt forskellige brugere i:

- Frokost
- IT-hjælp
- andre interne apps

Den tekniske implementering kan være separate databaser, men identiteten bør baseres på et stabilt Microsoft-id og/eller virksomhedens medarbejderkilde.

E-mail må gerne bruges som visnings- og kommunikationsfelt, men bør ikke nødvendigvis være den eneste permanente identifikator.

## Roller og rettigheder

Roller skal være appspecifikke.

Eksempel:

Frokost:

- user
- kitchen
- admin

IT-hjælp:

- employee
- IT
- admin

Undgå at skabe ét stort globalt rollesystem, hvis apps har forskellige behov.

Den fælles del bør være identiteten.

## Sikkerhed

Alle apps skal følge disse principper:

- adgang kontrolleres server-side
- databaseadgang begrænses
- secrets må ikke ligge i frontend
- filer må ikke blive offentlige ved et uheld
- interne administratorfelter må ikke være tilgængelige for almindelige brugere
- UI-skjulning må aldrig være eneste sikkerhedslag

## Deling af kode

Fælles udseende betyder ikke nødvendigvis ét fælles repository.

Start med fælles dokumenterede designregler og komponentprincipper.

Hvis Frokost og IT-hjælp senere får mange identiske komponenter, kan et fælles komponentbibliotek overvejes.

Undgå at oprette et fælles bibliotek, før der er et konkret behov.

## Produkt-specifik frihed

Fælles standard må ikke tvinge apps ind i samme funktionelle struktur.

Eksempel:

Frokost er kalender- og dato-orienteret.

IT-hjælp er sag-/ticket-orienteret.

Det er derfor naturligt, at deres hovedvisninger er forskellige.

Det fælles bør være:

- look and feel
- login
- interaktionsprincipper
- komponenter
- terminologi hvor relevant

ikke selve produktstrukturen.

## Før designændringer

Ved større UI-ændringer skal følgende kontrolleres:

1. Er løsningen konsistent med de andre Pluskontoret-apps?
2. Kan en eksisterende fælles komponent genbruges?
3. Er loginoplevelsen stadig ens?
4. Er mobiloplevelsen acceptabel?
5. Introducerer løsningen et nyt mønster uden nødvendighed?
6. Er appens egne funktionelle behov vigtigere end kunstig visuel ensartethed?

Målet er en familie af apps, ikke én app forklædt som flere.
