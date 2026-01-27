
# Udeluk brugere uden tilmeldinger fra statistikberegninger

## Overblik

Denne plan ændrer statistikberegningerne, så kun brugere der har mindst én tilmelding (eller afmelding) i perioden tælles med i gennemsnit og procenter. Dette giver mere retvisende tal for den "aktive" brugerbase.

## Hvad ændres

### Nuværende adfærd
- **Svarprocent i WeekdayChart**: Beregnes ud fra ALLE aktive profiler (is_active = true)
- **UserActivityTable**: Viser "Inaktive" som brugere uden tilmeldinger

### Ny adfærd
- **Svarprocent**: Beregnes kun ud fra brugere der har mindst én tilmelding ELLER afmelding i perioden
- **UserActivityTable**: Omdøbes "Inaktive" til "Uden tilmeldinger" for klarhed
- **StatisticsOverview**: Ingen ændringer nødvendige (tæller allerede kun unikke brugere med tilmeldinger)

## Detaljeret implementation

### 1. WeekdayChart.tsx - Svarprocent beregning

**Før**: `activeNonKitchenCount` = alle aktive profiler minus køkkenbrugere

**Efter**: `activeNonKitchenCount` = brugere med mindst én tilmelding eller afmelding i perioden, minus køkkenbrugere

Ændring:
```text
1. Find alle unikke user_ids fra signups + optouts i perioden
2. Fjern køkkenbrugere fra dette sæt
3. Brug dette antal som basis for svarprocent
```

### 2. UserActivityTable.tsx - Omdøb faneblad

Ændring af tekst:
- "Inaktive" -> "Uden tilmeldinger"
- Tilføj en kort beskrivelse der forklarer at dette er aktive brugere uden aktivitet i perioden

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `src/components/statistics/WeekdayChart.tsx` | Beregn svarprocent kun ud fra brugere med aktivitet i perioden |
| `src/components/statistics/UserActivityTable.tsx` | Omdøb "Inaktive" til "Uden tilmeldinger" for klarhed |

## Konsekvenser

- **Højere svarprocenter**: Tal vil stige da inaktive brugere ikke længere "trækker ned"
- **Mere retvisende**: Statistikken afspejler deltagelse blandt faktisk aktive brugere
- **Ingen data-ændringer**: Der ændres ikke i databasen, kun i beregningslogikken
