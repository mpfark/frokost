

## Plan: Fix svarprocent-nævner og "Uden tilmeldinger"-definition

### Problem
WeekdayChart bruger `usersWithActivity` (brugere der har lavet mindst ét valg i perioden) som nævner — ikke det totale antal aktive profiler. Hvis 40 ud af 50 har svaret, bliver nævneren 40, og mandag viser 40/40 = 100%. Den korrekte beregning er 40/50 = 80%.

Derudover skal "Uden tilmeldinger" i UserActivityTable ændres til "Uden aktive valg" — dvs. brugere der hverken har tilmeldt sig eller frameldt sig.

### Databaseverifikation
Tjekket med faktiske data denne uge: 50 aktive profiler, 40 med valg pr. dag → korrekt svarprocent er ~80%.

### Ændringer

**1. WeekdayChart.tsx**
- Ændr `activeUserCount` fra `usersWithActivity.size` til antal profiler med `reminder_enabled = true`.
- Hent dette tal fra `profilesRes.data` i stedet for at bygge et set fra signups/optouts.

**2. UserActivityTable.tsx**
- Ændr "Uden tilmeldinger"-listen til at vise brugere uden nogen aktive valg (hverken signup eller optout).
- Hent optouts i perioden og tjek om brugeren har mindst ét valg.
- Opdater label fra "Uden tilmeldinger" til "Uden aktive valg".

### Filer der ændres
- `src/components/statistics/WeekdayChart.tsx` — brug totalt antal aktive profiler som nævner
- `src/components/statistics/UserActivityTable.tsx` — inkludér optouts i aktivitetstjek

