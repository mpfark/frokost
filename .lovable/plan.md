

## Plan: Per-bruger påmindelsesindstilling + statistik-ekskludering

### Problem
Reminder-systemet sender til alle aktive brugere uden tilmeldinger, men nogle brugere (f.eks. deltidsansatte, køkkenpersonale) bør ikke modtage påmindelser. Disse "falske inaktive" skævvrider også statistikken.

### Løsning
Tilføj et `reminder_enabled`-flag per bruger. Brugere med `reminder_enabled = false`:
- Modtager ingen ugentlige påmindelser
- Udgår af statistik (svarprocent, "uden tilmeldinger"-listen, brugeraktivitetstabellen)

### Ændringer

**1. Database-migration**
- Tilføj `reminder_enabled boolean NOT NULL DEFAULT true` til `profiles`-tabellen.

**2. UserManagement.tsx — admin UI**
- Tilføj en klokke-ikon-knap per bruger (samme mønster som admin/køkken-knapperne).
- Aktiv = modtager påmindelser (default). Klik slår til/fra.
- Tooltip: "Modtager påmindelser" / "Ingen påmindelser".

**3. Edge function: send-weekly-lunch-reminder**
- Tilføj `.eq("reminder_enabled", true)` til profil-queryen, så brugere med flaget slået fra springes over.

**4. Statistik — ekskluder brugere uden påmindelser**
- `WeekdayChart.tsx`: Hent `reminder_enabled` fra profiler og filtrér brugere med `false` fra beregningen af svarprocent.
- `UserActivityTable.tsx`: Ekskluder brugere med `reminder_enabled = false` fra "uden tilmeldinger"-listen og top-10-listen.
- `StatisticsOverview.tsx`: Ekskluder fra KPI-beregninger (hvis relevant).

### Tekniske detaljer

**Filer der ændres:**
- SQL migration: 1 kolonne
- `src/components/UserManagement.tsx`: Toggle-knap + save-logik
- `supabase/functions/send-weekly-lunch-reminder/index.ts`: Filter i query
- `src/components/statistics/WeekdayChart.tsx`: Filtrér population
- `src/components/statistics/UserActivityTable.tsx`: Filtrér population

**Ingen breaking changes** — default er `true`, så alle eksisterende brugere fortsætter som hidtil.

