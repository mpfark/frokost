## Mål
Brugere skal informeres når køkkenet er lukket på den dag, de prøver at bestille forplejning til.

## Ændringer

### 1. `CateringOrderDialog.tsx`
- Hent `closed_dates` for `meeting.date` ved åbning af dialogen.
- Hvis dagen er lukket: vis et tydeligt advarselsbanner øverst i dialogen (rød/destructive variant) med tekst som:
  > "Køkkenet er lukket denne dag{reason ? ` (${reason})` : ""}. Du kan ikke bestille forplejning."
- Deaktivér "Bestil forplejning"/"Opdatér bestilling"-knappen når dagen er lukket.
- Block også selve `handleSubmit` med en toast.error som ekstra sikring.

### 2. `WeekDayGrid.tsx` (visuel indikation før klik)
- Hent `closed_dates` for ugen (eller modtag som prop fra `OutlookCalendar`).
- For lukkede dage: vis en lille badge/tekst under dagsoverskriften: "Køkkenet er lukket" (muted/destructive).
- Møder vises stadig, så brugeren kan se sin kalender, men det er klart at forplejning ikke kan bestilles.

### 3. `OutlookCalendar.tsx`
- Tilføj fetch af `closed_dates` for den viste uge og videresend til `WeekDayGrid` som prop.

## Tekniske detaljer
- `closed_dates` har allerede en RLS-policy "Anyone can view closed dates" — ingen DB-ændringer nødvendige.
- Brug `date` (yyyy-MM-dd) sammenligning mod `meeting.date`.
- Behold redigering af eksisterende ordre tilladt? Forslag: nej — hvis dagen nu er lukket, skal man heller ikke kunne opdatere. (Vi kan justere hvis du foretrækker andet.)

Ingen ændringer i edge functions, RLS eller schema.