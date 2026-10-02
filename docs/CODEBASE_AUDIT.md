# Codebase Audit

Audit af `main` på `5a5e1d6` (28. september 2026). Statisk kode- og migrationsgennemgang; ingen produktionstilslutning. `docs/PRODUCT_INTENT.md` og `docs/PLUSKONTORET_APP_STANDARD.md` er styrende. Den eksisterende, beskidte `fix/microsoft-only-login`-checkout er ikke brugt; dens ændringer er ikke del af denne audit.

## Executive summary

Frokost har de tilsigtede frokost-, køkken- og forplejningsflows samt en ny konservativ kalenderafstemning. Den største arkitekturgæld er et delvist indført tenantlag oven på en app, der nu kun har én virksomhed, og flere samtidige login-/brugerflows. Sikkerhedsarbejdet bør begynde med at kontrollere, om `profiles.is_active` faktisk stopper adgang efter Webflow-deaktivering. Ingen databaseadfærd er verificeret mod produktion.

## Current architecture

Vite/React 18, React Router, TanStack Query og Supabase-klient. `src/App.tsx` monterer tenant- og farvelag; `src/pages/Index.tsx` styrer Supabase-session og faner. UI læser og muterer Supabase-tabeller direkte. 27 Edge Functions står i `supabase/functions`; databasehistorikken ligger i tidsstemplede migrations. Kalenderafstemning deles af `calendar-webhook` og `reconcile-room-bookings` gennem `_shared/calendar-reconciliation.ts`.

## Functional areas

| Område | Primære filer | Nuværende ansvar |
| --- | --- | --- |
| Auth | `AuthForm`, `Index`, invitationssider | OTP, Microsoft-login, session og invitation |
| Lunch | `LunchCalendar`, `AbsenceManager` | til-/framelding, gæster, kosthensyn, fravær og lukkede dage |
| Catering | `OutlookCalendar`, `RoomCalendarsView`, `CateringOrderDialog`, `useCateringOrders` | Graph-møder, fælles ordreoprettelse/-ændring/-annullering |
| Kitchen | `KitchenView`, `CateringOrdersSection`, `KitchenNotifications` | tal, bestillinger og driftsændringer |
| Admin | `AdminPanel`, `UserManagement`, `InvitationManagement`, `settings/*`, `WebflowSyncSettings` | brugere, roller, invitationer, drift og integrationer |
| Profile, notifications, statistics | `ProfileSettings`, `UserNotifications`, `StatisticsView` m.fl. | egne indstillinger, beskeder, rapporter |

Frokostmodellen skelner mellem `lunch_signups`, aktive `lunch_optouts` og manglende svar; de må ikke sammenblandes ved refaktorering. Fravær må stadig framelde relevante hverdage uden lukkede dage. Forplejning er fælles: alle relevante medarbejdere skal fortsat kunne oprette, ændre og annullere ordrer til andres møder. Migration `20260312091951` indførte fælles SELECT/UPDATE; senere `20260407130424` ændrede UPDATE-politikken. Undgå ejer-/arrangørbegrænsning som oprydning.

## Authentication and user lifecycle

`AuthForm.tsx` tilbyder Supabase e-mail-OTP (`shouldCreateUser: false`) og Lovable Cloud Auth Microsoft OAuth. `Index.tsx` anvender Supabase-session, men foretager ingen eksplicit `is_active`-kontrol. `AcceptInvitation`/`generate-invite-link`, `validate-invitation`, `send-invitations`, `accept-invitation`, `SetPassword` og `auth-email-hook` udgør et overlappende invitations-/mailspor. Kalenderadgang er et andet OAuth-flow: `MicrosoftCallback` og `microsoft-auth-callback` lagrer delegerede Graph-tokens i `microsoft_tokens`; app-only Graph bruges også. Det flow kan stadig være nødvendigt ved Microsoft-only login på grund af andre scopes.

`profiles.id` knytter profilen til `auth.users.id`; `user_roles` giver `user`, `kitchen`, `admin` og en efterladt `platform_admin` enum-værdi. `profiles.email`, `webflow_id`, `webflow_synced`, `is_active` og `company_id` er øvrige identitetsfelter. Der er ingen dokumenteret stabil Entra object ID-kolonne. Match på e-mail er derfor sårbart ved adresseændring. Migrér først efter inventar over eksisterende auth users, invitationer, roller og tokenrelationer; bind Microsoft-subjekt til eksisterende profil uden at skabe dubletter, test deaktivering og rollback, og fjern OTP/password-mailstier senere.

