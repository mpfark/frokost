# Pluskontoret Authentication Architecture

Status: **implementeringsforslag til godkendelse; ingen implementation**. Dato: 29. september 2026. Dokumentet er fælles for Frokost og IT-hjælp; app-specifikke afsnit og backlogs er markeret. Kun dette dokument ændres i repositories.

## Goals

Microsoft 365 skal være normal loginmetode i begge apps. Microsoft identificerer personen; en eksplicit medarbejderkilde og appens lokale adgangsregler bestemmer adgang. Roller forbliver lokale. Eksisterende Frokost-brugere, deres historik og kalenderforbindelser skal overleve en gradvis migration.

Anbefaling: **Webflow som medarbejdermaster, separate appdatabaser med lokale medarbejderkopier, verificeret Entra `tid + oid` som fælles loginidentitet og eksisterende Supabase UUID som lokal datanøgle**. Ingen direkte runtimeafhængighed mellem apps.

## Non-goals

Ingen ændring af kode, migrationsfiler, database, RLS, login-UI, providers, scopes, invitationer, Webflow-sync eller Lovable-konfiguration i denne opgave. Ingen fælles auth-database, globalt rollesystem, tværgående session-cookie, ny HR-platform eller komplet ekstern ekspertadgang. Kalenderens tilsigtede samarbejdsmodel og forretningsregler ændres ikke.

## Evidence and preflight

Der er hentet Git-referencer fra begge origins. Rene dokumentations-checkouts har følgende identiske `main` og `origin/main` før dokumentationsændringen:

| App | Gennemgået baseline | Preflight og afvigelser |
| --- | --- | --- |
| Frokost | `12fab2ae52483c29a687308a6e4aeb1c7abb8ac0` | Eksisterende rent `main`-worktree genbrugt; `switch main`, `pull --ff-only` og status kontrolleret. Projektets andet checkout på `fix/microsoft-only-login` har omfattende ucommittede ændringer og er ikke ændret eller medtaget. |
| IT-hjælp | `2a0ba1400d03246d4a126c6396fb158dc1b0992b` | Projektcheckoutets rene `main` er efter fetch/pull stadig ét commit foran origin: `c70ca85` med attachment-tests. Det er bevaret. Et rent klonet `main` fra origin anvendes til dette dokument, så testcommittet ikke pushes som del af opgaven. |

Frokosts lokale branch `codex/active-employee-access` findes også, men er ikke del af den gennemgåede `origin/main`. Dens navn eller lokale eksistens dokumenterer ikke produktionsdeployment. Senere opgaver skal genbruge relevant allerede udført arbejde efter ny sammenligning, ikke implementere det blindt igen.

Begge `PRODUCT_INTENT.md`, `PLUSKONTORET_APP_STANDARD.md` og `CODEBASE_AUDIT.md` er læst. Standardfilerne er identiske. Frokosts `CROSS_APP_ALIGNMENT.md` og `calendar-reconciliation.md` er læst. IT-hjælps lokale `ATTACHMENT_ACCESS.md` er læst som supplerende dokumentation fra det upushede testcommit; filen findes ikke på den auditerede origin-baseline. IT-hjælp har ingen `CROSS_APP_ALIGNMENT.md` på denne baseline.

**Evidensgrænse:** Kode og migrationshistorik er kontrolleret, ikke live auth.users, claims, aktive policies, providerindstillinger, Entra-registreringer, secrets eller deploymentstatus. Brugerens oplysning om publicerede apps er lagt til grund; Git beviser ikke, hvilke backendmigrationer der er kørt. Nedenfor skelnes observeret kode fra foreslået sluttilstand og nødvendige miljøtests.

## Current state – Frokost

| Del | Observeret implementation og kilde | Klassifikation |
| --- | --- | --- |
| E-mail-login | `src/components/auth/AuthForm.tsx`: `signInWithOtp`, `shouldCreateUser:false`, 8-cifret `verifyOtp(type:email)`. Frontendvalget er ikke en serveromfattende signup-spærring. | Authentication; midlertidig migrationsfallback |
| Microsoft-login | Samme formular kalder `lovable.auth.signInWithOAuth("microsoft")`. `src/integrations/lovable/index.ts` bruger Cloud Auth SDK og overfører returnerede sessiontokens til `supabase.auth.setSession`. | Authentication; eksisterende loginvej |
| Session | `src/pages/Index.tsx`: `getSession` og `onAuthStateChange`; Supabase-klient har persistent session og auto-refresh via `brokeredPreviewStorage`. Intet gennemgående aktiv-medarbejder-gate i Index. | Authentication/session, ikke tilstrækkelig autorisation |
| Profiler | Migration `20251106130317_*`: `profiles.id` er FK til `auth.users.id` med `ON DELETE CASCADE`; trigger `handle_new_user` opretter profil. Senere felter: `is_active`, `webflow_id`, `webflow_synced`, `company_id`. Ingen eksplicit `oid/tid`-mapping fundet. | Lokal identitet og employee lifecycle |
| Roller | `user_roles`, `has_role`, admin-/køkkenpolicies. `user`, `kitchen`, `admin`; enumrest `platform_admin`, hvis privilegieadfærd/data blev fjernet i `20260630091300_*`. Rollekontrol er ikke en universel aktiv-bruger-kontrol. | Authorization; platform_admin er legacy |
| Invitationer | `InvitationManagement`, `AcceptInvitation`, `validate-invitation`, `generate-invite-link`, `send-invitations`, `accept-invitation`; `invitations` og batches. Offentlig kodevalidering kan give invite/magiclink; `generateLink(type:invite)` falder tilbage til magiclink for eksisterende konto. | Onboarding og alternative authentication-veje |
| Invitation accepteres | `accept-invitation` verificerer auth user og markerer pending invitationer på brugerens e-mail accepteret. Det er ikke et universelt check af ansættelse, kode eller udløb ved hver adgang. | Lifecycle, ikke løbende authorization |
| Mail/password-spor | `SetPassword`, `send-password-reset`, `auth-email-hook`, skabeloner og `process-email-queue` er stadig til stede. Mailhook verificerer webhook og kølægger mails; det er ikke et medarbejder-gate. | Authentication-support; mulige senere legacy-kandidater, endnu ikke døde |
| Webflow | `supabase/functions/webflow-sync/index.ts`, `WebflowSyncSettings`, `webflow_sync_settings`, `sync_logs`: administratorkald; matcher profiler på e-mail, sætter navn, Webflow-ID og aktiv=true; nye adresser inviteres. Manglende synkroniserede profiler deaktiveres eller Auth-slettes afhængigt af indstilling. | Employee lifecycle og invitationer |
| Microsoft-brugerimport | `get-microsoft-users` henter Graph-gruppen `All Users`, bruger mail/UPN og filtrerer deaktiverede konti. Den vælger ikke eksplicit Entra-ID til en vedvarende profilbinding. | Kandidatliste til onboarding, ikke medarbejdermaster |
| Outlook | `OutlookCalendar`, `MicrosoftCallback`, `microsoft-auth-callback`, `_shared/microsoft-auth.ts`: separat kodeudveksling og delegerede tokens. | Calendar consent; ikke app-login |
| Token/subscription-tabeller | `microsoft_tokens.user_id` er unik FK til auth.users; `graph_subscriptions.user_id` er unik uden samme deklarerede FK. Sidstnævnte gemmer subscription-id, udløb og senere `client_state`. | Kalenderdrift; skal beholde brugerrelationerne |

Webflow læser i denne kode ét `/items`-svar, uden paginationsloop. Draft/archived-filtrering og `include_drafts` påvirker, hvem der anses som aktiv. Ugyldige items med kendt e-mail beskyttes delvis mod deaktivering. `soft-delete` kalder `deleteUser(id)` uden eksplicit soft-delete-argument; navnet må ikke tages som garanti for bevaret historik. `full-delete` kontrollerer frokosttilmeldinger, ikke alle afhængigheder. Disse veje skal afløses af ikke-destruktiv statusændring i senere arbejde.

**Vigtigt fund ud over den tidligere audit:** Migration `20260308123451_*` giver ejeren SELECT/INSERT/UPDATE/DELETE på `microsoft_tokens`. Ingen senere ophævelse blev fundet. At UI kun vælger `id` betyder ikke, at rå tokens er beskyttet mod direkte API-læsning. `graph_subscriptions` har derimod en afvisende authenticated-policy (`20260309110154_*`); browserens direkte disconnect-delete kan derfor undlade at rydde abonnementet. Verificér live grants/RLS i F1, og håndtér afgrænset i F5. Ingen tokens er læst i denne opgave.

