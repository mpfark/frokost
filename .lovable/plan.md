

# Skaleringsanalyse af Plusfrokost-applikationen

## Resumé

Efter en grundig gennemgang af kodebasen har jeg identificeret 12 potentielle skaleringsproblemer fordelt på 4 kategorier: URL-længde problemer, manglende pagination, query-optimering og realtime-skalering.

---

## Kategori 1: URL-Længde Problemer (Allerede Delvist Løst)

### Nuværende Status
Batching er nu implementeret i:
- `LunchCalendar.tsx` - fetchGuests ✅
- `KitchenView.tsx` - fetchGuests ✅
- `AuditLogTable.tsx` - fetchLogs profiles ✅

### Manglende Batching

#### 1. UserActivityTable.tsx (Linje 54-64)
**Risiko: Høj**

Henter gæster med `.in("signup_id", ...)` uden batching:
```typescript
const guestsRes = await supabase
  .from("guests")
  .select("id, signup_id, lunch_signups!inner(user_id, lunch_date)")
  .gte("lunch_signups.lunch_date", startStr)
  .lte("lunch_signups.lunch_date", endStr);
```
Denne query bruger date-range filtrering, som er OK, men på linje 54-64 er der en indirekte afhængighed.

#### 2. StatisticsOverview.tsx (Linje 34-54)
**Risiko: Lav-Moderat**

Bruger date-range queries, hvilket er sikkert. Ingen `.in()` problemer.

---

## Kategori 2: Manglende Pagination

### 3. UserManagement.tsx (Linje 50-60)
**Risiko: Høj**

```typescript
const { data: profiles } = await supabase
  .from("profiles")
  .select("*")
  .order("email");
```

Henter ALLE brugere uden limit. Ved 200+ brugere vil siden blive langsom og UI-tung.

**Løsning**: Implementer server-side pagination eller virtualiseret liste.

### 4. InvitationManagement.tsx (Linje 48-78)
**Risiko: Moderat**

```typescript
const { data } = await supabase
  .from("invitations")
  .select("*")
  .order("invited_at", { ascending: false });
```

Henter ALLE invitationer. Over tid kan dette vokse til tusindvis af rækker.

**Løsning**: Tilføj `.limit(100)` og pagination.

### 5. KitchenView.tsx - fetchSignups (Linje 104-118)
**Risiko: Moderat**

```typescript
const { data } = await supabase
  .from("lunch_signups")
  .select("*, profiles(full_name, email, ...)")
  .gte("lunch_date", format(startDate, "yyyy-MM-dd"))
  .lte("lunch_date", format(endDate, "yyyy-MM-dd"));
```

Ved 100 brugere × 15 hverdage = 1500 tilmeldinger pr. 3 uger. OK nu, men kan vokse.

---

## Kategori 3: Query-Optimering

### 6. Unødvendig Re-fetching i Realtime Handlers

**KitchenView.tsx (Linje 326-377)**
```typescript
const guestsChannel = supabase
  .channel("kitchen_guests_changes")
  .on("postgres_changes", ..., () => {
    fetchGuests(); // Henter ALLE gæster ved enhver ændring
  })
```

**Problem**: Enhver gæst-ændring trigger fuld re-fetch af alle gæster.

**Løsning**: Brug payload fra realtime event til inkrementelle opdateringer.

### 7. LunchCalendar.tsx Cascading Fetches

```typescript
useEffect(() => {
  if (signups.length > 0) {
    fetchGuests(); // Kører hver gang signups ændres
  }
}, [signups]);
```

**Problem**: Når signups opdateres, fetches alle gæster igen, selvom kun én signup ændres.

### 8. WeekdayChart.tsx - Henter Alle Aktive Profiler

```typescript
const profilesRes = await supabase
  .from("profiles")
  .select("id")
  .eq("is_active", true);
```

**Risiko**: Ved mange brugere hentes alle profiler bare for at tælle dem.

**Løsning**: Brug `{ count: "exact", head: true }` i stedet.

---

## Kategori 4: Realtime Skalering

### 9. Flere Overlappende Realtime Channels

**Index.tsx/LunchCalendar.tsx/KitchenView.tsx**

Hver komponent opretter sine egne realtime subscriptions:
- `lunch_signups_changes`
- `kitchen_view_signups`
- `closed_dates_changes`
- `guests_changes`
- Osv.

**Problem**: Samme data lyttes på flere steder → duplikerede updates og øget server-load.

**Løsning**: Centraliseret realtime state management (f.eks. React Context med en enkelt subscription).

### 10. Manglende Debouncing på Realtime Updates

```typescript
.on("postgres_changes", ..., () => {
  fetchSignups(); // Ingen debounce
})
```

**Problem**: Hurtige successive ændringer (f.eks. bulk import) kan trigger mange fetches.

---

## Kategori 5: Edge Function Skalering

### 11. send-weekly-lunch-reminder - Sekventiel Email-udsendelse

```typescript
for (const user of usersWithoutDecision) {
  await resend.emails.send(...);
  await delay(500);
}
```

**Problem**: 100 brugere = 50+ sekunder. 500 brugere = 4+ minutter.

**Løsning**: Edge functions har 400s timeout, men dette kan optimeres med batched email sends.

### 12. webflow-sync - Ingen Pagination af Webflow API

```typescript
const webflowResponse = await fetch(
  `https://api.webflow.com/v2/collections/${settings.collection_id}/items`
);
```

**Problem**: Webflow API returnerer max 100 items pr. request. Større collections kræver pagination.

---

## Prioriteret Handlingsplan

### Høj Prioritet (Bør fikses nu)
1. **UserManagement.tsx pagination** - Vigtigst for admin-oplevelse
2. **InvitationManagement.tsx pagination** - Vokser over tid
3. **Realtime debouncing** - Forhindrer cascade-fetches

### Moderat Prioritet (Bør fikses snart)
4. **WeekdayChart count-optimering** - Simpel fix
5. **Centraliseret realtime management** - Større refaktor men giver bedre performance
6. **Webflow pagination** - Kun relevant hvis CMS vokser

### Lav Prioritet (Kan vente)
7. **Inkrementelle realtime updates** - Kompleks refaktorering
8. **Email batching** - Kun problem ved 500+ brugere

---

## Tekniske Detaljer

### Anbefalet Pagination Pattern
```typescript
const [page, setPage] = useState(0);
const PAGE_SIZE = 50;

const { data, count } = await supabase
  .from("table")
  .select("*", { count: "exact" })
  .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
  .order("created_at", { ascending: false });
```

### Anbefalet Debounce Pattern
```typescript
import { useMemo } from "react";
import { debounce } from "lodash"; // eller egen implementation

const debouncedFetch = useMemo(
  () => debounce(fetchData, 300),
  []
);
```

### Anbefalet Count-Only Query
```typescript
const { count } = await supabase
  .from("profiles")
  .select("*", { count: "exact", head: true })
  .eq("is_active", true);
```

---

## Filer der skal ændres

| Fil | Ændring | Kompleksitet |
|-----|---------|--------------|
| `src/components/UserManagement.tsx` | Tilføj pagination | Medium |
| `src/components/InvitationManagement.tsx` | Tilføj limit og "indlæs flere" | Lav |
| `src/components/statistics/WeekdayChart.tsx` | Brug count query | Lav |
| `src/components/KitchenView.tsx` | Debounce realtime handlers | Lav |
| `src/components/LunchCalendar.tsx` | Debounce realtime handlers | Lav |
| `supabase/functions/webflow-sync/index.ts` | Tilføj Webflow pagination | Medium |

