## Strategi: byg domæne-agnostisk, plug platform-domænet ind senere

Da admin-domænet endnu ikke er valgt, bygger vi tenant-resolveren så den **ikke** afhænger af et hardcoded hostname. I stedet markerer vi i DB hvilke virksomheder der findes, og lader alt "ukendt domæne" eller en eksplicit env-variabel pege på platform-mode. Når dit nye admin-domæne er klart, peger du det bare på projektet og sætter én env-variabel — ingen kodeændringer.

---

## Tenant-resolution uden hardcoded hostnames

Logik ved app-start (`src/lib/tenant-resolver.ts`):

```text
hostname = window.location.hostname

1. Hvis hostname === VITE_PLATFORM_HOST  → mode: 'platform'
2. Slå op: companies WHERE custom_domain = hostname
   - fundet → mode: 'tenant', company = X
   - ikke fundet:
       a. Hvis kun ÉN aktiv virksomhed findes → mode: 'tenant', company = den ene
          (overgangsfase — så frokost.lovable.app og preview-URL'er virker)
       b. Ellers → mode: 'platform' (login som platform-admin eller "vælg firma")
```

**Hvorfor det her er rart nu:**
- I dag findes kun Pluskontoret → alle hostnames (custom + lovable.app + preview) lander på Pluskontoret via fallback (2a). Intet går i stykker.
- Når du tilføjer firma nr. 2, skal hvert firma have `custom_domain` udfyldt, og fallback'en deaktiveres automatisk.
- Når dit admin-domæne er klart, sætter du `VITE_PLATFORM_HOST=admin.ditdomæne.dk` og er færdig.

---

## DB-ændringer (Fase 1)

```text
companies
├── id (uuid, pk)
├── slug                // 'pluskontoret'
├── name                // 'Pluskontoret'
├── custom_domain       // 'frokost.pluskontoret.dk' (unique, nullable)
├── allowed_domain      // 'pluskontoret.dk'
├── primary_color, secondary_color, accent_color
├── is_active
└── created_at

company_modules
├── company_id
├── module_key          // 'lunch' | 'catering' | 'kitchen' | 'webflow' | 'microsoft'
├── is_enabled
└── config jsonb
```

- Backfill: én række i `companies` for Pluskontoret med `custom_domain='frokost.pluskontoret.dk'`, kopiér farver/allowed_domain fra `company_settings`.
- Tilføj `company_id uuid` på alle tenant-tabeller (default = Pluskontoret-id, NOT NULL efter backfill).
- Tilføj `platform_admin` til `app_role`-enum.
- Behold `company_settings`-tabellen et stykke tid for at undgå brydende ændringer — læs nye felter fra `companies`, men fald tilbage til `company_settings` indtil alt er migreret.

---

## Frontend-ændringer

1. **`src/lib/tenant-resolver.ts`** — hostname → `{mode, company}` (logikken ovenfor).
2. **`src/hooks/useCurrentCompany.ts`** — exposer resolved company til hele appen via context.
3. **`src/hooks/useCompanyColors.ts`** — læser farver fra `companies` (via current company), ikke længere singleton `company_settings`.
4. **`src/App.tsx`** — wrappes med `<TenantProvider>`. Hvis `mode === 'platform'` → render kun platform-routes (`/platform/*`, login). Ellers render eksisterende routes som i dag.
5. **`src/modules/registry.ts`** — `{ key, label, icon, route, AdminTab?, NavTab?, requires:[role] }` for hver modul. `Index.tsx` og `AdminPanel.tsx` bygger tabs ved at filtrere registry mod `useEnabledModules()` + brugerens roller.
6. **Stub platform-side** — `src/pages/platform/Companies.tsx` med liste/CRUD af firmaer (kun `platform_admin`).

---

## RLS (Fase 2 — kan vente til efter Fase 1 er stabil)

- Hjælpefunktion `current_company_id()` (security definer) — slår op via `profiles.company_id`.
- Alle policies udvides: `has_role(auth.uid(), 'admin') AND company_id = current_company_id()`.
- `platform_admin` får cross-tenant adgang.
- Edge functions filtrerer på `company_id`; cron-jobs looper over `companies WHERE is_active`.

---

## Hvad du selv skal gøre senere (når admin-domænet er klart)

1. Køb domænet i **Project Settings → Domains** (eller koble eksisterende).
2. Tilføj `VITE_PLATFORM_HOST=<dit-admin-domæne>` i env.
3. Tildel din egen bruger `platform_admin`-rollen via SQL.
4. Push genstarter — `admin.ditdomæne.dk` viser nu platform-UI, `frokost.pluskontoret.dk` viser Pluskontorets app uændret.

**Bemærk om frokost.lovable.app:** Det forbliver tilgængeligt som "fallback til eneste aktive firma" indtil du har mere end ét firma. Det er fint som intern test-URL, men brug **ikke** lovable.app-domænet til e-mail-links eller produktion (din eksisterende constraint om `frokost.pluskontoret.dk` som primær gælder stadig).

---

## Rækkefølge / faser

```text
Fase 1 — DB-fundament + tenant-resolver (denne PR)
   ├── Migration: companies, company_modules, company_id på tabeller, platform_admin-rolle
   ├── tenant-resolver.ts + useCurrentCompany context
   ├── useCompanyColors læser fra companies
   └── Backfill Pluskontoret som første firma

Fase 2 — Frontend modul-registry
   ├── src/modules/registry.ts
   ├── Refaktorér Index.tsx + AdminPanel.tsx til registry-drevet
   └── useEnabledModules()

Fase 3 — Platform-stub
   ├── /platform/* routes bag platform_admin-rolle
   └── Companies-CRUD UI

Fase 4 — RLS-stramning (når data faktisk er multi-tenant)
   ├── current_company_id()
   ├── Udvid alle policies med company_id-filter
   └── Edge functions tenant-aware

Fase 5 — Skift fallback fra (Pluskontoret som default) til (kræv eksplicit match)
   └── Når andet firma bliver oprettet
```

---

## Spørgsmål inden vi går i gang

1. **Skal jeg starte Fase 1 + Fase 2 nu** (DB-fundament + frontend-modul-registry uden RLS-ændringer)? Det er ikke-brydende, og du kan tilføje platform-domænet hvornår som helst senere.
2. **Bruger pr. firma**: skal én bruger kunne tilhøre flere firmaer (kræver `company_members` join-tabel og firma-switcher), eller én bruger = ét firma (enklere, `company_id` direkte på `profiles`)? Anbefaler det sidste til start.
