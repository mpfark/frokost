

## Plan: Personlig konfetti-animation når bruger har svaret hele ugen

### Idé
Når brugeren har taget et aktivt valg (tilmeldt eller frameldt) for alle tilgængelige dage i en uge, udløses en konfetti-animation over "Hele ugen"-kortet. Dette er en personlig fejring — uafhængig af den eksisterende uge-celebration der handler om alle brugere.

### Ændringer

**1. Tilføj `canvas-confetti` bibliotek**
- Letvægts-bibliotek (~5 KB) til konfetti-effekten.

**2. `src/components/LunchCalendar.tsx`**
- Tilføj en hjælpefunktion `userHasRespondedAllDays(days)` der tjekker om den aktuelle bruger har enten en signup eller optout for alle ikke-lukkede dage i ugen.
- Track tidligere ugers status i en `useRef` så konfetti kun udløses ved overgangen fra "ikke-komplet" til "komplet" (ikke ved page load).
- Når status skifter til komplet: affyr `confetti()` fra "Hele ugen"-kortets position.
- Vis et lille visuelt hint (f.eks. en grøn kant eller et ✓-ikon) på "Hele ugen"-kortet når ugen er komplet.

### Filer der ændres
- `package.json` — tilføj `canvas-confetti`
- `src/components/LunchCalendar.tsx` — tilføj personlig kompletions-logik og konfetti-trigger

