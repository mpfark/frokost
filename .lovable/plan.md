

## Plan: Fix fejlagtig uge-fejring for almindelige brugere + dæmpet "Komplet"-farve

### Årsag til fejl

Der er **to RLS-problemer** der tilsammen gør fejringen forkert for almindelige brugere som Ane:

1. **`activeUserCount` returnerer 1**: `profiles`-tabellen har RLS der kun lader brugere se deres egen profil. Når Ane kalder `fetchActiveUserCount`, returnerer `count` = 1 (kun hendes egen). Med `activeUserCount = 1` har ALLE dage "100% svar" og "fuld tilmelding", fordi der altid er mindst én tilmelding.

2. **`allOptouts` returnerer kun egne**: `lunch_optouts` har kun SELECT-policy for egne optouts. Så selv hvis vi fixer population-tallet, vil fejringsberegningen mangle andre brugeres frameldinger.

### Ændringer

**1. Database migration — `get_active_user_count()` funktion**
- Opret en `SECURITY DEFINER` funktion der tæller profiler med `is_active = true` og `reminder_enabled = true`.
- Sikker fordi den kun returnerer et tal, ingen brugerdata.

**2. Database migration — RLS på `lunch_optouts`**
- Tilføj SELECT-policy: alle autentificerede brugere kan se alle optouts (ikke sensitivt data — kun user_id + dato).
- Dette gør at fejringsberegningen kan se alle brugeres frameldinger.

**3. `src/components/LunchCalendar.tsx` — Brug ny funktion**
- Erstat `fetchActiveUserCount`: kald `supabase.rpc('get_active_user_count')` i stedet for at query profiles-tabellen direkte.

**4. `src/components/LunchCalendar.tsx` — Dæmpet "Komplet"-farve**
- Ændr `border-green-500` → `border-green-300 dark:border-green-700`
- Ændr `bg-green-50` → `bg-green-50/60`
- Ændr `ring-green-500/30` → `ring-green-300/20`
- Ændr `text-green-600` → `text-green-500 dark:text-green-500`
- Generelt gør den grønne indikation mere dæmpet og subtil.

### Filer der ændres
- Database: ny `get_active_user_count()` funktion + ny RLS-policy på `lunch_optouts`
- `src/components/LunchCalendar.tsx` — brug RPC + dæmpet styling

