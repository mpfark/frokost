
# Plan: Ret svarprocent-beregning i WeekdayChart

## Problem identificeret

WeekdayChart.tsx har en inkonsistens i beregningen af svarprocent:

- **Tæller**: Inkluderer ALLE brugere (inkl. køkkenbrugere) der har tilmeldt/afmeldt sig
- **Nævner**: Ekskluderer køkkenbrugere fra "aktive brugere i perioden"

Dette resulterer i svarprocenter over 100% når køkkenbrugere tilmelder sig.

### Eksempel fra databasen
| Dato       | Brugere inkl. køkken | Nævner (ekskl. køkken) | Fejlagtig % |
|------------|---------------------|------------------------|-------------|
| 2026-02-04 | 48                  | 47                     | 102.1%      |
| 2026-02-05 | 48                  | 47                     | 102.1%      |

---

## Løsning

Filtrér køkkenbrugere fra OGSÅ i tælleren - altså når vi tæller brugere der har svaret pr. dag.

### Ændring i WeekdayChart.tsx

**Før (linje 88-101):**
```typescript
signups.forEach((s) => {
  const date = parseISO(s.lunch_date);
  const dayIndex = getDay(date);
  if (dayIndex >= 1 && dayIndex <= 5) {
    weekdayStats[dayIndex].signups++;
    weekdayStats[dayIndex].dates.add(s.lunch_date);
    // Tæller ALLE brugere inkl. køkken
    if (!weekdayStats[dayIndex].usersWithChoice.has(s.lunch_date)) {
      weekdayStats[dayIndex].usersWithChoice.set(s.lunch_date, new Set());
    }
    weekdayStats[dayIndex].usersWithChoice.get(s.lunch_date)!.add(s.user_id);
  }
});
```

**Efter:**
```typescript
signups.forEach((s) => {
  const date = parseISO(s.lunch_date);
  const dayIndex = getDay(date);
  if (dayIndex >= 1 && dayIndex <= 5) {
    // Skip kitchen users for response rate calculation
    if (kitchenIds.has(s.user_id)) return;
    
    weekdayStats[dayIndex].signups++;
    weekdayStats[dayIndex].dates.add(s.lunch_date);
    if (!weekdayStats[dayIndex].usersWithChoice.has(s.lunch_date)) {
      weekdayStats[dayIndex].usersWithChoice.set(s.lunch_date, new Set());
    }
    weekdayStats[dayIndex].usersWithChoice.get(s.lunch_date)!.add(s.user_id);
  }
});
```

Samme ændring for optouts-løkken (linje 103-116).

---

## Tekniske detaljer

### Fil der ændres
- `src/components/statistics/WeekdayChart.tsx`

### Påvirkning
- Svarprocenter vil nu maksimalt være 100%
- Køkkenbrugeres tilmeldinger/afmeldinger vises stadig i grafen (signupAvg/optoutAvg), men tælles ikke i svarprocent
- Ingen ændring af eksisterende database eller andre komponenter

### Alternative løsninger overvejet
1. **Inkludér køkkenbrugere i nævneren**: Afvist, da køkkenbrugere ikke forventes at skulle svare
2. **Vis køkkenbrugeres svar separat**: Overkomplekst for dette use case
