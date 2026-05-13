## Mål

Annullér automatisk en `catering_orders`-bestilling når det tilhørende møde ikke længere findes i det konfigurerede mødelokales kalender — uafhængigt af hvem der ejer bestillingen, og uden at vente på at ejeren åbner appen.

## Ny edge function: `reconcile-room-bookings`

Placering: `supabase/functions/reconcile-room-bookings/index.ts`

**Input** (POST body, alle felter valgfri):
- `weekStart` (ISO date) — default: i dag (Europe/Copenhagen)
- `daysAhead` (number) — default: 14

**Auth:**
- Kan kaldes på to måder:
  1. Med `Authorization: Bearer <CRON_SECRET>` (cron)
  2. Med almindelig user-JWT (klient fra "Mødelokaler"-fanen). Validér JWT i kode og kræv at brugeren er authenticated; ingen rolle-krav, da operationen kun annullerer ordrer på lokaler vi har sandhed om.

**Flow:**
1. Hent `resource_room_emails` fra `company_settings`.
2. Hent app-token (`getAppToken`) og hent `displayName` for hvert konfigureret rum via `/v1.0/places/microsoft.graph.room`. Byg map: `email → displayName`.
3. For hvert rum: hent `/v1.0/users/{email}/calendarView?startDateTime=…&endDateTime=…&$select=subject,start,end,iCalUId,isAllDay`. Filtrér `isAllDay=false`. Saml `iCalUId`-set + `(subject|date|time)`-key-set per rum og samlet på tværs.
4. Hent alle aktive `catering_orders` (status `pending` eller `confirmed`) i datointervallet via service role.
5. **Filtrér til kun ordrer hvis `meeting_location` matcher et konfigureret rums displayName** (case-insensitive `includes` begge veje, samme regel som `calendar-webhook`). Andre ordrer røres ikke.
6. For hver matchet ordre:
   - Hvis `meeting_external_id` er sat: marker som "lever" hvis dens `iCalUId` findes i mindst ét rums event-set. Ellers orphan.
   - Hvis `meeting_external_id` er null: matchning på `(subject|date|time)`-key i det/de matchende rum.
7. Annullér orphans med service role: `update({ status: 'cancelled' })` på id'erne. Den eksisterende trigger `notify_kitchen_on_catering_change` sender automatisk køkkenets/ejerens notifikationer.
8. Returnér `{ checked: N, cancelled: M, cancelled_ids: [...] }`.

**Fejlhåndtering:** Generiske fejl ud (per security memory). Log detaljer server-side. Spring rum over hvis Graph fejler for det specifikke rum, men fortsæt resten.

**Sikkerhed:** Annullerer aldrig ordrer hvor `meeting_location` ikke matcher et konfigureret rum — dvs. møder bestilt på "Eksternt" eller andre lokaler er beskyttet.

## Cron job (hver 15. min)

Tilføjes via `supabase--insert` (ikke migration, da URL/anon key er projektspecifikke):

```sql
select cron.schedule(
  'reconcile-room-bookings-15min',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := 'https://gupglbmayvwwxwkunotk.supabase.co/functions/v1/reconcile-room-bookings',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select setting_value from public.cron_settings where setting_key = 'cron_secret')
      ),
      body := '{}'::jsonb
    );
  $$
);
```

(CRON_SECRET findes allerede i secrets; sikrer at endpointet kun kan trigges automatisk uden user-JWT.)

## Klient-trigger ved fane-åbning

`src/components/catering/RoomCalendarsView.tsx`:
- I `fetchRoomCalendars` (efter rum-events er hentet og vist), kald `supabase.functions.invoke("reconcile-room-bookings", { body: {} })` "fire-and-forget".
- Når reconciliation returnerer `cancelled > 0`: kald `fetchExistingOrders()` så banner-status (orange/grøn pille) i `WeekDayGrid` opdateres uden refresh.
- Ingen toast — stille oprydning.

## Filer der ændres / oprettes

- **Ny:** `supabase/functions/reconcile-room-bookings/index.ts`
- **Ændret:** `src/components/catering/RoomCalendarsView.tsx` (kald reconciliation efter fetch + reload orders)
- **Ny cron-schedule** via `supabase--insert`

## Hvad der ikke ændres

- `calendar-webhook` beholdes som hurtig sti for ejerens egne ændringer.
- `OutlookCalendar` "Dine møder" beholder sin `autoCancelOrphanedOrders`.
- Eksisterende notifikationstriggere håndterer al brugerkommunikation når status går til `cancelled`.

## Edge cases

- **Tidszone:** sammenlign datoer/tider med samme `Prefer: outlook.timezone="Europe/Copenhagen"` header som `calendar-webhook` bruger.
- **Rum uden bookings i intervallet:** Graph returnerer tom liste → ordrer i det rum bliver orphans → korrekt adfærd (mødet er aflyst).
- **Rum-API fejl:** Hvis kaldet for ét rum fejler, springes annullering for det specifikke rum over (ingen falsk-positive).
- **Race med ny bestilling:** Reconciliation kører kun ordrer ≥ i dag og bruger `meeting_external_id` som primær matchnøgle, så lige-oprettede ordrer er sikre.
