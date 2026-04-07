

## Plan: Ret tidszone-forskydning på mødetider

### Problem
Microsoft Graph API returnerer mødetider i UTC som standard. Frontend'en parser disse tider med `parseISO()` som om de var lokal tid (dansk tid). Danmark er UTC+2 om sommeren (CEST), hvilket forklarer præcis de 2 timers forskydning.

### Løsning
Tilføj `Prefer: outlook.timezone="Europe/Copenhagen"` headeren til alle Graph API-kald. Dermed returnerer Microsoft tiderne direkte i dansk tid, og frontend'ens `parseISO` vil vise korrekt.

### Filer der ændres

**1. `supabase/functions/get-calendar-events/index.ts`**
- Tilføj `Prefer: outlook.timezone="Europe/Copenhagen"` header til Graph API fetch-kaldet (linje 158)

**2. `supabase/functions/get-room-calendars/index.ts`**
- Tilføj samme `Prefer` header til Graph API fetch-kaldet for hvert rum (linje 109)

**3. `supabase/functions/calendar-webhook/index.ts`**
- Tilføj samme `Prefer` header til eventuelle Graph API kald der henter mødedetaljer, så webhook-synkronisering også bruger korrekt tid

Ingen database-ændringer. Ingen frontend-ændringer nødvendige.

