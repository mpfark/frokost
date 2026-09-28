# Frokost – Product Intent

## Formål

Frokost er Pluskontorets interne applikation til håndtering af:

- daglig frokosttilmelding
- fravær fra frokost
- gæster og kosthensyn
- køkkenets overblik
- bestilling af forplejning til møder
- kobling mellem forplejning og Microsoft 365-kalendere

Appens formål er at gøre disse daglige arbejdsprocesser så enkle som muligt for medarbejdere og køkken.

Frokost er ikke et generelt SaaS-produkt og skal ikke længere designes til flere virksomheder.

## Produktprincipper

### Kun Pluskontoret

Frokost er en intern Pluskontoret-applikation.

Arkitekturen skal optimeres til Pluskontorets behov frem for generiske multi-tenant- eller SaaS-scenarier.

Funktionalitet, abstraktioner og datamodeller, der kun findes for at understøtte flere virksomheder, bør som udgangspunkt fjernes, når det kan ske sikkert.

Undgå at introducere nye:

- tenants
- company abstractions
- customer-specific configurations
- white-label funktioner
- generiske SaaS-lag

medmindre et konkret Pluskontoret-behov kræver det.

### Enkel brugeroplevelse

Medarbejderen skal ikke behøve forstå de systemer, integrationer eller datamodeller, der ligger bag appen.

En almindelig handling skal kræve så få trin som muligt.

Kompleksitet skal så vidt muligt ligge i systemet og ikke hos brugeren.

## Frokost

Medarbejdere skal kunne:

- tilmelde sig frokost på enkelte dage
- framelde sig
- ændre deres valg
- registrere gæster
- registrere relevante kosthensyn

Systemet skal tydeligt kunne skelne mellem:

- tilmeldt
- aktivt frameldt
- endnu ikke taget stilling

## Fravær

Fravær er ikke et HR-system.

Funktionen eksisterer alene for at gøre det nemt at framelde sig frokost over en sammenhængende periode.

Ved registrering af fravær må systemet automatisk:

- oprette frameldinger på relevante hverdage
- ignorere lukkede dage
- fjerne eksisterende frokosttilmeldinger på de pågældende dage

Fravær skal ikke udvikle sig til ferieadministration, tidsregistrering eller personaleadministration.

## Køkken

Køkkenet skal have et enkelt operationelt overblik.

Køkkenet skal kunne se det, der er nødvendigt for at planlægge den daglige drift, herunder:

- antal deltagere
- gæster
- kosthensyn
- relevante afvigelser
- forplejningsbestillinger
- ændringer og annulleringer

Køkkenet skal ikke behøve navigere i tekniske detaljer omkring Microsoft Graph, brugerkonti eller andre integrationer.

## Forplejning

Forplejning er et fælles arbejdsredskab.

Alle relevante medarbejdere må kunne oprette, ændre og annullere forplejning til:

- egne møder
- andre medarbejderes møder

Dette er tilsigtet funktionalitet.

Systemet må ikke ændres til en model, hvor kun:

- mødearrangøren
- kalenderens ejer
- den oprindelige bestiller

kan administrere forplejningen.

Rettighedskontroller må gerne sikre, at brugeren er en gyldig Pluskontoret-bruger, men de må ikke utilsigtet begrænse samarbejdet omkring forplejning.

## Microsoft 365 og kalender

Microsoft 365-integrationen skal gøre kalenderen til en praktisk datakilde for forplejning.

Brugeren skal så vidt muligt ikke indtaste information, som allerede findes i Outlook.

Dette inkluderer eksempelvis:

- mødetitel
- tidspunkt
- dato
- lokale

Systemet skal kunne reagere på efterfølgende ændringer i mødet.

### Kalenderændringer

Eksisterende intention skal bevares:

#### Ændret dato eller tidspunkt

En eksisterende forplejningsbestilling kan annulleres.

Brugeren skal informeres om, at forplejningen skal bestilles igen til det nye tidspunkt.

#### Ændret lokale

Leveringsstedet kan opdateres automatisk.

Den eksisterende bestilling skal som udgangspunkt bevares.

#### Ændret mødetitel

Titlen kan opdateres uden at annullere bestillingen.

#### Slettet eller annulleret møde

Forplejningsbestillingen kan annulleres automatisk, når systemet med tilstrækkelig sikkerhed kan fastslå, at mødet er slettet eller annulleret.