Webflow-kæden er: admin start i `WebflowSyncSettings` → `webflow-sync` henter CMS-items → validering/domænefilter → eksisterende profil findes på e-mail og får navn, Webflow-id og aktiv status opdateret → ny e-mail får invitation → invitation/Graph/Microsoft/OTP skaber eller forbinder auth user → `user_roles` autoriserer. Ved fravær i Webflow vælges `deactivate`, `soft-delete` eller `full-delete`; ugyldige items med kendt e-mail beskyttes mod deaktivering. `deactivate` sætter kun profilen inaktiv, mens `soft-delete`/`full-delete` kalder Auth delete. Fuld sletning kontrollerer mindst frokosttilmeldinger, ikke alle relationer. Syncen læser kun første Webflow-itemsvar i den gennemgåede kode; pagination bør verificeres. Eksisterende auth user uden profilmatch på e-mail og e-mailændringer kræver særskilt afklaring. Webflow bør eje ansættelsesstatus; Microsoft bør eje loginidentitet; Supabase bør eje app-profil/roller.

## Data model

Kerne: `profiles`, `user_roles`, `lunch_signups`, `lunch_optouts`, `guests`, `closed_dates`, `catering_orders`, `catering_calendar_sources`, `company_settings`, `invitations`, `invitation_batches`. Drift: `kitchen_notifications`, `user_notifications`, `push_subscriptions`, `signup_audit_log`, `microsoft_tokens`, `graph_subscriptions`, `webflow_sync_settings`, `sync_logs`, e-mailkø/log/suppression og `vapid_keys`. Tenantrester: `companies`, `company_modules`, `profiles.company_id`. `catering_calendar_sources` er servicebeskyttet mødeidentitet, ikke en tenantrelation. Der er flere successive policy-migrations; vurder den endelige policy i testdatabase før ændring. Bevar migrationshistorikken og foreslå kun nye migrations.

## Security model

RLS og `has_role` beskytter admin/køkken-data; Edge Functions bruger både `_shared/auth-utils.ts`, lokale `auth.getUser`-checks og service-role-klienter. `microsoft_tokens` og service credentials skal forblive utilgængelige fra browseren. Kalenderafstemning bruger en servicebeskyttet tabel og en DB-funktion med lås/transaktion. CORS er ikke autorisation. UI-fanenes skjulning er kun præsentation. Verificér med SQL-rolleprøver, at inaktive profiler afvises på både tabeller og funktioner; koden viser ikke en gennemgående kontrol.

## External integrations

Webflow CMS, Lovable Cloud Auth, Supabase Auth/DB/Realtime, Microsoft Graph (delegated og app-only), e-mailkø/transaktionsmail og Web Push. Hardcodet produkt-URL findes bl.a. i `InvitationManagement` og `webflow-sync`; Graph-gruppen `All Users` er hardcodet i `get-microsoft-users`. Flyt kun disse efter at deres operationelle betydning er verificeret.

## Product intent gaps

Tenant, modulflag og firmafarver strider mod den nye interne en-app-retning. OTP og password-/invitationstilknyttede stier overlapper med den ønskede Microsoft-loginmodel. Profil-deaktivering ser ikke ud til at blive håndhævet i almindelig session-/dataadgang. `company_settings` er derimod en aktiv kilde til lukkede dage, påmindelser, lokaler og domæne; behold disse behov i en enkelt-app-indstilling. Den nuværende kalenderafstemning stemmer med intentionen: tidsskift kan annullere, lokale og titel opdateres, verificeret sletning kan annullere, Graph-fejl og ukendt identitet bevarer ordren. `docs/calendar-reconciliation.md` beskriver begrænsninger ved manglende arrangøradgang og ældre ukoblede ordrer; ingen redesign anbefales.

## Legacy architecture

| Rest | Reelt brugt / afhængigheder | Fjernelse og risiko |
| --- | --- | --- |
| `companies`, `custom_domain`, `tenant-resolver`, `TenantContext` | `App` monterer provider; resolver vælger aktiv virksomhed; farvehook læser domæne | Kode kan sandsynligvis erstattes uden datamigration. Tabellens data, policies og `profiles.company_id` kræver ny migration og datatjek. Risiko: opstarts-/loginblokering og tab af domæne-/farveindstillinger. |
| `company_modules`, `useEnabledModules`, `MODULE_REGISTRY` | Hook/registry er defineret, men ingen kaldere i `Index`/`AdminPanel` fundet | Kode kan fjernes efter referencekontrol; tabel kræver migration og kontrol af evt. ekstern brug. Lav UI-risiko, ukendt driftsrisiko. |
| `profiles.company_id` | FK og policy for moduladministration; ingen aktiv frontend-afgrænsning | Kræver DB-migration/backfillvurdering; risiko for policy- og profilbrud. |
| Firmafarver | `useCompanyColors` i `App`, `AppearanceSettings` i admin, både `companies` og `company_settings` | Aktivt visuelt lag; vælg ét fast Pluskontoret-token-sæt først. Farvedata kræver kun migration hvis de skal bevares. |
| `company_settings` | Bredt brugt i lunch, catering, kitchen, admin og Edge Functions | Behold enkelt-app-funktioner; eventuel omdøbning kræver migration og mange kaldere. Høj regressionsrisiko. |
| `platform_admin` enum | Migration `20260630091300` fjernede rolledata/policies, men enum-værdi består; registry nævner den | Ikke aktiv rolle; enum-oprydning er databaseindgreb med mange afhængige policies. Udskyd. |

