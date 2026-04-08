

## Audit: Duplikeret kode og optimeringsmuligheder

### Fundne duplikater

**1. Invitation email-logik (identisk i 2 filer)**
- `hslToHex()` — kopieret identisk i `send-invitations` og `webflow-sync`
- `generateInvitationEmail()` — kopieret identisk i begge
- `DEFAULT_COLORS` — kopieret identisk i begge
- `delay()` helper — kopieret identisk i begge

**Løsning:** Opret en delt fil `supabase/functions/_shared/email-utils.ts` med `hslToHex`, `generateInvitationEmail`, `DEFAULT_COLORS` og `delay`. Importér i begge funktioner.

**2. Microsoft token refresh (identisk i 3 filer)**
- `refreshAccessToken()` — kopieret identisk i `get-calendar-events`, `calendar-webhook` og `renew-graph-subscriptions`
- Token refresh + opdatering i DB — gentaget logik

**Løsning:** Opret `supabase/functions/_shared/microsoft-auth.ts` med `refreshAccessToken()` og `getValidAccessToken()`.

**3. Microsoft app token / Client Credentials (identisk i 3 filer)**
- `getAppToken()` — kopieret identisk i `get-room-calendars`, `get-meeting-rooms` og inline i `calendar-webhook` og `get-microsoft-users`

**Løsning:** Tilføj `getAppToken()` til den delte `microsoft-auth.ts`.

**4. Graph event mapping (identisk i 2 filer)**
- Event-til-objekt mapping med `nonResourceAttendees` filtrering — identisk kode i `get-calendar-events` og `get-room-calendars`

**Løsning:** Opret `supabase/functions/_shared/graph-utils.ts` med en `mapGraphEvent()` funktion.

**5. CORS headers (identisk i alle 19 edge functions)**
- Samme objekt defineret i hver eneste funktion

**Løsning:** Opret `supabase/functions/_shared/cors.ts` og eksportér `corsHeaders`.

**6. Admin auth check (variationer i 5+ filer)**
- Forskellige implementationer af admin-check: nogen bruger `has_role` RPC, andre query'er `user_roles` direkte
- `get-microsoft-users` bruger direkte query, `send-invitations` bruger `has_role`, `webflow-sync` query'er `user_roles`

**Løsning:** Standardiser til `has_role` RPC overalt via en delt `supabase/functions/_shared/auth-utils.ts`.

### Oversigt over nye delte filer

```text
supabase/functions/_shared/
├── cors.ts              — corsHeaders
├── email-utils.ts       — hslToHex, generateInvitationEmail, DEFAULT_COLORS, delay
├── microsoft-auth.ts    — refreshAccessToken, getValidAccessToken, getAppToken
├── graph-utils.ts       — mapGraphEvent
└── auth-utils.ts        — verifyAdmin (auth + role check)
```

### Filer der ændres

| Fil | Ændring |
|-----|---------|
| `_shared/cors.ts` | **Ny** — eksportér corsHeaders |
| `_shared/email-utils.ts` | **Ny** — hslToHex, email template, DEFAULT_COLORS, delay |
| `_shared/microsoft-auth.ts` | **Ny** — token refresh + app token |
| `_shared/graph-utils.ts` | **Ny** — mapGraphEvent |
| `_shared/auth-utils.ts` | **Ny** — verifyAdmin |
| `send-invitations/index.ts` | Fjern duplikater, importér fra _shared |
| `webflow-sync/index.ts` | Fjern duplikater, importér fra _shared |
| `get-calendar-events/index.ts` | Fjern refreshAccessToken + event mapping, importér |
| `get-room-calendars/index.ts` | Fjern getAppToken + event mapping, importér |
| `get-meeting-rooms/index.ts` | Fjern getAppToken, importér |
| `calendar-webhook/index.ts` | Fjern refreshAccessToken + inline token, importér |
| `renew-graph-subscriptions/index.ts` | Fjern refreshAccessToken, importér |
| `get-microsoft-users/index.ts` | Standardiser admin check til has_role |
| Alle 19 edge functions | Importér corsHeaders fra _shared |

### Estimeret reduktion
Ca. 400-500 linjer duplikeret kode fjernes. Fremtidige ændringer (f.eks. email-template eller token-logik) skal kun ændres ét sted.

