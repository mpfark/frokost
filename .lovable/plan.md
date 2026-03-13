
Mest sandsynlige rodårsag er allerede synlig i netværksloggene: `useCateringOrders` fejler med 400 (`PGRST200`) på query’en `profiles:user_id(...)`, fordi `catering_orders.user_id` ikke har en relation i schema cache. Når den query fejler, bliver `existingOrders` ikke opdateret, og knapperne forbliver “Bestil”.

Planen for at gøre det stabilt på tværs af kalendere og brugere:

1) Stabiliser ordre-fetch (hurtig gevinst)
- Ret `useCateringOrders` til at hente `catering_orders` uden relation-join.
- Hent profiler i en separat query (`profiles` med `in("id", userIds)`) og merge i frontend (samme mønster som i KitchenView).
- Tilføj eksplicit error-håndtering + fallback (`setExistingOrders({})` ved fejl) så UI ikke bliver “stuck” i gammel state.
- Lad `fetchExistingOrders` returnere det nye map, så kaldende kode kan bruge frisk data med det samme.

2) Indfør én fælles møde-identitet på tværs af brugere/visninger
- Udvid event-data fra kalender-funktionerne med Microsoft `iCalUId` (fx `externalMeetingId`).
- Tilføj kolonne i databasen: `meeting_external_id text` (+ indeks/unik constraint for aktive bestillinger).
- Brug `meeting_external_id` som primær nøgle til match i:
  - `EventCard` / `getOrderKey`
  - `useCateringOrders` mapning
  - `CateringOrderDialog` (find/update eksisterende)
- Behold dato/tid/lokation som fallback for gamle ordrer uden external id.

3) Gør opret/opdater race-safe mellem flere brugere
- Erstat “select-then-insert” med en server-sikker upsert-strategi (unik nøgle + upsert/RPC), så to brugere ikke kan oprette parallelle ordrer for samme møde.
- Ved konflikt: opdatér eksisterende ordre i stedet for ny insert.

4) Sikr køkken-flow ved opdateringer
- Behold regel: enhver ændring af aktiv ordre sætter `status = 'pending'`.
- Udvid køkken-notifikationer ved “ordre opdateret” (ikke kun insert/cancel), så køkken tydeligt ser, at bekræftelse kræves igen.

5) Synk på tværs af faner og brugere
- Efter succesfuld submit: kald `fetchExistingOrders()` direkte før dialog lukkes (ikke kun via close-callback/realtime).
- Behold realtime subscription som sekundær synk.

Tekniske detaljer (implementering)
- Frontend-filer:  
  - `src/components/catering/useCateringOrders.ts` (fix query + robust state/error)  
  - `src/components/catering/types.ts` (nyt felt til external id)  
  - `src/components/catering/orderKey.ts` + `EventCard.tsx` (nøgle baseret på external id med fallback)  
  - `src/components/CateringOrderDialog.tsx` (upsert-match via external id + pending reset)
- Backend-filer:  
  - `supabase/functions/get-calendar-events/index.ts` (returnér `iCalUId`)  
  - `supabase/functions/get-room-calendars/index.ts` (returnér `iCalUId`)  
  - SQL migration: ny kolonne + indeks/unik constraint for mødeidentitet.
- Validering:
  - Samme bruger: “Bestil” → “Opdatér” straks efter gem.
  - To brugere på samme møde: kun én delt ordre, begge ser “Opdatér”.
  - Opdatering fra én bruger sætter ordre til “Afventer”, køkken kan bekræfte igen.
  - Test både “Dine møder” og “Mødelokaler” på samme møde.
