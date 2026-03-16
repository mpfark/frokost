

## Plan: Fix svarprocent-beregning i WeekdayChart

### Problem
Beregningen trækker fraværende brugere (optouts) fra populationen (nævneren), men tæller dem samtidig med i tælleren (`usersWithChoice`). Det giver over 100%: en bruger der melder fravær tæller som "har svaret" men reducerer også den population man dividerer med.

Eksempel: 40 brugere, 40 har svaret (inkl. 2 optouts). Nuværende beregning: `40 / (40 - 2) = 105%`.

### Løsning
Forenkl beregningen:
- **Nævner (population)**: Antal aktive profiler med `reminder_enabled = true` — fast tal, ingen fradrag for optouts
- **Tæller**: Antal unikke brugere der har foretaget et valg (signup ELLER optout) på den dato

Altså: `svarprocent = brugere_der_har_svaret / alle_aktive_brugere * 100`

### Ændring i WeekdayChart.tsx

Fjern linje 63-71 (`optoutsByDate`-opbygningen) og linje 139-140 (`absentOnDate`-justeringen). Erstat med simpel beregning:

```typescript
const dailyRate = (users.size / activeUserCount) * 100;
```

### Filer der ændres
- `src/components/statistics/WeekdayChart.tsx` — fjern population-justering, brug fast nævner

