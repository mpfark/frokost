
# Plan: Tilføj "Dag" tab til køkkenvisningen

## Oversigt
Tilføjer en ny "Dag" tab til køkkenvisningen med et to-kolonnet layout:
- **Venstre side**: Overordnede informationer (antal tilmeldte, gæster, kostrestriktioner, fravær)
- **Højre side**: Liste med tilmeldte, sorteret på samme måde som i den eksisterende skuffe

## Ændringer

### 1. Opdater TabsList til tre tabs
Ændrer tab-layoutet fra 2 til 3 kolonner:
- **Dag** (ny) - med CalendarDays ikon
- **Uge** (nuværende "Tilmeldinger")  
- **Lukkede dage** (uændret)

### 2. Tilføj state til dagvalg
Tilføjer state til at holde styr på hvilken dag der vises i dag-tabben:
- `selectedDayTab` - den valgte dato (default: i dag)
- Navigation mellem dage med venstre/højre pile

### 3. Dag-tab indhold (to-kolonnet layout)

```text
+----------------------------------+----------------------------------+
|         VENSTRE KOLONNE          |         HØJRE KOLONNE            |
|----------------------------------|----------------------------------|
| [< Forrige]  Mandag 3. feb  [>]  |  Tilmeldte (sorteret liste)      |
|                                  |                                  |
| ┌─────────────────────────────┐  |  ┌────────────────────────────┐  |
| │ 👤 37 forventet (39 total)  │  |  │ Navn + gæster + badges     │  |
| │ ❌ 2 fravær                 │  |  │ Kostrestriktioner          │  |
| │ 👥 5 gæster                 │  |  │ Gæst info                  │  |
| └─────────────────────────────┘  |  │ [Fravær] [Fjern] knapper   │  |
|                                  |  └────────────────────────────┘  |
| Kostrestriktioner:               |  ┌────────────────────────────┐  |
| ┌─────────────────────────────┐  |  │ Næste person...            │  |
| │ 🌾 Glutenfri: 2             │  |  └────────────────────────────┘  |
| │ 🥛 Laktosefri: 1            │  |  ...                             |
| │ 🌿 Vegetar: 4               │  |                                  |
| │ 🌾+🌿 GF+V: 1               │  |                                  |
| └─────────────────────────────┘  |                                  |
+----------------------------------+----------------------------------+
```

### 4. Sortering af tilmeldte (samme som skuffen)
Listen sorteres efter:
1. Antal gæster (flest først)
2. Antal kostrestriktioner (flest først)
3. Alfabetisk efter navn

### 5. Funktionalitet i højre kolonne
Hver tilmelding viser:
- Navn med eventuelle gæste-badges
- Kostrestriktions-badges (Glutenfri, Laktosefri, Vegetar)
- Gæsternes kostrestriktioner
- Knapper til at markere fravær og fjerne tilmelding

## Tekniske detaljer

### Fil der ændres
- `src/components/KitchenView.tsx`

### Nye state variabler
```typescript
const [selectedDayTab, setSelectedDayTab] = useState<Date>(new Date());
```

### Navigation mellem dage
- Venstre pil: Gå til forrige hverdag
- Højre pil: Gå til næste hverdag
- Springer weekender over

### Responsivt design
- På desktop: To kolonner side om side
- På mobil: Kolonnerne stables vertikalt (oversigt først, derefter liste)

## Fordele
- Køkkenpersonalet får et hurtigt overblik over én dag uden at skulle åbne skuffen
- Samme sorteringslogik som skuffen sikrer konsistens
- Nem navigation mellem dage med pile-knapper