### Konservativ automatik

Kalenderautomatik skal være konservativ.

Hvis systemet ikke med tilstrækkelig sikkerhed kan afgøre, hvad der er sket med et møde, skal det bevare forplejningsbestillingen og forsøge igen senere.

Eksempler på ting, der ikke i sig selv må tolkes som et slettet møde:

- Microsoft Graph-fejl
- timeout
- manglende adgang
- ufuldstændige kalenderdata
- midlertidigt manglende event
- ukendt mødeidentitet

Det er bedre at kræve manuel afklaring end at annullere gyldig forplejning fejlagtigt.

## Brugere og identitet

Pluskontorets medarbejderbase skal være den centrale kilde til, hvem der må bruge appen.

Webflow bruges aktuelt som kilde til aktive medarbejdere.

Systemet skal kunne:

- opdage nye medarbejdere
- aktivere relevante brugere
- opdatere navn og e-mail
- deaktivere medarbejdere, der ikke længere er aktive

Brugerdata skal ikke duplikeres unødigt mellem systemer.

## Login

Den ønskede retning er Microsoft-login.

Loginoplevelsen skal på sigt være den samme på tværs af Pluskontorets interne apps.

Brugere skal kunne identificeres via deres Microsoft 365-konto uden separate passwords til hver intern app.

Frokost må fortsat have separat Microsoft-kalenderautorisation, hvis ekstra Microsoft Graph-rettigheder kræver dette.

Login og kalenderadgang skal ikke blandes sammen, hvis de sikkerhedsmæssigt eller teknisk har forskellige scopes.

## Administration

Administration skal fokusere på daglig drift.

Administratorer skal kunne håndtere relevante ting som:

- brugere
- roller
- køkkenadgang
- frokostindstillinger
- lukkede dage
- påmindelser
- relevante integrationer

Administration skal ikke udvikle sig til generisk SaaS-administration.

## Notifikationer

Notifikationer skal bruges, når de hjælper brugeren med at handle.

Undgå notifikationer, der blot fortæller, at systemet har gjort noget uvæsentligt.

Særligt vigtige hændelser omfatter:

- ændret eller annulleret forplejning
- handlinger som kræver ny bestilling
- relevante køkkenændringer
- frokostpåmindelser

## Sikkerhed

Sikkerhed og adgangskontrol skal håndhæves server-side og i databasen.

UI-skjulning er ikke adgangskontrol.

Særligt følsomme data som:

- Microsoft tokens
- service credentials
- API secrets

må aldrig være tilgængelige fra browseren.

## Teknisk retning

Foretræk:

- simple løsninger
- tydelig feature-opdeling
- små komponenter
- genbrug af relevante fælles funktioner
- test af kritiske workflows
- direkte datamodeller der afspejler det faktiske produkt

Undgå:

- unødvendige abstraktionslag
- fremtidssikring mod hypotetiske kundebehov
- generiske framework-lag uden konkret behov
- store komponenter med både UI, dataadgang og forretningslogik samlet

## Non-goals

Frokost skal ikke udvikle sig til:

- HR-system
- ferieadministrationssystem
- kalenderapplikation
- generelt mødebookingsystem
- catering-SaaS
- medarbejderportal
- CRM
- generisk multi-tenant-platform

Appen må integrere med disse områder, når integrationen direkte understøtter frokost eller forplejning.

## Før større ændringer

Før større funktionelle eller arkitekturmæssige ændringer skal denne fil læses.

Spørg:

1. Gør ændringen Frokost enklere eller mere kompleks?
2. Løser den et reelt Pluskontoret-behov?
3. Bevarer den de eksisterende kerneflows?
4. Introducerer den SaaS- eller multi-tenant-kompleksitet uden et konkret behov?
5. Ændrer den utilsigtet samarbejdsmodellen omkring forplejning?
6. Kan samme resultat opnås med en enklere løsning?

Hvis implementeringen og denne produktintention er i konflikt, skal produktintentionen som udgangspunkt styre retningen.

## Note til fremtidigt Codex-arbejde

Dette dokument er autoritativt for produktintentionen. Hvis eksisterende implementering er i konflikt med intentionen, skal konflikten fremhæves før større ændringer. Codex må ikke stille og roligt “rette” tilsigtet produktadfærd ud fra generelle best practices.
I Frokost gælder det særligt, at medarbejdere tilsigtet kan administrere forplejning til andres møder.