## Current state – IT-hjælp

| Del | Observeret implementation og kilde |
| --- | --- |
| Login/signup | `src/lib/helpdesk-api.ts`: Microsoft via Lovable, `signInWithPassword`, `signUp`, `resend(type:signup)`, `signOut`. `helpdesk-app.tsx` viser login og selvoprettelse. |
| Cloud/Supabase | Cloud Auth-wrapperen overfører tokens til Supabase som i Frokost. Der er ikke belæg for to uafhængige brugerbaser inde i samme app; appdata bruger Supabase UUID. |
| Session | UI bruger `getSession`/`onAuthStateChange`. Klienten persisterer og refresher session. `auth-attacher` vedhæfter bearer token; `auth-middleware` verificerer Supabase-claims og bruger `sub` som lokal userId. Det er Supabase-sub, ikke Entra-sub. |
| Profiler/roller | `drizzle/migrations/0000_helpdesk_schema.sql`: `profiles(id,name,email)` og `user_roles`; Auth-trigger opretter profil og `employee` ubetinget. Ingen Webflow-kobling, aktiv-status eller allowlist. Ingen deklareret FK fra profiles/user_roles til auth.users. |
| IT/admin | SQL-enum er `employee/admin`; TypeScript nævner også `it`, og UI definerer staff som ikke-employee. Reelle SQL-rettigheder gives gennem `is_admin`. `0002_grant_it_admin.sql` giver admin til bekræftet `mf@pluskontoret.dk` ved oprettelse/bekræftelse og backfill. |
| Dataadgang | RPC `create_helpdesk_ticket` kræver kun auth.uid(), derefter SECURITY DEFINER-skrivning. RLS bruger ejer/admin; kategorier læses af alle authenticated. Egen profil kan opdateres. |
| Storage | `ticket-attachments`; metadata-RLS skelner intern/employee_visible; Storage læser via synlig metadata. Klienten laver signed URL med 60 sekunders levetid. Repoet opretter ikke bucketens private konfiguration. |
| Invitationer | Ingen invitationsmodel eller invitationsflow fundet. Signup-bekræftelse/genudsendelse er ikke invitation eller medarbejdergodkendelse. Ingen reset-password-UI fundet. |

**Alle fundne adgangsindgange:** (1) UI-signup, (2) direkte Supabase signup-API, hvis miljøet tillader det, (3) første Microsoft-login, hvis provideren opretter user, (4) privilegeret oprettelse via Auth-administration/dashboard/API, som rammer samme trigger, (5) eksisterende password-/OAuth-session og refresh. Bekræftelseslink aktiverer et eksisterende signup og kan udløse admin-trigger. Der er ingen særskilt invite-route at lukke. Hver vej skal ende i samme deny-by-default-appkontrol, også når der allerede findes en profil og rolle.

Ingen app-specifik medarbejderautorisation følger af `email_confirmed_at`, en Microsoft-identitet eller en eksisterende employee-rolle. Serverens service-role-klient kan bypass'e RLS og må aldrig bruges til brugerhandlinger uden separat kontrol.

## Shared identity model

```text
Microsoft Entra: verificeret (tid, oid)
                 ↓ betroet, entydig binding
Lokal employee-record ← Webflow: (collection_id, item_id), aktiv ansættelse
                 ↓ lokal app-adgang, aktiv-status og eventuel spærring
Eksisterende lokal auth.users.id / profiles.id
                 ↓ user_roles og objektets adgangsregler
Frokost-data eller IT-hjælp-data
```

Begge apps gemmer samme Entra-nøgle og samme Webflow-kildenøgle for den samme medarbejder, men har forskellige Supabase UUID'er. `employee_id` i den foreslåede lokale medarbejdertabel er app-lokal; tværgående sammenligning bruger de eksplicitte kildenøgler. Webflow-id identificerer et kildeobjekt, ikke nødvendigvis en person for evigt, hvis objektet slettes/genoprettes.

En person kan være kendt i Webflow før login. Opret derfor en lokal employee-record uden auth user; opret ikke en kunstig auth-konto eller en Frokost-profil med falsk UUID. Ved første godkendte login forbindes den til det rigtige auth UUID. En auth user uden godkendt forbindelse får højst adgang til egen neutrale adgangsstatus og logout.

## Employee source of truth

Webflow afgør intern ansættelsesstatus. Entra afgør loginidentitet. Appen ejer medlemskab, lokal spærring og roller. En administrator kan altid suspendere app-adgang; en ny Webflow-sync må ikke ophæve denne spærring. Webflow eller brugerens profilmetadata må aldrig tildele admin/IT/kitchen.

### IT-hjælp: A/B/C

| Mulighed | Fordele | Ulemper | Beslutning |
| --- | --- | --- | --- |
| A. Lokal manuel allowlist | Lille første leverance; ingen Webflow-drift krævet; egnet til pilot. | Dobbelt onboarding/offboarding; risiko for forældet adgang. | Kun afgrænset pilot med ejer og udløb; samme fremtidige medlemskabsmodel. |
| B. Lokal synkronisering fra samme Webflow-kilde | Genbruger faktisk medarbejderliste; ingen Frokost-runtimeafhængighed; egen RLS/roller. | To sync-jobs og krav om ens betydning af aktiv-status. | Anbefalet driftstilstand. Importér samme collection, ikke Frokosts auth.users/tokens. |
| C. Central medarbejderdatabase | Én livscyklus og ét synkroniseringssted. | Ny service, tværgående auth, tilgængelighedskrav, versionering og fælles fejlpunkt. | Udskyd indtil et konkret driftsbehov retfærdiggør det. |

### Sync-kontrakt og drift

Match først på `(collection_id, item_id)`, derefter på allerede verificeret identitetsbinding. E-mail er kun kandidat til kontrolleret førstegangsbinding. Indlæs alle sider til et valideret snapshot, kontroller schema, dubletter, antal og mapping, og anvend ændringer atomisk/idempotent. Fjernelse må kun udledes af et fuldstændigt godkendt snapshot. Fejl, tomme fejlresponser, 429, manglende sider og ukendt mapping må ikke deaktivere mange brugere.

Foreslået driftsmål: sync hver 15. minut, alarm efter to fejlede kørsler, lokal akut spærring i begge apps ved fratrædelse. Dette er en ny anbefaling, ikke eksisterende scheduleradfærd. Ved kildefejl bevares sidste godkendte snapshot i højst 24 timer; ingen nye bindinger eller genaktiveringer fra usikre data. Derefter afvises normal adgang, indtil kilden er genetableret eller en navngiven operatør har givet en tidsbegrænset, auditeret nødforlængelse. Grænserne aktiveres først efter stabil sync og godkendt driftsansvar; indfør dem ikke som en pludselig Frokost-lockout.

En Webflow-ændring kan først håndhæves, når appen har modtaget den. Normal tilbagekaldelsesforsinkelse er derfor syncinterval plus behandling; umiddelbar offboarding kræver eksplicit lokal deaktivering i begge apps. Vis seneste succes og status pr. app; en fælles kilde er ikke en garanti for samtidige snapshots.

### Medarbejderlivscyklus

| Hændelse | Foreslået håndtering |
| --- | --- |
| Ny medarbejder | Aktiv source-record importeres; lokal admission tillades efter verificeret binding. Standardrolle user/employee, aldrig privilegier fra e-mail. |
| Navneændring | Opdater visningsnavn via samme source-id; ingen ændring af auth UUID, Entra-nøgle eller historisk aktør-id. |
| E-mailændring | Samme source-id og Entra-nøgle bevares; opdater kontaktfelt. Auth-e-mailændring følger understøttet verificeret proces og kollisionskontrol; ændringen må ikke flytte identitet til en anden konto. |
| Fratrædelse | Inaktiv source-record og lokal adgang=false; bevar profiler og historik. Stop brugerinitierede handlinger og personrettede jobs. Ingen Auth-sletning. |
| Genansættelse | Samme kildeobjekt/Entra-konto kan genbruges efter kontrol. Ny oid eller nyt Webflow-item kræver manuel identitetsafklaring; ingen e-mailbaseret historikarv. Privilegerede roller skal godkendes igen. |
| Microsoft findes før sync | Login kan lykkes, men normal adgang afvises med neutral besked. Senere sync og nyt autorisationscheck kan give adgang; ingen rolle ved første auth alene. |
| Webflow findes før login | Lokal employee-record afventer auth-binding. Ingen invitation nødvendig i sluttilstanden. |
| Source-record slettes | Tombstone/inaktiv efter fuld sync; ingen kaskadesletning af appdata. En senere record med samme e-mail er en ny kandidat, ikke automatisk samme medarbejder. |

