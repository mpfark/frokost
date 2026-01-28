
# Synkroniser beregningslogik mellem Statistik og Uge-animation

## Problem identificeret

Der er en uoverensstemmelse i hvordan "aktive brugere" beregnes:

| Sted | Metode | Resultat for torsdag |
|------|--------|----------------------|
| **WeekdayChart (Statistik)** | Kun brugere med mindst én aktivitet i perioden | 43/43 = **100%** |
| **LunchCalendar (Animation)** | Alle aktive profiler | 43/48 = **89.6%** |

Det er derfor animationen ikke trigges - LunchCalendar sammenligner med 48 brugere, mens statistikken kun ser på de 43 der faktisk har deltaget.

## Løsning

Opdater `LunchCalendar.tsx` til at bruge samme beregningslogik som `WeekdayChart.tsx`:
- Beregn `activeUserCount` baseret på brugere der har **mindst én tilmelding eller afmelding** i den viste periode (ugerne der vises)
- Dette matcher den nyligt implementerede ændring i statistikmodulet

## Implementation

### LunchCalendar.tsx - Opdater `fetchActiveUserCount`

Nuværende logik:
```text
1. Hent alle aktive profiler
2. Fjern køkkenbrugere
3. Brug dette tal som activeUserCount
```

Ny logik:
```text
1. Hent alle signups og optouts for den viste periode
2. Find unikke user_ids fra disse
3. Fjern køkkenbrugere fra dette sæt
4. Brug dette tal som activeUserCount
```

Konkret kodeændring i `fetchActiveUserCount`:
```typescript
const fetchActiveUserCount = async () => {
  // Get the date range for displayed weeks
  const startDate = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const endDate = format(
    endOfWeek(addWeeks(today, weeksToDisplay - 1), { weekStartsOn: 1 }), 
    "yyyy-MM-dd"
  );

  // Fetch signups and optouts for the period
  const [signupsRes, optoutsRes, kitchenRolesRes] = await Promise.all([
    supabase
      .from("lunch_signups")
      .select("user_id")
      .gte("lunch_date", startDate)
      .lte("lunch_date", endDate),
    supabase
      .from("lunch_optouts")
      .select("user_id")
      .gte("lunch_date", startDate)
      .lte("lunch_date", endDate),
    supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "kitchen"),
  ]);

  // Find unique users with activity
  const kitchenIds = new Set((kitchenRolesRes.data || []).map(r => r.user_id));
  const usersWithActivity = new Set<string>();
  
  (signupsRes.data || []).forEach(s => usersWithActivity.add(s.user_id));
  (optoutsRes.data || []).forEach(o => usersWithActivity.add(o.user_id));
  
  // Remove kitchen users
  kitchenIds.forEach(id => usersWithActivity.delete(id));
  
  setActiveUserCount(usersWithActivity.size || 1);
};
```

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `src/components/LunchCalendar.tsx` | Opdater `fetchActiveUserCount` til kun at tælle brugere med aktivitet i perioden |

## Konsekvenser

- **Konsistens**: Animationen vil nu matche statistiksiden
- **Animationen trigges**: Torsdag vil nu vise 100% (43/43) og trigge animationen
- **Samme logik overalt**: Begge steder bruger nu "brugere med aktivitet" som basis
