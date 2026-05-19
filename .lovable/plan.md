## Mål

Forberede kodebasen til en multi-tenant SaaS-arkitektur, hvor flere virksomheder kan bruge Plusfrokost, og hvor de enkelte funktioner (Frokost, Forplejning, Køkken, Microsoft-integration, Webflow m.fl.) kan slås til/fra pr. virksomhed som moduler.

Dette er en **forberedende refaktor** — vi bygger ikke selve multi-tenancy nu, men fjerner de antagelser, der gør det svært senere.

---

## Hvad i den nuværende kode står i vejen?

### 1. Implicit "én virksomhed" overalt
- `company_settings` er en singleton-tabel (ingen `id` bruges som filter — koden henter bare `.single()` eller første række).
- `allowed_domain`, farver, påmindelser, mødelokaler, lokationer ligger alle her uden tenant-tilhørsforhold.
- Edge functions (`send-weekly-lunch-reminder`, `webflow-sync`, `calendar-webhook`, `reconcile-room-bookings`) antager én global konfiguration.

### 2. Data-tabeller mangler `company_id` / `tenant_id`
Følgende tabeller er fælles, men bør være tenant-scoped: `profiles`, `user_roles`, `lunch_signups`, `lunch_optouts`, `guests`, `catering_orders`, `closed_dates`, `invitations`, `invitation_batches`, `kitchen_notifications`, `user_notifications`, `graph_subscriptions`, `microsoft_tokens`, `push_subscriptions`, `webflow_sync_settings`, `sync_logs`, `email_send_log`.

### 3. Roller er kun "platform-flade"
`app_role` indeholder kun `admin`, `kitchen`, `user`. Der findes ikke en **super-/platform-admin** rolle, der kan se på tværs af virksomheder.

### 4. RLS bruger kun `auth.uid()` + rolle, ikke tenant
Alle policies som `has_role(auth.uid(), 'admin')` giver i dag adgang til ALT i tabellen. Med flere tenants vil en admin i firma A ellers kunne se firma B's data.

### 5. Moduler er hardcoded i UI
- `App.tsx` har faste routes.
- `Index.tsx` har faste tabs (`calendar`, `outlook`, `kitchen`, `admin`, `profile`) med rolle-checks indlejret.
- `AdminPanel.tsx` har faste tabs (Brugere, Invitationer, Indstillinger, Importer, Statistik).
- Der findes ingen "feature flag" / modul-registry, der siger *"denne virksomhed har Forplejning aktiveret"*.

### 6. Branding og indstillinger hentes globalt
`useCompanyColors` henter den ene `company_settings` ved app-start. I en multi-tenant verden skal det afhænge af hvilken tenant brugeren tilhører (eller subdomæne).

### 7. Edge functions bruger service role uden tenant-context
F.eks. cron-jobs til påmindelser og Webflow-sync løber over hele DB'en. De skal kunne loope over virksomheder.

### 8. Microsoft / Webflow / VAPID secrets er globale
`AZURE_CLIENT_ID`, `WEBFLOW_API_TOKEN` osv. ligger som platform-secrets. Pr. tenant skal disse kunne overrides (eller knyttes til virksomheden i DB).

### 9. Invitations bruger e-maildomæne som "tenant proxy"
`restrict_signup_to_domain` + `allowed_domain` er den eneste tenant-grænse i dag. Det skal erstattes af eksplicit `company_id`.

---

## Foreslåede ændringer (prioriteret)

### Fase 1 — Introducér tenant-begrebet i DB (ikke-brydende)

```text
companies
├── id (uuid)
├── slug                  // bruges til subdomæne / routing
├── name
├── allowed_domain
├── is_active
└── created_at

company_modules           // hvilke moduler er tændt for tenant
├── company_id
├── module_key            // 'lunch' | 'catering' | 'kitchen' | 'webflow' | 'microsoft' | …
├── is_enabled
└── config (jsonb)        // per-modul konfiguration
```

