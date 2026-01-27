
# Uge-animation trigges ved 100% aktivitet på én dag

## Overblik

Denne plan ændrer logikken for uge-animationen i `LunchCalendar.tsx`, så den udløses hvis **mindst én dag** i ugen har 100% aktivitet (alle har svaret - enten tilmeldt eller frameldt), i stedet for at kræve at alle fremtidige dage også er fuldt besvarede.

## Hvad ændres

### Nuværende adfærd
- `allResponded` er kun `true` hvis ALLE resterende dage (fremtidige) har 100% svar
- Forbi-gåede dage ignoreres helt i beregningen
- Animation vises kun når hele ugens fremtid er "komplet"

### Ny adfærd
- `allResponded` bliver `true` hvis **mindst én dag** i ugen har 100% svar (alle aktive brugere har tilmeldt eller frameldt)
- Alle dage tælles med - både forbi-gåede og fremtidige (dog ikke lukkede dage)
- Animation vises så snart én dag opnår fuld aktivitet

## Detaljeret implementation

### LunchCalendar.tsx - Ændring af `getWeekCelebrationStatus`

Nuværende logik (linje 359-389):
```typescript
let allDaysHaveFullResponse = true;
// ...
if (respondedUsers.size < activeUserCount) {
  allDaysHaveFullResponse = false;  // Kræver ALLE dage
}
```

Ny logik:
```typescript
let hasAnyFullResponseDay = false;
// ...
if (respondedUsers.size >= activeUserCount) {
  hasAnyFullResponseDay = true;  // Kun EN dag behøves
}
```

Ændringer i detaljer:
1. Fjern `isPastDate(day)` fra skip-betingelsen - vi vil gerne tjekke alle dage
2. Ændr `allDaysHaveFullResponse` til `hasAnyFullResponseDay` 
3. Inverter logikken: sæt til `true` når én dag matcher, i stedet for `false` når én dag fejler
4. Opdater return-statement og variabelnavne

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `src/components/LunchCalendar.tsx` | Ændr `getWeekCelebrationStatus` til at trigge ved 100% på én dag |

## Konsekvenser

- **Hyppigere animationer**: Uge-animationer vises oftere, hvilket giver mere positiv feedback
- **Inkluderer fortid**: Hvis i går havde 100% aktivitet, vises animationen stadig i dag
- **Mere intuitiv**: Brugerne ser straks at ugen har haft en "perfekt dag"
- **Ingen data-ændringer**: Kun visuel logik ændres

## Tekniske detaljer

Den opdaterede funktion vil se sådan ud:

```typescript
const getWeekCelebrationStatus = (days: Date[]) => {
  if (activeUserCount === 0) return { allResponded: false, hasFullSignupDay: false };
  
  let hasAnyFullResponseDay = false;
  let hasAnyFullSignupDay = false;
  
  for (const day of days) {
    // Skip kun lukkede dage - ikke forbi-gåede dage
    if (isDateClosed(day)) continue;
    
    const dateStr = format(day, "yyyy-MM-dd");
    const signupsForDay = signups.filter(s => s.lunch_date === dateStr);
    const optoutsForDay = allOptouts.filter(o => o.lunch_date === dateStr);
    
    // Unikke brugere der har svaret
    const respondedUsers = new Set([
      ...signupsForDay.map(s => s.user_id),
      ...optoutsForDay.map(o => o.user_id)
    ]);
    
    // Tjek om denne dag har fuld respons
    if (respondedUsers.size >= activeUserCount) {
      hasAnyFullResponseDay = true;
    }
    
    // Tjek om alle aktive brugere har tilmeldt sig
    if (signupsForDay.length >= activeUserCount) {
      hasAnyFullSignupDay = true;
    }
  }
  
  return { allResponded: hasAnyFullResponseDay, hasFullSignupDay: hasAnyFullSignupDay };
};
```
