# Kalenderændringer og forplejning

## Aftalt adfærd

- Alle eksisterende muligheder for at bestille, redigere og annullere på andres møder bevares. Adgangsreglerne for `catering_orders` er ikke ændret.
- Ændret dato, starttid eller sluttid annullerer bestillingen. Bestilleren og køkkenet får besked med gammel og ny tid og besked om at bestille igen.
- Nyt lokale opdaterer leveringsstedet og giver besked til bestiller og køkken. Status og eksisterende bekræftelse bevares.
- Ny titel opdaterer titlen uden annullering eller ekstra notifikation.
- Bekræftet sletning eller annullering i arrangørens kalender annullerer bestillingen og giver besked.
- Fejl, ufuldstændige svar og ukendt mødeidentitet bevarer bestillingen til en senere kontrol.

## Implementering

Browseren annullerer ikke længere ud fra den viste uge eller brugerens egen kalender. `calendar-webhook` og `reconcile-room-bookings` bruger samme funktion i `_shared/calendar-reconciliation.ts`.

Første vellykkede kontrol finder mødet via iCalUId i de konfigurerede lokalekalendere, finder det tilsvarende møde i arrangørens kalender og gemmer arrangørens mailbox samt et Graph ImmutableId i en servicebeskyttet tabel. Bestillerens bruger-id bruges ikke til at vælge kalender. Nye bestillinger starter en kontrol efter gemning.

Efter denne etablering hentes mødet direkte via det gemte id. Det understøtter flytning uden for den viste uge og ændring/fjernelse af lokalets invitation. Alle sider af kalenderresultater hentes. Kun `ErrorItemNotFound` kombineret med en tilgængelig arrangørkalender behandles som sletning.

Den nye databasefunktion låser bestillingen og kontrollerer dens tidligere ændringstid. Ændring og notifikationer gemmes i samme transaktion. En parallel eller gentaget kontrol med en gammel version afvises. Eksisterende manuel notifikationslogik bevares; den generiske køkkennotifikation undertrykkes kun inde i kalendertransaktionen. Eksisterende trigger rydder fortsat bestillingens tilknyttede gæster ved annullering.

## Forudsætninger og kendte begrænsninger

1. Microsoft-appens eksisterende app-adgang skal kunne læse relevante arrangørkalendere, ikke kun lokalernes kalendere. Dette er **ikke verificeret mod produktion**. Ved manglende adgang bevares bestillinger, og resultatet tæller dem som `skipped`.
2. Gamle bestillinger skal gennem en første vellykket kontrol, mens mødet kan identificeres. Bestillinger uden iCalUId, møder som allerede er forsvundet, eksterne/utilgængelige arrangører og møder uden for konfigurerede lokaler kan kræve manuel afklaring. Der gættes ikke på identitet ud fra titel.
3. En sletning før den første vellykkede kobling kan ikke bekræftes automatisk. En lokalekalender alene kan ikke afgøre, om mødet blev slettet eller blot flyttet til et andet lokale.
4. Webhookabonnementer skal have gemt `client_state`, som matcher Microsofts besked. Gamle abonnementer uden denne værdi skal fornyes; den eksisterende planlagte afstemning fungerer uafhængigt af webhooken.
5. Webhookkontrollen udføres i den eksisterende synkrone serverfunktion. Ved store kalendere kan købaseret behandling blive nødvendig. Fejl må ikke bruges som bevis for sletning, og den planlagte kontrol skal fortsat være aktiv.
6. Start- og sluttider sammenlignes som dansk lokaltid. Ændrede datoer på annullerede bestillinger overskriver ikke den historiske bestillingsdato.

## Udgivelse i Lovable Cloud

Dette er kode og en migration; en GitHub-synkronisering alene dokumenterer ikke, at backend er opdateret.

1. Tag en databasebackup, og kontrollér Microsoft-adgangen i et testmiljø med en repræsentativ arrangør.
2. Kør `20260922120000_calendar_reconciliation.sql` i testmiljøet.
3. Udgiv **begge** serverfunktioner `calendar-webhook` og `reconcile-room-bookings` med den fælles hjælpefil. De gamle implementationer må ikke fortsat køre som alternative annulleringsveje.
4. Udgiv brugerfladen. Ved produktionsskift bør automatiske kontroller pauses under backendopdateringen og genaktiveres efter, at begge funktioner er opdateret.
5. Etabler koblinger for eksisterende aktive bestillinger med afstemning i relevante datointervaller. Gennemgå `skipped` og serverlog frem for at antage, at alle bestillinger er dækket.
6. Kontrollér: én bruger bestiller til en andens møde; arrangøren flytter tid; bestilleren og køkkenet får hver én besked. Gentag kontrollen og verificér ingen dubletter. Gentag med lokaleskift, titelændring, sletning, gentaget møde og kalenderfejl.

Ingen produktionsændringer, Azure-tilladelser eller Lovable-udgivelser er udført som del af kodearbejdet.

## Lokale tests

Kræver Node 22.18+ eller Node 24:

```sh
node --test --test-isolation=none tests/calendar-reconciliation.test.ts
```

Databasetesten bruger rigtig PostgreSQL-funktionalitet gennem PGlite på en isoleret testdatabase. Installer `@electric-sql/pglite` i et særskilt testmiljø; sæt om nødvendigt `PGLITE_TEST_PACKAGE` til dette miljøs absolutte `package.json`-sti:

```sh
node tests/calendar-database.test.mjs
```

Testen bruger de relevante eksisterende migrationer for køkkennotifikationer og gæsteoprydning sammen med den nye migration. Den er ikke en fuld installation af produktionsdatabasen.

Kontrolleret lokalt: 14 kodeprøver, databaseprøver for annullering, lokaleskift, notifikationer, gentagne kald, rollback og funktionsrettigheder; frontend-typekontrol og separat typekontrol af serverfilerne. Produktionsbygning køres med auditmiljøets eksisterende afhængigheder; repositoryets allerede kendte låsefilproblem er ikke rettet her.