## Authentication vs authorization

Sluttilstandens adgangsprædikat er konceptuelt:

```text
valid_local_session
AND trusted_identity_for_this_session_matches_local_binding
AND allowed_tenant
AND employee_active
AND app_membership_enabled
AND NOT locally_suspended
AND source_snapshot_within_approved_freshness
AND required_local_role_and_resource_permission
```

Entra-login skal være brugerlogin, ikke et app-only Graph-token. Supabase validerer sin egen session; dens JWT `sub` giver kun appens auth UUID. Et eksisterende UUID må ikke i sig selv legitimere en ny Microsoft-identitet, som en broker muligvis har auto-linket på e-mail.

**Tillidsgrænse ved sessionen:** Før Microsoft-pilot skal F2/I2 bevise, at brokeren både verificerer provideridentiteten og afviser en anden oid/tenant, før en eksisterende autoriseret konto kan overtages. Hvis dette ikke kan håndhæves før sessionudstedelse, kræves en serverbeskyttet session-admission knyttet til verificeret `session_id`, lokal user-id og identitetsbinding. RLS/RPC skal da kræve denne admission. En ny Microsoft-session må ikke arve adgang fra et uid-match alene. Manglende betroet sessionspecifik dokumentation er en stopklods, ikke anledning til at stole på klientmetadata.

Frokosts overgang kan tillade kendte eksisterende sessioner og verificerede gamle loginmetoder for eksplicit godkendte aktive legacy-brugere. Registrér overgangens session-/kontogrundlag og metode server-side; et vilkårligt nyt OAuth-login må ikke kvalificere sig som legacy. Fallbacken har slutdato og deaktiveres individuelt efter migration. Den skal gennem samme aktuelle medarbejder- og adgangskontrol.

Samme danske loginmønster: “Log ind med Microsoft”, tydelig ventetilstand, derefter app eller “Du har ikke adgang til denne app. Kontakt IT.” Fejl i netværk eller identitetskontrol giver ingen adgang og må ikke oprette et nyt medlemskab. Ingen overførsel af sessiontokens mellem apps. Microsofts browsersession kan reducere gentagen indtastning, men hver app etablerer egen session og kontrollerer adgang.

## Stable identity choice

| Identifikator | Vurdering | Faktisk observeret i setup |
| --- | --- | --- |
| Entra `oid` + `tid` | Anbefalet fælles nøgle. Tenant afgrænser kontoen; genskabt konto er en ny identitet. | Ingen eksplicit persistens eller extraction i appkoden. Frokost har tenant-/client-konstanter til kalender, ikke bevis for loginclaims. |
| Entra `sub` | Stabil inden for provider/client-kontekst; ikke en fælles nøgle på tværs af forskellige client IDs. Gem eventuelt som diagnostisk provider-sub med issuer/client-id. | Ingen eksplicit Entra-sub-behandling fundet. |
| E-mail / UPN | Kontakt, visning og matchkandidat; kan ændres/genbruges. Må ikke stå alene for binding eller autorisation. | Bruges i begge profiler; Frokost-sync matcher på e-mail. |
| Supabase auth UUID | Bevar som lokal primær relation til data og roller. Ikke fælles person-id mellem projekter. | Tilgængeligt via session/getUser/auth.uid(); bruges i begge apps. |
| Lovable Cloud identity | Transport-/provideridentitet, ikke dokumenteret fælles medarbejdernøgle. | SDK-returnerede tokens sættes som Supabase-session. Præcis `identities[].provider`, subject og claim-proveniens kræver miljøtest. |
| Webflow collection/item | Stabil kildenøgle i recordens levetid; egnet til sync og kontaktændringer. | `webflow_id` i Frokost; collection i syncindstillinger. Ingen tilsvarende IT-hjælp-felter. |

Microsoft beskriver `oid` som fælles på tværs af apps i samme tenant, `sub` som appafhængigt og e-mail/UPN som foranderlige. Det understøtter ovenstående valg. Se [Microsofts claimreference](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference).

### Claim-/linking-spike: konkret leverance før implementering

I hvert projekts isolerede stagingmiljø skal en kontrolleret loginprøve dokumentere: provider-navn, autoritativ claimkilde, issuer, audience, `tid`, `oid`, provider-sub, e-mailverifikationssemantik, lokal auth UUID før/efter, session-id og understøttet linkingmetode. Gem kun en redigeret resultatmatrix; ingen rå tokens eller personregistre i Git.

Accepter kun claims fra en dokumenteret serververificeret provideridentitet eller en valideret OIDC-callback. At dekode et token, læse brugerskrivbar `user_metadata`, sende oid fra browseren eller se samme domæne er ikke bevis. Valider signatur, issuer, audience, tid, udløb og callbackbeskyttelse ved egen callback. Brug aldrig et Graph access token, hvis audience er Graph, som appens loginbevis. [Microsofts claimvalidering](https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation).

Hvis Cloud Auth ikke eksponerer tilstrækkeligt betroet binding/linking, undersøges understøttet Azure-provider i det samme auth-projekt som afgrænset alternativ. Ingen hjemmelavet JWT-udstedelse eller direkte SQL-redigering af auth.identities. Frokost beholder gammel adgang, indtil én understøttet vej bevarer det eksisterende UUID. Dette er en reel leverance-gate, ikke en antagelse om SDK-egenskaber.

## Role model

Roller bindes via appens lokale user/profile til `user_roles`, ikke direkte på Entra-objektet og ikke via e-mail. Identitetsbindingen gør rollen anvendelig for den rigtige session. Entra-grupper/tenant-adminstatus giver ingen implicit lokal adminrolle.

Frokost beholder `user/kitchen/admin`, eksisterende brugerroller og det tilsigtede samarbejde om andres forplejning. Inaktive brugeres gemte roller er ikke operative. IT-hjælp beholder først sin faktiske `employee/admin`-model og erstatter hardcodet e-mailbootstrap med navngiven, auditeret rolletildeling. Før almindelig IT-gruppedrift indføres `it` separat: sager, intern dialog og relevante driftsfelter; `admin` alene administrerer medlemskab/roller. Opdater SQL-enum, helpers, RLS og TypeScript samlet i I5. Ingen globale roller.

Deaktivering suspenderer adgang for alle roller. Ved genansættelse kræver kitchen/it/admin ny godkendelse; rollehistorikken bevares. Admin må ikke selv omgå aktiv-status ved at skrive profilen. Beskyt identitets-, source- og adgangsfelter mod generisk egen-profil-UPDATE med kolonnerettigheder eller separate tabeller.

## Deactivation model

Autorisation læses fra aktuelle lokale databaseregler ved hver beskyttet forespørgsel. En ændring til inaktiv skal afvise den næste forespørgsel efter commit, også med et endnu gyldigt JWT. Auth-logout/revocation er supplement; eksisterende JWT'er kan ikke antages ugyldige med det samme.

| Lag | Fremtidigt ansvar |
| --- | --- |
| Frontend | Vis afvist-status; ryd cache og luk realtime ved statusændring, fokus/refresh eller 403. Må ikke være sikkerhedsgrænse. Allerede viste data kan ikke trækkes tilbage. |
| Database/RLS | Aktiv medlemskabskontrol på alle beskyttede tabeller og alle operationer. Både USING og WITH CHECK; gennemgå eksisterende permissive policies, som ellers OR'es. Undgå rekursion gennem profiles/user_roles. |
| RPC | SECURITY DEFINER-funktioner skal selv kontrollere den kaldende bruger og aktuelle rettigheder; ingen tillid til et vilkårligt user-id-argument. Låst search_path og mindste EXECUTE-grants. |
| Server/Edge | Verificér lokal session og adgang før service-role-læsning/-skrivning, Graph-kald, rolleændring, invitation eller filudlevering. RLS beskytter ikke en service-role-bypass. |
| Auth hook | Kan afvise ny oprettelse/tokenudstedelse, hvis platformen understøtter det; supplerende, aldrig eneste kontrol af eksisterende sessioner. Det eksisterende mailhook løser ikke dette. |
| Jobs/webhooks | Egen verificeret systemidentitet. Skal ikke afhænge af en menneskelig admins browsersession. Begræns scope; dokumentér undtagelser til bruger-gatet. |
| Realtime/Storage | Test fortsat levering efter deaktivering. Afvis nye læsninger, uploads, downloads og signed-URL-udstedelse. Eksisterende IT-signed URL kan virke resten af sine 60 sekunder; hvis øjeblikkelig filspærring kræves, anvend en autoriserende downloadproxy. |