- Flyt indholdet af `company_settings` ind på `companies` + flyt modul-specifik config (mødelokaler, Webflow-keys, Microsoft-tenant osv.) til `company_modules.config`.
- Tilføj `company_id uuid` på alle tenant-data tabeller (profiles, lunch_signups, catering_orders, invitations, …). Backfill med den ene eksisterende virksomhed.
- Tilføj `platform_admin` til `app_role`-enum.

### Fase 2 — Opdatér RLS

- Indfør hjælpefunktion `current_company_id()` (security definer, slår op via profiles).
- Alle eksisterende policies udvides: `has_role(auth.uid(), 'admin') AND company_id = current_company_id()`.
- `platform_admin` får adgang på tværs.
- Edge functions: ændr alle queries til at filtrere på `company_id` — typisk hentet fra request-bruger eller looped i cron.

### Fase 3 — Frontend modul-registry

Lav et lille registry, så UI'et drives af data i stedet for hardcoded tabs/routes:

```text
src/modules/
├── registry.ts           // { key, label, icon, route, AdminTab?, NavTab?, requires:[role] }
├── lunch/
├── catering/
├── kitchen/
├── admin-users/
└── …
```

- `Index.tsx`-tabs og `AdminPanel.tsx`-tabs bygges ved at filtrere registry mod `enabledModules` for nuværende tenant + brugerens roller.
- `App.tsx` routes bygges på samme måde.
- `useEnabledModules()` hook henter fra `company_modules`.

### Fase 4 — Tenant-resolution i klienten

- Hook `useCurrentCompany()` — slår op via brugerens `profiles.company_id`, eller via subdomæne (`acme.frokost.pluskontoret.dk`) for login-siden.
- `useCompanyColors` + branding læser fra `companies` i stedet for global `company_settings`.

### Fase 5 — Platform-admin

- Ny route `/platform` der kun `platform_admin` har adgang til.
- CRUD på `companies`, aktivér/deaktivér moduler, se på tværs af tenants, billing-hook (senere).

### Fase 6 — Edge functions tenant-aware

- Cron-jobs (`send-weekly-lunch-reminder`, `reconcile-room-bookings`, `webflow-sync`, `renew-graph-subscriptions`) looper over `companies WHERE is_active AND module 'X' enabled`.
- Per-tenant secrets/config læses fra `company_modules.config` (ikke env vars). Lad Microsoft Azure-app og Resend forblive platform-wide.

---

## Hvad kan vi gøre **i dag** uden at bygge multi-tenancy endnu?

For at undgå at male sig op i et hjørne, anbefaler jeg som første konkrete skridt:

1. **Tilføj `company_id` til alle tenant-tabeller** med default = den ene eksisterende virksomhed. Gør det nu, mens datasættet er lille.
2. **Lav et frontend-modul-registry** og refaktorér `Index.tsx` + `AdminPanel.tsx` til at bygge tabs fra registry. Ingen funktionel ændring, men fremtidige moduler bliver plug-in.
3. **Erstat singleton `company_settings`** med en `useCompanySettings(companyId)`-hook der *teknisk* kan håndtere flere, selvom der p.t. kun er én.
4. **Introducér `platform_admin`-rolle** og en stub `/platform`-side.
5. **Dokumentér modul-grænseflader**: hver mappe under `src/components/{module}` får en `index.ts` der eksporterer dens routes, admin-tabs og evt. cron-handlers.

Disse fem trin er ikke-brydende, kan laves trinvist, og lægger fundamentet — uden at vi behøver bygge selve multi-tenancy nu.

---

## Spørgsmål til dig inden vi går videre

- Vil du have, at jeg **starter med trin 1–5 ovenfor** som en konkret refaktor-PR?
- Eller foretrækker du, at jeg **kun laver frontend-modul-registret** først (trin 2+3), så strukturen er på plads, og DB-migration kommer senere?
- Skal tenants adskilles via **subdomæne** (acme.frokost.pluskontoret.dk) eller via **bruger-login → vælg firma**?
