
# Plan: Tilføj forklaring af påmindelseslogik i indstillinger

## Oversigt
Tilføjer en dynamisk forklaringstekst i påmindelsesindstillingerne, der tydeligt forklarer hvilken uge påmindelsen vil gælde for, baseret på den valgte dag.

## Ændring

### Opdater ReminderSettings.tsx
Tilføjer en informationsboks under dag-vælgeren med kontekstuel forklaring:

**For mandag (dag 1):**
> "Påmindelser sendt om mandagen vil opfordre brugere til at tilmelde sig frokost i den igangværende uge (mandag-fredag)."

**For tirsdag-søndag (dag 2-6, 0):**
> "Påmindelser sendt om [ugedag] vil opfordre brugere til at tilmelde sig frokost i den kommende uge (næste mandag-fredag)."

### Visuel implementering
Forklaringen vises som en info-boks med et Info-ikon for at gøre den tydelig:

```text
Dag
┌─────────────────────────────────────┐
│ Mandag                          ▼   │
└─────────────────────────────────────┘
Hvilken dag skal påmindelser sendes

┌─────────────────────────────────────┐
│ ℹ️  Påmindelser sendt om mandagen   │
│     vil opfordre brugere til at     │
│     tilmelde sig i den igangværende │
│     uge (mandag-fredag).            │
└─────────────────────────────────────┘
```

## Tekniske detaljer

### Fil der ændres
- `src/components/settings/ReminderSettings.tsx`

### Ny import
- `Info` ikon fra `lucide-react`

### Logik til dynamisk tekst
```typescript
const getWeekExplanation = () => {
  const dayNames = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
  const dayName = dayNames[reminderDay];
  
  if (reminderDay === 1) {
    return `Påmindelser sendt om ${dayName}en vil opfordre brugere til at tilmelde sig frokost i den igangværende uge (mandag-fredag).`;
  } else {
    return `Påmindelser sendt om ${dayName}en vil opfordre brugere til at tilmelde sig frokost i den kommende uge (næste mandag-fredag).`;
  }
};
```

### Placering i UI
Forklaringen indsættes lige efter den eksisterende hjælpetekst "Hvilken dag skal påmindelser sendes" (linje 214-216).

## Fordele
- Brugeren forstår præcis hvordan systemet fungerer uden at skulle gætte
- Teksten opdateres dynamisk når man ændrer dag, så man altid ser den relevante forklaring
- Info-ikonet signalerer at dette er en nyttig forklaring, ikke en fejl eller advarsel
