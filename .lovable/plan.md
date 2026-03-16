

## Plan: Opdater statistik med fravær og påmindelses-filtrering

### Problem
StatisticsOverview tæller stadig alle aktive profiler i "Brugere i systemet" uden at filtrere `reminder_enabled`. WeekdayChart tæller brugere med meldt fravær (optouts) som "ikke svaret" — men de har aktivt frameldt sig og bør trækkes fra populationen for den specifikke dato.

### Ændringer

**1. StatisticsOverview.tsx**
- Ændr "Brugere i systemet" KPI til kun at tælle profiler med `reminder_enabled = true` (i stedet for alle aktive).
- Opdater label fra "Aktive brugere (is_active)" til "Aktive brugere (ekskl. uden påmindelser)".
- Filtrér signups fra brugere med `reminder_enabled = false` ud af alle KPI-beregninger (tilmeldinger, gns/dag, unikke brugere, fravær, fremmøde).

**2. WeekdayChart.tsx**
- Hent optouts i perioden og brug dem til at reducere populationen per dato: for hver dato trækkes brugere med optout fra `activeUserCount`.
- Resultat: en bruger der har meldt fravær mandag tæller ikke som "manglende svar" den dag.

**3. UserActivityTable.tsx**
- Allerede korrekt filtreret på `reminder_enabled`. Ingen ændring nødvendig.

**4. SignupChart.tsx & DietaryChart.tsx**
- Disse viser rå tal (antal tilmeldinger/gæster pr. dag, kostrestriktioner) og er ikke baseret på en population. Ingen ændring nødvendig — de skal vise faktisk aktivitet uanset påmindelsesstatus.

### Tekniske detaljer

**StatisticsOverview**: Tilføj en query for profiler med `reminder_enabled = false` og byg et `excludedUserIds`-set. Filtrér signups og optouts med dette set før beregninger. Ændr `activeProfilesRes` til at tilføje `.eq("reminder_enabled", true)`.

**WeekdayChart**: Hent alle optouts i perioden med `user_id` og `lunch_date`. Byg en `Map<string, Set<string>>` (dato → set af fraværende user_ids). I response rate-beregningen: `denominator = activeUserCount - absentUsersForDate.size` per dato.