## Dead or redundant code

`useEnabledModules`/registry er uden fundne UI-kaldere. `SetPassword`, e-mailauth-skabeloner og nogle invitationsfunktioner er mulige legacy-stier, men har routes, hooks eller backendkald og er **ikke** erklæret døde. Funktioner uden `functions.invoke` i frontend kan være cron, webhook, Auth hook eller server-til-server: `calendar-webhook`, `auth-email-hook`, `process-email-queue`, `renew-graph-subscriptions`, påmindelser m.fl. må ikke slettes på klientreferencer alene. `src/integrations/supabase/types.ts` er genereret og skal regenereres efter fremtidige migrations.

## Refactoring candidates

| Komponent (linjer) | Ansvar og anbefalet senere opdeling |
| --- | --- |
| `LunchCalendar` (1087) | Datoflytning, query/mutation af tilmeldinger, gæster, fravær, realtime og kalender-UI. Del først data-/mutationshooks, dernæst dagskort og dialoger; lås tilmeldt/frameldt/ikke reageret med tests. |
| `KitchenView` (1360) | Flere queries, realtime, tal, ordrehåndtering, påmindelser og UI. Del query/aggregat og ordrehandlinger fra visning; test køkkental og notifikationer. |
| `UserManagement` (641) | Profilliste, roller, aktivering, sletning og dialoger. Udtræk brugerkommandoer/validering og liste-/dialogdele; test rollegrænser. |
| `InvitationManagement` (603) | Invitationer, Microsoft-brugerimport, batchhandlinger og UI. Del invitationservice, kandidatmatch og tabeller/dialoger; test dubletter og e-mailændring. |

Edge Functions: authentication (`auth-email-hook`, invitation/validering, Microsoft-callback), users/Webflow (`delete-user`, `webflow-sync`, `get-microsoft-users`, `test-webflow-connection`), Graph/calendar (`get-*calendar*`, `get-meeting-rooms`, webhook/reconcile/renew), email (`send-*email`, queue, logs, suppression/unsubscribe, reminders), push/admin (`send-push-notification`, VAPID, previews/tests). Store funktioner er især `send-transactional-email` 368, `webflow-sync` 365, `process-email-queue` 325 og `auth-email-hook` 290 linjer. Auth-checks og Graph-tokenhåndtering gentages trods `_shared/auth-utils.ts`, `_shared/microsoft-auth.ts` og `_shared/graph-utils.ts`; konsolidér senere med uændrede rettighedsgrænser. Kaldere skal findes i `supabase/config.toml`, cron og eksterne webhooks før en funktion betegnes ubrugt.

## Security findings

| Severity | Fund og konkret risiko |
| --- | --- |
| High | `webflow-sync` kan sætte `profiles.is_active=false`, men `Index` accepterer en eksisterende Supabase-session uden statuscheck, og mange RLS-politikker bygger på `auth.uid()`/rolle alene. En tidligere medarbejder kan potentielt fortsætte med adgang. Bekræft i staging med inaktiv bruger og policy/RPC-matrix før ny migration. |
| Medium | Webflow-match på e-mail og sync uden tydelig pagination kan give dubletter eller masse-deaktivering, hvis kilden er ufuldstændig. Tilføj sikker fuld-sync-validering og identitetsnøgle før oprydning. |
| Medium | Flere service-role Edge Functions har lokale auth-varianter; gennemgå hver endpoint og `verify_jwt`/scheduler-konfiguration for uautoriserede servicehandlinger. Ingen konkret udnyttelse er påvist. |
| Low | Debuglogging i `Index` og Webflow-sync; sidstnævnte logger første items `fieldData` og dermed mulige persondata. Begræns logs. |

## Repository hygiene

