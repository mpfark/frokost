# Cross-app alignment

Gælder Frokost `main` (`5a5e1d6`) og IT-hjælp `main` pr. 28. september 2026. Bygger på begge `PRODUCT_INTENT.md` og den enslydende `PLUSKONTORET_APP_STANDARD.md`. Anbefalinger, ingen implementering.

## Shared direction

Begge apps skal være interne, enkle Pluskontoret-produkter med fælles loginoplevelse, genkendelige designregler og databasehåndhævet adgang. Frokost bevarer frokost/forplejning og bredt samarbejde om ordrer; IT-hjælp bevarer enkel sagsbehandling og fortrolige interne noter. Sikkerhedsgrænser kommer før kosmetisk refaktorering.

## Authentication

Begge bruger i dag Lovable Cloud Auth til Microsoft OAuth og Supabase til session/data. Frokost har desuden OTP, invitationer, Auth-mailhook og særskilt Microsoft OAuth til kalender; IT-hjælp har password/signup. Mål: samme enkle login-side med “Log ind med Microsoft”, efterfulgt af **app-specifik server-/DB-kontrol** af aktiv medarbejder og rolle. Microsoft-login alene giver ikke adgang. Bind eksisterende auth users til Entra-identitet før gamle providers fjernes; test sessionfornyelse, logout, deaktivering og inviterede eksisterende brugere. Behold Frokosts separate Graph-consent, hvis kalenderens scopes kræver det. Undgå at dele Supabase-projekt eller global session alene for visuel SSO.

## User identity

Nuværende Frokost-kæde er Webflow-e-mail → invitation/auth user → `profiles.id`/`webflow_id` → `user_roles`; Microsoft Graph-tokens er bundet til Supabase user ID. IT-hjælp opretter profil/employee-rolle fra `auth.users` og har hverken Webflow-id eller Entra-id. E-mail er nyttig til visning og match ved overgang, men ikke sikker permanent nøgle ved adresseændring. Registrér verificeret Entra tenant ID + object ID (eller anden stabil provider-subjektclaim) sammen med app-lokalt Supabase ID; migrér med eksplicit mapping og dubletkontrol.

| Mulighed | Fordel | Ulempe / vurdering |
| --- | --- | --- |
| A. Separate brugerbaser med samme Microsoft identity | Enkel drift og app-isolation | Deaktivering/medarbejderdata kan drive fra hinanden; kræver samme stabil-id-regel. God som første tekniske trin. |
| B. Central brugerbase | Én livscyklus og færre dubletter | Ny kritisk service, datamigration og tværgående driftsafhængighed. For tung nu. |
| C. Webflow som fælles medarbejderkilde med app-profiler | Genbruger faktisk HR-/medarbejderkilde, separate roller/RLS | Sync og e-mailændringer skal gøres robuste; adgang skal stadig valideres server-side. Anbefalet retning. |

Anbefaling: C, implementeret som separate appdatabaser med samme stabile Microsoft-identitet (A som teknisk form). Webflow afgør aktiv medarbejderstatus; Microsoft autentificerer personen; hver app ejer egne profiler, roller og rettigheder. Central database er kun relevant, hvis reel drift senere kræver det.

## Design

Begge bruger Lucide og shadcn/Radix-lignende komponenter, men Frokost er React 18/Tailwind 3 med CSS tokens og dynamiske firmafarver; IT-hjælp er React 19/Tailwind 4 med mange direkte `slate`/`blue`-klasser. Login-sider, knapper, kort, dialoger, badges, toast, fejltekst, font-/spacing-skala og mobilnavigation bør sammenlignes med konkrete skærmbilleder. Fastlæg ét Pluskontoret-token-sæt og korte danske fejl-/succesbeskeder. Frokosts farvevalg fra `companies`/`company_settings` bør erstattes først efter at driftsindstillinger er skilt fra branding. Hold Frokosts kalenderorienterede og IT-hjælps sagsorienterede navigation forskellige.

| Område | Konkret standardisering |
| --- | --- |
| Login/session | Samme overskrift, Microsoft-knap, loading/fejl og autorisationsbesked; samme testmatrix, ikke nødvendigvis samme auth-kode. |
| Tokens/font | Primær, muted, accent, destructive, border, typografisk skala og max-bredder fra standarden. |
| Komponenter | Button, Input, Card, Dialog/AlertDialog, Tabs, Badge, Toast, Skeleton og date picker med samme varianter/spacing. |
| Navigation | Ikon + tekst når pladsen tillader det; tydelig aktiv tilstand og mobiladgang uden hover. |
| Fejl | Oversæt tekniske Supabase/Graph-fejl til handlingsanvisende dansk. |

## What should NOT be shared

App-specifikke roller (`user/kitchen/admin` mod `employee/IT/admin`), RLS, databaser/tabeller, Frokosts kalenderreconciliation og cateringregler, IT-hjælps interne note-/filrettigheder, samt produktnavigation. Ingen fælles tenant- eller ITSM-platform. Fælles identitet betyder ikke fælles service-role credentials.

## Possible future shared components

Kun hvis samme mønster er kopieret og stabilt i begge apps: login-shell, design tokens, Button/Card/Dialog-varianter, Toast/fejloversættelse. De forskellige React/Tailwind-versioner gør et fælles package dyrt nu; begynd med dokumenterede tokens og visuelle acceptkriterier i hver app.

## Recommended sequence

1. Verificér først IT-hjælps private Storage/RLS og begge apps' aktive-medarbejder-gate. Ret bekræftede huller i særskilte migrations.
2. Beslut Entra-claim og Webflow-livscyklus; kortlæg eksisterende brugere, e-mailændringer, auth users og roller uden at slette data.
3. Migrér en app ad gangen til Microsoft-only app-login med tydelig fallback/rollback; behold Frokosts særskilte kalenderautorisation efter behov.
4. Fastlæg tokens, typografi og login-/feedbackmønstre; implementér lokalt i hver app og visuelt QA på desktop/mobil.
5. Overvej fælles komponentkode først efter flere dokumenteret identiske komponenter og kompatible toolchains. Behold produktlogik og databaseadgang lokalt.