Frokost: dæk lunch, optouts, gæster, fravær, catering, profiler, indstillinger, notifikationer, push, roller og brugerrettede integrationer/RPC'er. Personlige Graph-tokens må ikke fortsat bruges for en fratrådt person; stop refresh/renew og afslut personlige subscriptions kontrolleret. App-only afstemning af allerede bestilte fælles møder må fortsætte som systemjob; fratrædelse må ikke i sig selv annullere ordrer eller fjerne historik.

IT-hjælp: dæk også `categories`, profilopslag, `ticket_admin`, interne kommentarer, attachment-metadata, `activity_log`, `create_helpdesk_ticket` samt samtlige Storage-policies. En adminrolle eller ticket-ejerskab må ikke omgå medlemskabskontrollen.

## Frokost calendar authorization

**Bevar separat login og kalenderconsent.** Nuværende kalenderflow anmoder `offline_access Calendars.Read`; callback gemmer access/refresh-token på den lokale auth user og opretter `me/events`-subscription. `_shared/microsoft-auth.ts` refresher delegerede tokens; app-only client credentials bruger Graph `.default` til øvrige kalenderfunktioner. `calendar-webhook`, `renew-graph-subscriptions` og `reconcile-room-bookings` skal fortsat fungere.

App-login skal kun bede om nødvendige identitetsrettigheder, som verificeres mod valgt broker. Ingen kalenderrettigheder til alle ansatte alene for login; brokerens eventuelle refresh-behov er ikke det samme som kalenderconsent. Manglende kalenderconsent skal ikke blokere frokost eller IT-hjælp.

Bevar eksisterende kalenderregistrering, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, callback-URL, subscriptions og ordreidentiteter under loginmigrationen. Anbefal separate loginregistreringer pr. app frem for genbrug af kalenderens credentials. Frokosts nuværende kalender-tenantkonstant er `1b9fe8e1-0b95-46a2-9574-4e7a39581f22`; kontrollér ejerskab mod Entra før den bruges som loginrestriktion.

Kalendercallbacken viser ikke state/PKCE-korrelation eller verificeret match mellem valgt kalenderkonto og medarbejderidentitet. Registrér dette som særskilt hardening i F5: serverbundet engangstransaktion, godkendte redirect-URI'er og understøttet OAuth-beskyttelse; ingen binding af appidentitet ud fra kalender-e-mail. Nye personlige tilknytninger skal verificeres mod den kendte medarbejder; eksisterende mismatches kræver afklaring, ikke automatisk overskrivning.

Token-tabellens fund skal løses med serverbeskyttet tokenopbevaring og små status/disconnect-endpoints. Skift ikke blot RLS og lad de nuværende browserkald fejle. Disconnect skal rydde Graph-subscription via server og håndtere fejl idempotent. Dette er en særskilt, testet leverance; det må ikke skjult indgå som en sammenlægning af OAuth-flows.

Bevar `catering_calendar_sources`, iCalUId/ImmutableId, arrangøridentitet, notifikationstransaktioner og konservativ fejlbehandling beskrevet i `calendar-reconciliation.md`. Loginændring er aldrig grund til at re-key'e ordrer eller begrænse forplejning til arrangøren.

## Recommended architecture

**Model 3 implementeret med model 1's app-isolation.** To lokale medarbejderkopier af samme Webflow-kilde, samme verificerede Entra-nøgle, egne auth users, profiles, medlemskaber og roller. Synkroniser kildefakta, ikke passwords, sessioner, roller, Graph-tokens eller sager.

| Kriterium | Model 1: separate DB, fælles MS-identitet | Model 2: central identity-DB | Model 3: Webflow-master, lokale profiler |
| --- | --- | --- | --- |
| Kompleksitet | Lav, men lifecycle mangler fælles kilde. | Høj: service, klienter og konsistens. | Moderat: lokal sync og fast kontrakt. |
| Sikkerhed | God isolation; risiko for glemt deaktivering. | Ens status, men større konsekvens ved fejl/kompromis. | Lokal håndhævelse; stale-sync skal styres. |
| Drift | To manuelle medlemslister. | Central vagt/backup/SLA plus apps. | To overvågede jobs, én source-semantik. |
| Fejlsøgning | Lokale logs; sammenlign tid/oid. | Fejl spænder over flere tjenester. | Source-id, sync-run og lokale afvisningsårsager. |
| Deployment | Uafhængigt. | Koordineret schema/API-versionering. | Uafhængigt med versionsstyret synckontrakt. |
| Lovable-kompatibilitet | Passer til to projekter. | Kræver sikker ekstern integration; ingen automatisk delt auth. | Passer til lokale databaser og serverjobs. |
| Migrationsrisiko | Lav datarisiko, men manuelt lifecycle. | Høj; omlægning og mulig re-key. | Lavere: additive tabeller, eksisterende UUID bevares. |
| Vedligeholdelse | Dobbelt manuel offboarding. | Mere platformkode og ejerskab. | To små integrationer og fælles testspecifikation. |
| Single point of failure | Entra-login; hver app isoleret. | Central service bliver ekstra runtime-fejlpunkt. | Webflow er fælles synckilde, men ikke live per request; tidsbegrænset lokal drift. |
| Kobling mellem apps | Lav. | Højere gennem central kontrakt. | Lav; ingen app kalder den anden. |

### Tenant restriction

Anbefal single-tenant Entra-registrering og eksplicit Pluskontoret-tenant i hver apps Microsoft-provider. Tenantbegrænsning og aktivt appmedlemskab er begge nødvendige; gæster kan også findes i organisationens tenant. Domænefilter er kun datavalidering/UX og erstatter ingen af kontrollerne.

