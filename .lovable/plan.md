

# Ferie-funktion: Automatisk framelding i ferieperioder

## Overblik

Denne plan beskriver implementeringen af en ferie-funktion, der gør det muligt for brugere at melde ferie ind for en periode, hvorefter systemet automatisk opretter frameldinger (opt-outs) for alle hverdage i perioden.

## Hvordan det virker

```text
+-------------------+     +------------------+     +-------------------+
|  Bruger vælger    | --> | System genererer | --> | Automatisk        |
|  start- og        |     | opt-outs for     |     | framelding på     |
|  slutdato         |     | alle hverdage    |     | alle feriedage    |
+-------------------+     +------------------+     +-------------------+
```

## Fordele

1. **Tidsbesparelse**: Brugere slipper for at klikke "Frameldt" på hver enkelt dag
2. **Færre reminder-emails**: Brugeren modtager ikke påmindelser for dage i ferieperioden
3. **Præcise køkkental**: Køkkenet får automatisk korrekte antal forventede spisende
4. **Simpel implementation**: Genbruger eksisterende `lunch_optouts`-tabel

## Design-beslutning

Der er to tilgange:

**A) Ny `absences`/`vacations`-tabel** (mere kompleks)
- Separat tabel med start_date, end_date, reason
- Kræver ændringer i reminder-funktionen og statistik

**B) Batch-indsættelse i eksisterende `lunch_optouts`** (anbefalet)
- Genbruger eksisterende infrastruktur
- Reminder-funktionen virker automatisk (tjekker allerede for opt-outs)
- Statistik fungerer uden ændringer
- Simpel UI-tilføjelse i ProfileSettings

**Anbefaling**: Tilgang B - det er enklere og genbruger eksisterende logik.

---

## Implementation

### 1. Udvid ProfileSettings-komponenten

Tilføj en ny sektion i `src/components/ProfileSettings.tsx`:

- "Meld ferie"-knap der åbner en dialog
- To datovælgere: startdato og slutdato
- Validering: slutdato skal være efter startdato
- "Gem ferie"-knap der opretter opt-outs for alle hverdage i perioden

### 2. Logik for batch opt-out

Når brugeren gemmer ferieperioden:

1. Generer alle hverdage (mandag-fredag) mellem start og slut
2. Filtrer lukkede dage fra (fra `closed_dates`)
3. Filtrer dage hvor brugeren allerede er tilmeldt eller frameldt
4. Indsæt resterende dage som nye `lunch_optouts`
5. Vis bekræftelse med antal dage der blev frameldt

### 3. UI-elementer

- Tilføj `react-day-picker` datovælger (allerede installeret)
- Brug eksisterende Dialog-komponent
- Simpel formular med to datofelter og en "Gem"-knap

### 4. Visning af aktive ferieperioder (valgfri udvidelse)

- Vis liste over kommende feriedage i profilen
- Mulighed for at slette individuelle feriedage eller hele perioden

---

## Tekniske detaljer

### Ændringer i filer

**`src/components/ProfileSettings.tsx`**:
- Tilføj state for dialog, startdato, slutdato
- Tilføj funktion `handleVacationSubmit()` der:
  - Henter lukkede dage fra `closed_dates`
  - Henter eksisterende opt-outs og signups for perioden
  - Genererer hverdage i perioden
  - Indsætter nye opt-outs i batch

**Ingen database-ændringer påkrævet** - vi genbruger `lunch_optouts`.

### Hjælpefunktion til generering af hverdage

```text
generateWeekdays(startDate, endDate):
  1. Iterér fra startDate til endDate
  2. For hver dag: hvis dag er mandag-fredag, tilføj til liste
  3. Returner liste af datostrenge (YYYY-MM-DD format)
```

### Validering

- Startdato skal være i dag eller fremad
- Slutdato skal være samme dag eller efter startdato
- Maksimalt 60 dage frem (for at undgå fejlindtastninger)

---

## Berørte steder i systemet

| Komponent | Påvirkning |
|-----------|-----------|
| `ProfileSettings.tsx` | Ny ferie-sektion tilføjes |
| `LunchCalendar.tsx` | Ingen ændringer (viser allerede opt-outs) |
| `send-weekly-lunch-reminder` | Ingen ændringer (tjekker allerede opt-outs) |
| `KitchenView.tsx` | Ingen ændringer (tæller allerede opt-outs med) |
| Statistik | Ingen ændringer (opt-outs indgår allerede) |

## Estimeret omfang

- **1 fil ændres**: `src/components/ProfileSettings.tsx`
- **Ingen database-migrering nødvendig**
- **Ingen edge function-ændringer**

