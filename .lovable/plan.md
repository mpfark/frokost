## Mål
Rul platform-administrationen tilbage så appen igen er en enkelt tenant (Plusfrokost). Behold alle ikke-platform-relaterede forbedringer (sikkerhedsfixes, email-kø-optimeringer, log-oprydning, webhook-hærdning, dependency-bumps).

## Hvad fjernes

**Frontend**
- `src/pages/Platform.tsx`
- `src/components/platform/PlatformAdminsCard.tsx` (hele `src/components/platform/`)
- `src/App.tsx`: fjern host-tjek mod `VITE_PLATFORM_HOST` og platform-route; behold kun tenant-app
- `src/hooks/useUserRole.ts`: fjern `isPlatformAdmin`
- Tenant-resolver: fjern platform-gren, behold simpel tenant-opslag
- `.env`: fjern `VITE_PLATFORM_HOST`

**Edge functions** (kode-sletning + `supabase--delete_edge_functions`)
- `invite-platform-admin`
- `list-platform-admins`

**Email-system rulles tilbage til ét fast afsendernavn "Plusfrokost"**
- `send-transactional-email`: fjern company-opslag, hardcode `fromName = "Plusfrokost"`
- `auth-email-hook`: fjern `resolveSenderForEmail`, hardcode `Plusfrokost`
- Migration: drop `sender_from_name`-kolonnen (og evt. andre sender-kolonner) på `companies`

**Database**
- Migration:
  - Slet alle rækker i `user_roles` med `role = 'platform_admin'`
  - Rul `has_role` tilbage til kun at matche eksakt rolle (fjern `OR role = 'platform_admin'`)
  - Drop funktionen `is_platform_admin`
  - Drop trigger/funktion `remove_profile_on_platform_admin`
  - Fjern `'platform_admin'` fra `app_role` enum (kræver recreate af enum siden Postgres ikke kan fjerne enum-værdier; håndteres ved at omdøbe gammel, oprette ny uden værdien, caste kolonne, droppe gammel)
  - Rul `companies` RLS tilbage til hvad den var før platform-arbejdet (kun authenticated kan læse via membership), og fjern anon-læseregel
  - Drop `sender_from_name` (og evt. `sender_domain`) på `companies`

**Bruger-sletning**
- Slet `mik.ferdinandsen@gmail.com` helt fra `auth.users` (kaskaderer profiles/user_roles/microsoft_tokens m.m.). Køres som data-operation efter migration.

**Domæne**
- Jeg kan ikke selv frakoble `frokost.gakgak.net` fra projektet — du gør det manuelt i Project Settings → Domains → ⋯ → Remove. Jeg fjerner alle kode-referencer så domænet ikke længere har betydning hvis det skulle hænge fast.

## Hvad bevares
- Tenant-routing for `frokost.pluskontoret.dk` (uændret)
- Alle sikkerhedsfixes (`clientState` på Graph-webhooks, `service_role`-lås på `send-transactional-email`, room-allowlist, `search_path` på funktioner, revoked anon execute)
- Email-kø-optimeringer (1 min polling, ugentlig reminder-cron)
- `cron.job_run_details`-oprydning
- Dependency-bumps (`react-router-dom`, `@supabase/supabase-js`)
- `companies`-tabellen i sig selv (bruges af multi-room/tenant-logik) — kun sender-kolonner droppes

## Rækkefølge
1. Migration: enum-omlægning, drop funktioner/triggers, ryd `user_roles`, drop sender-kolonner, rul `companies` RLS tilbage, rul `has_role` tilbage
2. Slet edge functions fra Supabase
3. Slet frontend-filer + opdater `App.tsx`, `useUserRole`, tenant-resolver, `.env`
4. Opdater `send-transactional-email` + `auth-email-hook` til hardcoded "Plusfrokost"
5. Data-operation: slet auth-bruger `mik.ferdinandsen@gmail.com`
6. Bed dig fjerne `frokost.gakgak.net` i Project Settings → Domains

## Risici / ting du skal vide
- **Du mister adgangen som platform admin** når migrationen kører — du skal logge ind som almindelig admin på `frokost.pluskontoret.dk` bagefter (`mf@pluskontoret.dk` har stadig sin tenant-admin-rolle).
- **Enum-omlægning af `app_role`** kræver kort lock på alle tabeller der bruger typen (kun `user_roles`). Hurtig operation.
- Hvis `frokost.gakgak.net` stadig er forbundet i Lovable efter koden er fjernet, vil domænet bare vise den almindelige tenant-app (samme som pluskontoret-domænet) indtil du frakobler det.