`.env` er tracked i Git; de nuværende variabelnavne er `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_VAPID_PUBLIC_KEY` (forventeligt offentlige klientværdier). Undersøg historikken uden at udskrive værdier; hvis hemmelige værdier tidligere var committed, rotér den pågældende type. `.gitignore` ignorerer ikke `.env`. Både `package-lock.json`, `bun.lock` og `bun.lockb` er tracked, og `package.json` angiver ingen package manager. `.lovable`, Lovable-tagger/Cloud Auth og mange shadcn UI-filer kan være relevante eller legacy; brug faktisk import-/driftsreferencer før fjernelse. Undgå lockfile- eller dependencyændring i auditten. `docs/calendar-reconciliation.md` er nyere og angiver selv uprøvede produktionsforudsætninger.

## Test coverage

| Kommando | Resultat |
| --- | --- |
| `node --test --test-isolation=none tests/calendar-reconciliation.test.ts` | 14/14 bestået; dækker tids-/lokale-/titelændring, sletning, fejl, ukendt identitet og ejeruafhængighed. |
| `node tests/calendar-database.test.mjs` | Ikke kørt færdig: `@electric-sql/pglite` mangler i lokalt miljø; ikke påvist kodefejl. |
| `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json` | Fejler på manglende lokal `input-otp`-pakke og afledt typefejl; dependency-installation er ikke verificeret. |
| `node node_modules/eslint/bin/eslint.js .` | 108 fejl/28 advarsler, især eksisterende `no-explicit-any`; baseline. |
| `node node_modules/vite/bin/vite.js build` | Første forsøg blev blokeret af Windows-sandbox `spawn EPERM`; gentaget uden denne blokering nåede 1711 moduler, men fejlede på lokal manglende `input-otp`-pakke. |

Mangler meningsfulde end-to-end/RLS-prøver for inaktive brugere, Webflow-fuld-sync, invitationer, cateringrettigheder og Graph-adgang i staging. Kalender-DB-testen og produktionsrettighederne er ikke verificeret her.

## Proposed cleanup sequence

1. Bekræft og afhjælp deaktiveret-bruger-adgang og Webflow-syncens fuldstændighed i en særskilt, testet sikkerhedsopgave.
2. Kortlæg eksisterende auth users/profiler/roller/invitationer og beslut stabil Microsoft/Entra-identitet; migrér uden dubletter, behold særskilt Graph-consent.
3. Frys Pluskontoret-tokens og erstat aktivt tenant/farvelag i kode, med regressionstests for opstart og design.
4. Lav nye migrations for `company_modules`, `companies`, `profiles.company_id` først efter datatjek og afhængighedskort; behold `company_settings`-drift.
5. Del store komponenter og Edge Functions op én funktionel vertikal ad gangen, med kalender- og cateringrettigheder som faste regressionstests.
6. Vælg package manager, ret lockfiler/testmiljø og fjern først derefter dokumenteret død kode.

## Risk matrix

| Indgreb | Risiko; filer/komponenter | Database impact | User impact | Required tests | Rollback |
| --- | --- | --- | --- | --- | --- |
| Aktiv-bruger-gate | Høj; `Index`, RLS, auth-funktioner, Webflow | Ny policy/funktion mulig | Inaktive afvises; falsk deaktivering kan låse brugere | aktiv/inaktiv/rolle/session i staging | separat reversibel migration og flag/backup |
| Microsoft-only login | Høj; `AuthForm`, invitationer, Auth hook | identitetsbinding/tokenrelationer | loginændring | eksisterende/ny/inaktiv bruger, invitation, logout | behold gammelt flow i overgang, kontrolleret tilbagerulning |
| Tenantfjernelse | Middel-høj; `App`, resolver, farver, registry | nye drop-migrations/FK | opstart/tema | login, tema, admin, data-RLS | kode-rollback før DB-drop; backup/dataeksport |
| Kalenderfunktioner | Høj; webhook/reconcile/shared/DB-funktion | `catering_calendar_sources` | risiko for ordreannullering | 14 kodeprøver + PGlite + Graph staging | genudgiv tidligere funktioner, DB-backup |
| Komponentopdeling | Middel; fire store komponenter | ingen | regression i daglig drift | lunch/kitchen/catering UI-flow | revert af lille separat commit |
| Lockfileoprydning | Lav-middel; lockfiler, CI | ingen | build/udgivelse | clean install, type/lint/build | revert lockfilecommit |

## Recommended first implementation task

Tilføj en afgrænset **staging-baseret adgangstest for inaktive Frokost-profiler** (normal session, direkte tabelkald og relevante Edge Functions) og dokumentér resultatet. Ingen produktionspolicy ændres i den første opgave. Det er lav risiko, værdifuldt og giver et sikkert grundlag for den efterfølgende adgangsmigration.
