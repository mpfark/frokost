

## Plan: Synkronisér animation med statistik + auto-frameld ved fravær

### Problem 1: Animation bruger forkert population
`LunchCalendar.tsx` linje 173-204: `fetchActiveUserCount` tæller unikke brugere med aktivitet i perioden i stedet for at bruge det faste antal profiler med `reminder_enabled = true`. Det er præcis samme fejl som WeekdayChart havde.

### Problem 2: Fravær fjerner ikke eksisterende tilmeldinger
`AbsenceManager.tsx` linje 149: Datoer hvor brugeren allerede er tilmeldt frokost springes over (`!signupSet.has(d)`). I stedet skal eksisterende tilmeldinger (og tilhørende gæster) slettes, og erstattes med optouts.

### Ændringer

**1. `src/components/LunchCalendar.tsx` — Fix `fetchActiveUserCount`**
- Erstat hele funktionen: i stedet for at tælle brugere med aktivitet, hent antal profiler med `is_active = true` og `reminder_enabled = true`.
- Simpel query: `supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true).eq("reminder_enabled", true)`
- Sæt `activeUserCount` til dette tal.

**2. `src/components/profile/AbsenceManager.tsx` — Auto-frameld ved fravær**
- Linje 149: Fjern `!signupSet.has(d)` filteret, så datoer med eksisterende tilmeldinger også inkluderes.
- Tilføj efter linje 147: Slet eksisterende tilmeldinger for de valgte datoer (dette sletter også gæster via cascade/trigger).
- Ny logik i `handleSubmit`:
  1. Find datoer med eksisterende signups: `datesToRemoveSignup = allWeekdays.filter(d => !closedSet.has(d) && signupSet.has(d) && !optoutSet.has(d))`
  2. Slet disse signups: `supabase.from("lunch_signups").delete().eq("user_id", userId).in("lunch_date", datesToRemoveSignup)`
  3. Opret optouts for alle ikke-lukkede, ikke-allerede-frameldte datoer: `datesToOptout = allWeekdays.filter(d => !closedSet.has(d) && !optoutSet.has(d))`

### Filer der ændres
- `src/components/LunchCalendar.tsx` — fetchActiveUserCount
- `src/components/profile/AbsenceManager.tsx` — handleSubmit

