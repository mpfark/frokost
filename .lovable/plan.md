
# Plan: Implementer batching i KitchenView og AuditLogTable

## Oversigt
Implementerer samme batching-løsning som i LunchCalendar.tsx for at undgå URL-længde problemer ved store mængder data.

## Ændringer

### 1. KitchenView.tsx - fetchGuests funktion (linje 147-165)

Opdaterer `fetchGuests` til at opdele signup IDs i batches af 50:

**Nuværende kode:**
```typescript
const { data, error } = await supabase
  .from("guests")
  .select("*")
  .in("signup_id", signupIds);
```

**Ny kode:**
```typescript
const BATCH_SIZE = 50;
const batches: string[][] = [];
for (let i = 0; i < signupIds.length; i += BATCH_SIZE) {
  batches.push(signupIds.slice(i, i + BATCH_SIZE));
}

const results = await Promise.all(
  batches.map(batch =>
    supabase.from("guests").select("*").in("signup_id", batch)
  )
);

const error = results.find(r => r.error)?.error;
if (error) {
  console.error("Error fetching guests:", error);
  return;
}

const allGuests = results.flatMap(r => r.data || []);
setGuests(allGuests);
```

### 2. AuditLogTable.tsx - fetchLogs funktion (linje 136-141)

Opdaterer profile-hentning til at bruge batching:

**Nuværende kode:**
```typescript
const { data: profiles } = await supabase
  .from("profiles")
  .select("id, full_name, email")
  .in("id", userIds);
```

**Ny kode:**
```typescript
const BATCH_SIZE = 50;
let allProfiles: { id: string; full_name: string | null; email: string }[] = [];

if (userIds.length > 0) {
  const batches: string[][] = [];
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    batches.push(userIds.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map(batch =>
      supabase.from("profiles").select("id, full_name, email").in("id", batch)
    )
  );

  allProfiles = results.flatMap(r => r.data || []);
}

const profileMap = new Map(allProfiles.map((p) => [p.id, p.full_name || p.email]));
```

## Tekniske detaljer

### Filer der ændres
1. `src/components/KitchenView.tsx` - fetchGuests funktion
2. `src/components/statistics/AuditLogTable.tsx` - fetchLogs funktion

### Batch-størrelse
Bruger samme BATCH_SIZE på 50 som i LunchCalendar for konsistens.

### Parallel eksekvering
Alle batches køres parallelt med `Promise.all` for optimal performance.

## Fordele
- Forhindrer URL-længde fejl når der er mange tilmeldinger/brugere
- Parallel eksekvering holder performance høj
- Konsistent løsning på tværs af hele applikationen
