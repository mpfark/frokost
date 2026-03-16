

## Plan: Filtrér interne kollegaer fra gæstetilmelding til frokost

### Problem
Når man tilføjer mødedeltagere som gæster til frokost, tælles kollegaer med @pluskontoret.dk også med — men de har allerede selv tilmeldt sig frokost via appen.

### Løsning
Udvid kalender-dataen fra Microsoft Graph med en liste af deltagernes e-mails, så frontend kan beregne hvor mange der er *eksterne* gæster (ikke fra virksomhedens domæne).

### Ændringer

**1. Edge functions: Returnér attendee-emails**
- `get-calendar-events/index.ts` og `get-room-calendars/index.ts`: Tilføj et nyt felt `attendeeEmails: string[]` med e-mails for ikke-resource deltagere. Behold `attendeeCount` uændret (bruges til forplejning generelt).

**2. Types: Udvid CalendarEvent**
- `src/components/catering/types.ts`: Tilføj `attendeeEmails?: string[]` til `CalendarEvent`.

**3. CateringOrderDialog: Beregn eksterne gæster**
- Hent `allowed_domain` fra `company_settings` (allerede tilgængeligt eller via en simpel query).
- Beregn `externalGuestCount` = antal deltagere hvis e-mail *ikke* ender på `@{allowed_domain}` (minus bestilleren selv).
- Brug dette tal i teksten under "Tilføj gæsterne til dagens frokost" og i `addGuestsToLunch`-kaldet.
- Vis tydeligt: "X eksterne gæster tilmeldes frokost (Y kollegaer fra @pluskontoret.dk er fraregnet)".

### Tekniske detaljer
- Microsoft Graph returnerer allerede `attendees[].emailAddress.address` — vi skal bare mappe det ud.
- Domænet hentes fra `company_settings.allowed_domain` via en enkelt SELECT.
- Ingen database-migration nødvendig.
- `attendeeCount` (til forplejning/antal personer) forbliver uændret — det er kun gæste-frokost-logikken der filtrerer.