Lovable dokumenterer to tilstande: managed Microsoft-login kan ikke tenantbegrænses; egne credentials understøtter tenantvalg. Vælg derfor egne credentials, og kopiér projektets faktiske redirectliste til den respektive Entra-registrering. Skift/disable kan rydde gemte providercredentials; rollback skal derfor have en sikker konfigurationsbackup. [Lovable Microsoft-auth](https://docs.lovable.dev/features/microsoft-auth).

Hvis den valgte integration i stedet er Supabases Azure-provider, skal dens tenant-URL pege på den konkrete tenant. Lovable `microsoft` og Supabase `azure` er ikke udskiftelige navne i den nuværende wrapper. Supabase beskriver også risiko ved uverificerede Microsoft-e-maildomæner og anbefaler `xms_edov`; kontrollér brokerens håndtering frem for at antage, at et email-felt er verificeret. [Supabase Azure-login](https://supabase.com/docs/guides/auth/social-login/auth-azure).

## Rejected alternatives

- E-mail/UPN som permanent nøgle: navn og ejerskab kan ændres; risiko for overtagelse og tabt historik.
- Tenant/domain alene eller employee-rolle fra signup: identificerer ikke eksplicit godkendte medarbejdere.
- Central DB/shared Supabase-projekt nu: unødvendig tværgående drift og migrationsrisiko.
- Frokost som IT-hjælps live identity-API: kobler adgang til frokostappens oppetid og deployment.
- Sammenlagt login/kalenderconsent: ekstra scopes og risiko for eksisterende kalenderdrift uden tilsvarende gevinst.
- Udfasning af OTP/password før dokumenteret kontolinkning: kan udelukke aktive brugere.
- Direkte SQL-flytning af auth.identities eller kopiering af data til et nyt UUID: skrøbeligt og unødvendigt som normal migration.
- Globalt rollesystem og multitenant-login for hypotetiske eksterne: udskydes.

## Migration plan – Frokost

### 1. Inventar og backfill uden loginændring

Tag genskabelig backup og lav privat mappinginventar: auth UUID og provideridentiteter, profiler, Webflow collection/item, aktiv-status, roller, invitationer og afhængige data. Kontroller `lunch_signups`, `lunch_optouts`, gæster, fravær, `catering_orders`, `user_notifications`, `kitchen_notifications`, `signup_audit_log`, push, `microsoft_tokens`, `graph_subscriptions` og kalenderkildetabellen. Find alle faktiske FK'er og aktørreferencer i deployed schema; listen er ikke et argument for at overse andre relationer.

Klassificér hver aktiv bruger som entydigt source-matchet, manuelt godkendt overgangsmedlem eller uafklaret. Uafklarede brugere afklares før gate aktiveres; ikke blind deaktivering ved manglende Webflow-id. Inaktive profiler må ikke grandfatheres. Ingen profil-/auth-sletning, re-key eller ændring af forretningsdata. Sammenlign rækkeantal og relationer pr. UUID før/efter.

### 2. Additiv adgangsmodel

Indfør lokal source-/medlemskabstabel og identitetsmapping, backfill aktive godkendte brugere, og test gate med nuværende OTP/invitation/session. Kør først en afgrænset, ikke-følsom afvisningsrapport, afklar falske afvisninger, og aktivér server/DB-gatet med dokumenteret fallback. Gamle aktive sessioner skal fortsat kunne arbejde under overgang; inaktive skal stoppes uden logout.

### 3. Første Microsoft-login for eksisterende bruger

1. Serveren verificerer den nye Microsoft-identitet og aktuelle source-status. Hvis `(tid,oid)` allerede er bundet, skal den pege på netop det forventede eksisterende UUID.
2. Hvis ingen binding findes, find én kandidat fra backfill. E-mail kan hjælpe med at finde kandidaten, men giver ikke i sig selv ret til kontoen. Kontroller både gammel kontos verificerede ejerskab og ny provideridentitet, kildeobjekt og fravær af konflikter.
3. Foretræk linking fra en nyligt reautentificeret eksisterende session gennem en understøttet provider-linkingmekanisme. Alternativt en administratorattesteret mapping mod Entra/Webflow. For gamle ubundne konti med genbrugt e-mail eller uklar ejerhistorik kræves manuel afklaring; en ny mailbox-OTP alene beviser ikke ejerskab til gammel historik.
4. Bind Microsoft-provider til **samme auth.users.id** gennem understøttet Auth-API/broker. En indsat public mapping-række er ikke i sig selv provider-linking og får ikke et nyt JWT til at få det gamle UUID.
5. Gem mapping i en serverkontrolleret transaktion med unik `(tid,oid)`, unik source-binding og lås/konfliktkontrol. Auth-operation og public-DB-transaktion kan være to systemer: brug en idempotent migrationstilstand (`pending_link`, `verified`, `conflict`) og kontrollér resultat før admission. Ingen adgang mens binding er uafklaret.
6. Bekræft samme UUID/sessionejerskab og uændrede roller, frokost-/cateringdata, notifikationer, historik og kalenderrelationer. Gamle aktive sessioner bevares efter overgangsreglen; ny MS-session skal have den verificerede binding.
7. Hvis provideren opretter et andet UUID: stop normal admission for den nye konto, sæt konflikt til manuel behandling, og lad den oprindelige aktive konto fortsætte via godkendt fallback. Ingen automatisk merge, sletning af originalkonto eller flytning af FK'er.

Supabase dokumenterer automatisk e-mailbaseret linking og en særskilt, konfigurationsafhængig manuel linkingmulighed. Det beviser ikke, at Lovable-wrapperen tilbyder samme vej eller bevarer UUID ved skift af klientregistrering. Dette skal testes før rollout. [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).

**Midlertidigt verificeret e-mailmatch:** Ja som kontrolleret kandidatmatch, med ovenstående ejerskabs- og source-bevis, aldrig som generel automatisk adgangsregel. Efter binding bruges den stabile identitet; e-mailændringer må ikke udløse ny linking. Kendt oid-mismatch afvises også ved identisk verificeret e-mail.

### 4. Pilot og gradvis overgang

Start med navngivne testbrugere, herunder admin, kitchen, invitation og eksisterende kalenderforbindelse. Gør først Microsoft til primær knap; behold dokumenteret fallback. Udvid i hold med support og måling af konflikter/afvisninger. Udfas OTP/password og invitationslogin først, når alle aktive brugere enten har testet Microsoft eller har en godkendt konkret overgangsplan. Ingen global logout eller big-bang-migration.

### Invitationssystem

Behold eksisterende invitationer i overgangsperioden med de nye adgangskrav; invitation alene må ikke omgå inaktiv-status. Nye interne medarbejdere skal i sluttilstanden komme fra source-sync og Microsoft. Stop først nye legacy-invitationer, derefter lad gyldige links udløbe/afklar modtagere, og fjern sidst mail/login-kode i egen leverance. Historiske invitationsrækker kan bevares. Ekstern invitation er ikke en grund til at bevare intern passwordoprettelse permanent.

## Migration plan – IT-hjælp

1. Verificér aktuel Auth/Storage/RLS og eksisterende testkonti, sager og roller. Brug eventuelt det lokale attachment-testarbejde efter særskilt gennemgang; det er ikke implementeret på origin-main i denne audit.
2. Indfør lokal source-/medlemskabsmodel. Start eventuelt med navngiven pilotallowlist med udløb; ingen implicit tillid til alle eksisterende employee-roller.
3. Erstat ubetinget admission fra `handle_new_user` og e-mailadmin-bootstrap. En teknisk profil må gerne eksistere før admission, men giver ingen dataadgang. Tildel første admin kontrolleret til eksisterende UUID efter verifikation.
4. Håndhæv medlemskab i RLS, alle definer-RPC'er, server og Storage **før** bred Microsoft-adgang. En ukendt tenantbruger skal kunne få “ingen adgang” uden at læse kategorier/profiler eller oprette en sag direkte via API.
5. Aktivér Webflow-sync med samme kontrakt som Frokost; tilføj betroet Microsoft-binding og migrationsvej for eksisterende test-/driftskonti uden at ændre deres UUID eller tickets.
6. Pilotér tenantbegrænset Microsoft-login og lokal rollefordeling. Fjern derefter password/signup/resend fra UI og luk tilsvarende uønskede Auth-veje i projektet. Kontroller, at signup-settingen ikke samtidig blokerer ønsket første OAuth-login for godkendte medarbejdere. DB-gatet er fortsat nødvendigt.
7. Verificér deaktivering, refresh, interne noter og private filer før almindelig brugerdrift.

IT-hjælp har ingen eksisterende invitationer at migrere. Et fremtidigt eksternt ekspertflow kan bruge eksplicit gæstemedlemskab, udløb og adgang til bestemte sager. Entra B2B i samme tenant kan senere være en mulighed, men må ikke give employee-status. Anden ekstern provider kan tilføjes separat uden at svække intern single-tenant-regel. Hverken ekstern rolle, sagsdeling eller nye providers bygges i denne planfase.

## Lovable configuration – Frokost

Kun fremtidige handlinger i Frokost-projektet:

1. **LF1 – miljøinventar/staging:** dokumentér faktisk Microsoft-mode, callbacks, provideridentiteter, linking-/hookmuligheder, e-mailindstillinger, publiceret backend og sikre backups. Klargør isoleret staging og understøttet linkingtest; bevar kalenderopsætningen.
2. **LF2 – loginregistrering/pilot:** indstil appens egen tenantbegrænsede loginregistrering med præcise callbacks og mindst nødvendige loginrettigheder. Afprøv ændring af providerregistrering mod eksisterende Microsoft-konti; client/sub-ændringer må ikke skabe dubletter. Credentials opbevares i projektets sikre konfiguration.
3. **LF3 – udgivelse/drift:** deploy godkendte additive DB-/serverleverancer og senere frontend separat, verificér aktiv version, sæt Webflow-job/alarmer og secret-rotationsejer. Kalenderhardening fra F5 udgives som særskilt testet ændring.
4. **LF4 – udfasning:** luk gamle loginveje og tilknyttede hooks/mailindstillinger først efter F7-accept. Dokumentér sikker genaktivering af afgrænset fallback.

Ingen secrets, appregistrering eller environment deles automatisk med IT-hjælp. Eksisterende kalendersecrets genbruges ikke som genvej til loginopsætning.

## Lovable configuration – IT-hjælp

Kun fremtidige handlinger i IT-hjælp-projektet:

1. **LI1 – miljøinventar/staging:** bekræft provider-mode, claim-/linkingegenskaber, auth-oprettelsesregler, live policies, privat bucket og backup. Klargør separat staging.
2. **LI2 – intern Microsoft-provider:** egen tenantbegrænset loginregistrering og projektets præcise callbacks; verificér nye autoriserede og uautoriserede brugere samt eksisterende UUID'er.
3. **LI3 – backend/drift:** udgiv godkendte migrations/serverfunktioner, konfigurér lokal Webflow-adgang, jobs og alarmer; verificér privat Storage og afvisning før brugeråbning.
4. **LI4 – login/publicering:** publicér Microsoft-login og luk password/self-signup-veje efter pilot. Udvid ikke tenant/audience for hypotetiske eksterne brugere.

## Database changes – Frokost

**Kun forslag; ingen migrationsfil oprettes her.** Brug nye additive migrations, ikke omskrivning af historikken. Foreslåede navne er designnavne, ikke eksisterende schema.

| Forslag | Felter/invariant | Backfill/adgang |
| --- | --- | --- |
| `employee_directory` | Lokal id, source_collection_id, source_item_id, navn, kontakt-e-mail, source_active, last_seen_run, deactivated_at; unik kildepar. | Kan eksistere uden auth user; kun sync/service skriver kildefelter. |
| `app_memberships` | auth_user_id (unik), employee_id (unik), enabled, suspended_at, reason, legacy_until. | Bevar profiles.id; godkendt inventar danner mapping. Brugeren kan ikke skrive medlemskab. |
| `employee_identities` | employee_id, provider, tenant_id, object_id, issuer, client_id, provider_subject, verified_at, verification_method; unik tenant/object og højst én aktiv intern binding pr. employee. | Kun betroet server skriver; ingen tokens. Konflict må ikke overskrives med upsert. |
| `identity_migration_events` | lokal user-id, tilstand, årsag, udførende identitet, tidspunkt, korrelations-id; ingen rå token. | Audit og idempotent genoptagelse; begrænset læsning. |
| Sync-run/status | Snapshotversion, fuldstændighed, sidste succes og fejlstatus; genbrug/udvid `sync_logs` hvor passende. | Statusopdatering og medarbejderændringer koordineres; ingen adgang ud fra delvist snapshot. |
| Session-admission ved behov | Verificeret session-id, auth UUID, binding-id, metode, gyldighed/revocation. | Kun hvis broker ikke sikkert håndhæver sessionspecifik binding før udstedelse; afgøres i F2. |

Indfør testede helpers for aktuel adgang og en samlet policy/RPC-matrix. Mens `profiles.is_active` fortsat bruges af gammel kode, skal samme transaktion holde det konsistent med effektiv adgang; nye gates skal også afvise `is_active=false`. Begræns skrivning af dette felt, source-id og øvrige sikkerhedsfelter. En vellykket Webflow-sync må ikke overskrive lokal suspension.

Tilpas senere `handle_new_user` til ingen implicit admission og hold ubundne profiler utilgængelige. Bevar samtlige eksisterende data-FK'er/UUID'er. F5 kan derudover flytte rå tokenadgang bag service-role og erstatte browserens status/disconnect-kald; subscriptions og kalenderkildetabeller re-key'es ikke. Ingen drop af legacykolonner før stabil afsluttet migration.

## Database changes – IT-hjælp

Samme lokale directory/membership/identity/audit-kontrakt, tilpasset IT-hjælps migrationsmappe `drizzle/migrations`. Ingen deling af tabelinstans mellem projekter.

- Tilføj aktiv medlemskabstilstand uden at behandle alle nuværende profiler som godkendte ansatte. Afklar orphan-profiler/user_roles mod auth.users; bevar sager og historik.
- Erstat admission fra `handle_new_user`; fjern fremtidig hardcodet e-mailtildeling i en ny migration. Bevar verificerede nuværende adminroller, men kræv aktivt medlemskab og identitetsbinding.
- Opdatér `is_admin`, senere `is_it_staff`, `can_access_ticket` og `create_helpdesk_ticket` med effektiv adgang. Dæk alle SELECT/INSERT/UPDATE/DELETE- og Storage-policies; metadata og objektadgang skal være konsistente.
- Tilføj `it` i I5 og brug den til de tiltænkte sagsrettigheder, mens medlemskab/roller forbliver admin-only. Regenerér typer efter faktisk schema.
- Beskyt kilde-/identitetsfelter fra egen-profil-UPDATE. Hvis auth-FK tilføjes, må den ikke kaskadeslette historiske sager; undersøg eksisterende orphans først. Normal offboarding er statusændring, ikke auth-delete.
- Dokumentér bucketens private indstilling og regressionstest den; en metadata-policy er ikke nok ved offentlig bucket.

## Rollback strategy

Tag databasebackup og sikker providerkonfigurationsbackup før hver miljøændring; ingen credentials i Git. Prøv restore i isoleret miljø. Additive tabeller og bevarede UUID'er gør gamle appversioner mulige under overgang, men gamle serverversioner må ikke genåbne adgangshuller.

| Fejl | Rollback/reaktion |
| --- | --- |
| Microsoft-login eller linking fejler | Stop pilotudvidelse/ny binding; Frokost vender til godkendt gammel loginvej for aktive overgangsmedlemmer. Bevar mappings til undersøgelse; slet ikke konti. IT-hjælp kan holdes lukket for nye brugere. |
| Forkert source-mapping | Stop sync; genopret seneste godkendte directory-version og medlemskaber selektivt. Bevar manuelle deaktiveringer og audit; genaktivér ikke alle. |
| Forkert RLS/RPC afviser legitime brugere | Udgiv testet rettelse eller tidligere **sikker** policyvariant. Slå aldrig RLS/aktiv-kontrol globalt fra. Brug kontrolleret supportadgang. |
| Providercredentials/skift fejler | Genetabler dokumenteret konfiguration via sikker secret-kilde; forudsæt ikke, at Lovable stadig gemmer tidligere credentials. Hold særskilt fallback, hvor godkendt. |
| Kalenderregression | Stop kun den berørte nye kalenderleverance og gendan kompatibel sikker backend. Loginrollback må ikke rydde tokens, ændre kalenderregistrering eller køre historiske annulleringer igen. |

Databaserollback er normalt en fremadrettet kompatibilitetsmigration. Fuld restore kan overskrive nye frokost-/sagsdata og er sidste udvej med separat datagenopretning. Ingen force-push eller omskrivning af publiceret historik.

## Security considerations

| Risiko/scenarie | Krav og negativ test |
| --- | --- |
| Account takeover ved linking | Verificér provider og gammel ejerskabskontekst; auto-linking til eksisterende uid skal testes før adgang. Forkert oid med samme e-mail får ingen data, heller ikke via direkte API. |
| E-mailgenbrug | Deaktiveret historisk konto må ikke arves af ny source-record/oid. Ingen blind OTP-baseret genetablering af gammel historie. |
| Ændret e-mail | Samme tid/oid og source-id beholder UUID; kolliderende adresse stopper opdatering, ikke flytning af ejerskab. |
| Dubletkonto/samtidige callbacks | Unikke constraints, lås, idempotent linking; én canonical UUID. Konfliktkonti får ingen admission. |
| Stale session/inaktiv ansat | Aktuel DB-kontrol afviser næste operation efter lokal deaktivering, inkl. admin, RPC, Edge og Storage. Test allerede åbne faner og refresh. |
| Tenant mismatch/guest | Tenantkontrol plus eksplicit employee-medlemskab; gæst og ukendt intern konto afvises. Ingen domænebaseret genvej. |
| Role escalation | Ingen e-mailbootstrap, brugerændret metadata eller selvskrevne membershipfelter. Test UPDATE af profil, direkte role-insert og forged user-id. |
| Self-signup | Teknikken kan oprette auth user, men aldrig automatisk adgang. Test direkte Auth API efter fjernet UI samt OAuth-oprettelse. |
| Auth user uden profil | Neutral afvisning; kun servicekontrolleret reparation efter identitets- og source-verifikation. Ingen klientoprettet godkendelse. |
| Profil uden auth user | Bevar historik, markér orphan og afvis login/adgang; ny auth user får ikke automatisk dens data. Pending directory uden profil er derimod forventet. |
| Slettet auth user | Frokost har farlige cascade-relationer; forbyd sletning som offboarding. Ved utilsigtet sletning: spærring, genskabelsesplan fra backup og kontrolleret mapping; en ny UUID er ikke automatisk samme konto. |
| Slettet source-record | Tombstone efter fuldt snapshot; ingen datatab eller genbrug af tidligere roller til ny person. |
| Delvis/forældet sync | Ingen masse-deaktivering fra ufuldstændig liste; freshnessgrænse, alarm og lokal akut spærring. |
| Session-forveksling | Appens Supabase token kan ikke bruges i det andet projekt. Persistens af gammel mapping beviser ikke den aktuelle OAuth-session. |
| Graph-token/consent | Rå tokens server-only; kalenderkonto og login er adskilt. Loginmigration må ikke kræve ekstra Graph-consent eller tabe bestillinger. |
| Signed URLs/cache | Kort restlevetid er eksplicit begrænsning; ingen ny URL efter deaktivering. UI/cache-rydning kan ikke gøre allerede downloadede filer utilgængelige. |

## Test plan

Tests udføres senere i isoleret miljø med repræsentative auth-indstillinger; denne opgave tester dokumentationsomfang og Git-diff, ikke live sikkerhed. Testplanens acceptkriterier er release-gates.

| ID | Prøve | Acceptkriterium |
| --- | --- | --- |
| T1 | Aktiv eksisterende Frokost OTP-user, invitation-user og Microsoft-user migreres | Identisk auth/profile UUID; uændrede roller, datareferencer og antal; ingen dubletprofil. |
| T2 | Forkert tenant, personlig konto, tenant-gæst og ukendt intern konto | Ingen appdata eller mutationer, selv med gyldigt Microsoft-login eller ny auth user. |
| T3 | Samme e-mail med anden oid, genbrugt e-mail, uverificeret mail, brugerændret metadata | Ingen automatisk historik-/rolleoverførsel; konflikt registreres neutralt. |
| T4 | Navne-/e-mailændring for bundet bruger | Samme UUID og Entra-binding; ingen dublet, ingen rolleændring. |
| T5 | Åben session deaktiveres; direkte REST, RPC, Edge, refresh og realtime prøves | Ingen ny beskyttet data/handling efter lokal status-commit; UI tømmes; aktive andre brugere virker. |
| T6 | Source-pagination, 429, ugyldigt item, tom/halv liste, samtidige syncs og 24-timers stale | Intet destruktivt masseindgreb; kontrolleret freshnessadfærd og alarmer. |
| T7 | Auth uden profil, profil uden auth, source uden auth, utilsigtet slettet auth | Ingen utilsigtet adgang; pending source kan onboardes korrekt; historik bevares ved normal deaktivering. |
| T8 | Employee/user, kitchen, IT og admin samt inaktiv admin | Least privilege pr. app; aktiv Frokost-bruger kan stadig håndtere andres forplejning; IT-noter forbliver interne. |
| T9 | IT direkte signup/API, egen profil-UPDATE, ticket-RPC og manipuleret Storage-path | Ingen admission/privilegieeskalation uden medlemskab; private interne filer afvises for medarbejder. |
| T10 | Frokost kalender uden/med consent, refresh, disconnect, subscription-renewal og webhook | Login virker uden consent; eksisterende kalender virker efter migration; tokenlæsning fra browser afvises efter F5. |
| T11 | Kalender tid/lokale/titel/sletning/Graph-fejl og gentagne kald | Eksisterende konservative regler, én korrekt notifikation, ingen ubegrundet annullering. |
| T12 | Nye/eksisterende browserfaner, mobil, redirectfejl, login i begge apps, logout | Separate sessioner og ens mønster; ingen tokenoverførsel eller utilsigtet fælles logout. |
| T13 | Providerregistrering skiftes, linking gentages/parallelliseres og afbrydes halvvejs | Samme gamle UUID eller sikker konflikt/fallback; aldrig delvis admission. |
| T14 | Rollback af UI/provider/sync og sikker DB-kompatibilitet | Aktive legacy-brugere kan arbejde som aftalt; deaktiverede og uautoriserede forbliver blokeret. |

T5/T8/T9 udføres mod rigtige PostgREST/Storage/RPC-endpoints med separate bruger-JWT'er, ikke kun mocked UI. Kontroller alle faktiske deployed policies og grants. Frokosts eksisterende kalenderkode-/DB-tests genbruges og suppleres med staging-Graph-prøver. IT-hjælps lokale attachment-test kan genbruges efter integration; ingen påstand om, at den allerede er bestået i det publicerede miljø.

## Deployment sequence

1. Godkend dette design. Udfør F1/I1 inventar og LF1/LI1 miljøafklaring. Sammenlign aktuelle deploymentversioner med Git, også det eksisterende lokale sikkerheds-/testarbejde.
2. Udfør F2/I2 claim-/linking-spikes i hvert projekt. Stop Microsoft-migration ved manglende betroede claims, ukontrolleret auto-linking eller UUID-skift. Definér driftsejer og godkend syncgrænser.
3. Byg IT-hjælps additive source-/adgangsmodel, luk ubetinget admission og test hele data-/Storage-gatet i staging. IT-hjælp har endnu ikke normal drift og er første fulde loginpilot; Frokost berøres ikke af dette deployment.
4. Byg Frokosts additive model og robust sync i staging. Backfill og afklar samtlige aktive brugere. Udgiv backend/gate kompatibelt med eksisterende login og sessioner; verificér deaktivering uden at kræve Microsoft af alle.
5. Klargør og pilotér IT-hjælps tenantbegrænsede login med LI2/LI3. Bevis afvisning af uautoriserede. Udfas gamle metoder og åbn almindelig drift først efter I5/I6 og LI4.
6. Udgiv Frokosts kalenderhardening som selvstændig regressionstestet leverance. Bevar kalenderregistrering/scopes og brugerrelationer; afhængigheden er sikker kompatibilitet, ikke fusion af OAuth.
7. Pilotér Frokost-linking og Microsoft som primært login i små hold med LF2/LF3. Overvåg konflikter, afvisninger, UUID'er og kalenderdrift. Fallback og gamle aktive sessioner bevares som aftalt.
8. Afslut Frokost-overgangen med F7/LF4 efter dokumenteret dækning af aktive brugere og rollbackøvelse. Fjern legacykode i en separat oprydningsleverance efter observationsperioden.

Ingen planlagt downtime for additive trin. Providerændringer kan kræve nyt login; database-DDL kan give korte låse og skal tidsmåles i staging. Hvis nul mærkbar afbrydelse ikke kan opnås, planlægges et kort annonceret vindue før produktionsskift. Kalenderjobs fortsætter under loginmigration; ændring af selve kalenderbackend følger dens særskilte udgivelsesprocedure. Apps kan stoppe eller rulle tilbage uafhængigt.

## Open questions

Kun spørgsmål som kræver miljøbevis eller operationelt ejerskab:

1. Hvilken Microsoft-provider-mode, claim-proveniens og understøttet linking/session-admission er faktisk tilgængelig i hvert Lovable-projekt? Leveres tid/oid betroet, og bevares UUID ved overgang til egen registrering? Ejer: auth-implementør, F2/I2 + LF1/LI1.
2. Matcher deployed RLS/RPC/Storage/schema og frontend de auditerede commits, eller er det lokale active-employee/attachment-arbejde udgivet uden main-opdatering? Ejer: appansvarlige, F1/I1.
3. Er den fundne kalender-tenant Pluskontorets tilsigtede login-tenant, og hvem ejer de separate loginregistreringer, secret-rotation og sikre backups? Ejer: Entra-/Lovable-administrator.
4. Hvilken Webflow collection/fieldmapping og draft-/archived-semantik er den autoritative ansættelsesliste, og hvem opdaterer den ved fratrædelse/genansættelse? Ejer: medarbejderkildens ansvarlige.
5. Findes aktive ansatte uden entydig Webflow/auth-mapping, tidligere genbrugte adresser, dubletter eller køkkenkonti med særlige adgangsbehov? Ejer: inventar F1 og driftsansvarlig. Ingen personoplysninger i dette dokument.
6. Hvem ejer 15-minutters sync, alarmer, akut spærring i begge apps og den foreslåede 24-timers freshnessgrænse? Kan IT-hjælps 60-sekunders eksisterende signed-URL-restlevetid accepteres, eller kræves downloadproxy? Ejer: drift/sikkerhedsansvarlig.

## Implementation backlog

Alle opgaver nedenfor er **fremtidige**. Ingen er implementeret af dette dokument. F-/I-opgaver dækker repository-/databasedesign og implementering; LF-/LI-opgaver dækker de særskilte Lovable-projekthandlinger. “Ingen” downtime betyder ingen planlagt afbrydelse, forudsat bestået stagingprøve.

### Frokost

| ID / mål | Berørte områder | Risiko | Dependencies | Testkrav | Downtime |
| --- | --- | --- | --- | --- | --- |
| **F1. Verificér aktiv-bruger-adgang og identitetsinventar** | Privat read-only inventar; isoleret session/RLS/RPC/Edge-test; tokenpolicies og kalenderbaseline; afklar eksisterende lokal active-employee-branch. | Lav; fixtures kun i staging. | Designgodkendelse; LF1 miljøadgang. | T5/T8/T10 baseline; dokumentér faktisk deployment, mappings og alle sikkerhedsgrænser. | Ingen. |
| **F2. Bevis sikker claim-/provider-linking** | Auth SDK/broker, kendte gamle UUID'er, trust-boundary og sessionspecifik admission-prototype i staging. | Middel i staging; høj hvis uprøvet i drift. | F1, LF1. | T1/T2/T3/T13; dokumenteret tid/oid-proveniens, UUID-bevarelse og stop ved konflikt. | Ingen; ingen produktionsændring. |
| **F3. Tilføj directory/membership/mapping og robust sync** | Nye additive migrations, Webflow-pagination/source-id, sync-run, ikke-destruktiv offboarding, privat backfillrapport. | Høj datamappingrisiko. | F1/F2; godkendt source-semantik. | T4/T6/T7; ingen uafklaret aktiv bruger før gate; uændrede data-FK'er. | Ingen; DDL-låse måles. |
| **F4. Håndhæv aktiv adgang kompatibelt med legacy** | Samlet RLS/RPC/Edge-matrix, profilfelter, service-jobs og frontend-afvisning; nuværende OTP bevares. | Høj adgangsrisiko. | F3; LF3 backendudgivelse. | T5/T8/T14; normal aktiv legacy-session virker, inaktiv admin afvises. | Ingen forventet. |
| **F5. Beskyt kalendercredential-adgang separat** | Server-only tokens, status/disconnect-endpoints, callback-korrelation, inaktiv tokenstop, subscription-oprydning; eksisterende Graph-flow bevares. | Høj kalenderregressionsrisiko. | F1/F4; LF3 særskilt deployment. | T10/T11 samt direkte token-API-negativ test; gamle subscriptions og ordrer virker. | Ingen ved kompatibel udgivelse; evt. kort jobpause efter kalenderproceduren. |
| **F6. Implementér kontolinkning og Microsoft-pilot** | Understøttet linking, idempotent mappingaudit, evt. session-admission, login-UI og per-user overgang. | Høj takeover-/lockout-risiko. | F2/F4; LF2, LF3; F5 kalenderaccept før bred rollout. | T1/T2/T3/T4/T12/T13/T14; alle relationer og gamle sessioner verificeres. | Ingen; nyt login for pilot kan kræves. |
| **F7. Afslut migration og udfas gamle loginveje** | Aktiv brugerafstemning, invitationer, OTP/password, mailhook/kø, support- og rollbackrunbook. | Høj ved for tidlig udfasning. | F6/F5; alle aktive brugere afklaret; LF4. | T1/T5/T12/T14; gamle links giver ingen bypass, transaktions-/forplejningsmail virker fortsat. | Ingen; annonceret loginændring. |

Opgaverne er ordnet efter anbefalet produktionsrækkefølge. Kalenderhardening og kontolinkning udgives som separate leverancer.

### IT-hjælp

| ID / mål | Berørte områder | Risiko | Dependencies | Testkrav | Downtime |
| --- | --- | --- | --- | --- | --- |
| **I1. Verificér adgangsindgange og Storage i staging** | Signup/Auth-trigger, direkte API/RPC, profiler/roller, bucket/policies, eksisterende lokale attachment-tests og driftskonti. | Lav med isolerede fixtures. | Designgodkendelse; LI1. | T2/T5/T7/T9 baseline; privat bucket og metadata/objektmatrix. | Ingen. |
| **I2. Bevis Microsoft-identitet og lokal kontobevaring** | Claim-proveniens, tenant/session-admission og understøttet linking for eksisterende UUID'er. | Middel i staging. | I1/LI1. | T2/T3/T13; ingen ukontrolleret auto-linking eller nye UUID'er for gamle data. | Ingen. |
| **I3. Indfør source/medlemskab og luk automatisk adgang** | Directory/mapping, pilotallowlist eller Webflow-sync, Auth-trigger, hardcodet adminbootstrap, RLS/RPC/Storage-gate. | Høj adgangsrisiko. | I1/I2; afklaret source; LI3. | T5/T6/T7/T9; ukendt auth user får ingen data; kendt admin bevares kontrolleret. | Ingen normal drift endnu; DDL-låse måles. |
| **I4. Indfør Microsoft som normalt login** | Microsoft-UI, betroet binding, session/afvisningsflow, eksisterende kontomigration; stop signup/password efter pilot. | Middel-høj. | I3, LI2/LI3; endelig lukning LI4. | T2/T3/T4/T12/T13/T14; direkte signup giver aldrig admission. | Ingen; testbrugere kan skulle logge ind igen. |
| **I5. Gør IT/admin-roller eksplicitte** | SQL-enum/helpers/RLS, lokale rolletildelinger, TypeScript/visninger; separate adminfunktioner. | Middel-høj rettighedsrisiko. | I3; før almindelig IT-gruppedrift. | T8/T9; IT ser interne sagsdata men kan ikke eskalere roller. | Ingen forventet. |
| **I6. Driftsaccept og åbning** | Syncalarmer, offboarding, deaktiverede sessioner, support/rollback, evt. signed-URL-beslutning. | Middel. | I4/I5, LI3/LI4. | Hele relevant T2–T9/T12–T14-matrix; offboarding i begge apps dokumenteres. | Ingen. |

### Lovable – Frokost

| ID / mål | Berørte områder | Risiko | Dependencies | Testkrav | Downtime |
| --- | --- | --- | --- | --- | --- |
| **LF1. Dokumentér miljø og klargør isoleret staging** | Frokost Cloud Auth, backup, backendversioner og linkingegenskaber. | Lav; read-only i produktion. | Designgodkendelse. | Ingen prodændring; staging isoleret; F1/F2 kan gennemføres. | Ingen. |
| **LF2. Konfigurér egen intern loginregistrering** | Kun Frokosts Microsoft-provider, Entra-credentials/tenant/callbacks; ikke kalenderregistrering. | Høj loginrisiko. | F2 godkendt, F4; først staging. | T1/T2/T3/T13 og fallback. | Ingen planlagt; nyt login kan kræves. |
| **LF3. Udgiv backend/UI-trin og konfigurér syncdrift** | Frokost migrations/Edge/frontend-versioner, Webflow-job/alarmer, secret-rotation; F5 separat. | Høj. | Relevant F3/F4/F6/F5 testet enkeltvis. | Verificér deployment og T5/T6/T10/T11 for relevant trin. | Ingen forventet; mål DDL/jobpause. |
| **LF4. Luk legacy-auth efter afsluttet overgang** | Frokosts gamle login-/mailindstillinger og eventuelle hooks; bevar øvrig mail. | Høj lockout-risiko. | F7 accept og rollbackøvelse. | T1/T12/T14; alle aktive brugere dækket. | Ingen planlagt. |

### Lovable – IT-hjælp

| ID / mål | Berørte områder | Risiko | Dependencies | Testkrav | Downtime |
| --- | --- | --- | --- | --- | --- |
| **LI1. Dokumentér miljø og klargør staging** | IT-hjælp Auth, backup, live migrations/policies/private bucket og linkingmuligheder. | Lav; read-only i produktion. | Designgodkendelse. | I1/I2 kan køres isoleret; faktisk bucketstatus dokumenteret. | Ingen. |
| **LI2. Konfigurér egen intern loginregistrering** | Kun IT-hjælps provider, credentials, tenant og callbacks. | Middel-høj. | I2 godkendt; I3 gate før produktionspilot. | T2/T3/T13; egne gamle konti bevarer UUID. | Ingen normal drift endnu. |
| **LI3. Udgiv sikker backend og medarbejdersync** | IT-hjælps migrations/serverkode, Webflow-secret/job, alarmer og verificeret privat Storage. | Høj adgangsrisiko. | I3, senere I5 testet; ingen afhængighed af Frokost-deployment. | T5/T6/T8/T9; ukendt/inaktiv bruger afvist direkte. | Ingen forventet. |
| **LI4. Publicér intern loginoplevelse og luk gamle auth-veje** | IT-hjælps frontend og Auth-signup/password-indstillinger. | Middel-høj. | I4-pilot, I5, LI2/LI3; før I6-åbning. | T2/T9/T12/T14; godkendt ny medarbejder kan stadig onboardes. | Ingen planlagt. |

Efter dokumentationsleverancen afventes godkendelse. Frokost- og IT-hjælp-implementering startes som to separate app-opgaver med hver deres Lovable-leverancer.
