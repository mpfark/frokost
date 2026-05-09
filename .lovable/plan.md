## Email log under Statistik

Tilføj en ny "Email log"-sektion til Statistik-visningen, der viser alle udgående mails fra `email_send_log`. Data hentes via en edge function der validerer admin-rolle, så tabellen forbliver service_role-only.

### 1. Edge function: `get-email-logs`

Ny funktion i `supabase/functions/get-email-logs/index.ts`:
- `verify_jwt = true` + manuel admin-tjek via `has_role(user, 'admin')`
- Accepterer query params: `start_date`, `end_date`, `template_name`, `status`, `limit`, `offset`
- Bruger service-role klient internt til at læse `email_send_log`
- Returnerer **dedupede** rækker (én pr. `message_id`, seneste status) via `DISTINCT ON (message_id)` SQL
- Returnerer både:
  - `stats`: `{ total, sent, failed, suppressed }` for valgt periode
  - `logs`: paginerede rækker (50 ad gangen)
  - `templates`: distinkt liste til filter-dropdown
- Generiske fejlbeskeder, ingen lækage af interne detaljer

Registrér i `supabase/config.toml` med `verify_jwt = true`.

### 2. UI-komponent: `EmailLogTable.tsx`

Placeres i `src/components/statistics/EmailLogTable.tsx`, struktureret som `AuditLogTable.tsx`:

**KPI-kort (top):**
- Total mails, Sendt (grøn), Fejlet (rød), Undertrykt (gul)
- Opdateres ud fra valgte filtre

**Filterrække:**
- Tidsrum: Knapper "24t / 7d / 30d" + custom date range picker (default: 7d)
- Skabelon: Select med "Alle" + alle distinkte `template_name`
- Status: Select med "Alle / Sendt / Fejlet / Undertrykt"
- Refresh-knap

**Tabel:**
- Kolonner: Tidspunkt, Modtager, Skabelon (badge), Status (farvet badge), Fejl (truncated, kun ved fejl)
- Sortér efter `created_at` desc
- Paginering: 50 pr. side med "Forrige / Næste"
- Tom-tilstand: "Ingen mails sendt i den valgte periode"

**Status-badges:**
- `sent` → grøn (default variant)
- `failed` / `dlq` / `bounced` → destructive
- `suppressed` / `complained` → secondary
- `pending` → outline

**Skabelon-mapping (danske labels):**
- `auth_emails` → "Auth (login/reset)"
- `invitation` → "Invitation"
- `weekly-reminder` → "Ugentlig påmindelse"
- `manual-reminder` → "Manuel påmindelse"
- `password-reset` → "Password reset"
- Fallback: rå template_name

### 3. Integration i Statistik-visning

Tilføj `EmailLogTable` nederst i `src/components/statistics/StatisticsView.tsx` (efter eksisterende `AuditLogTable`). Ingen ny rute, ingen menuændring.

### Tekniske detaljer

- SQL i edge function bruger `DISTINCT ON (message_id) ... ORDER BY message_id, created_at DESC` for dedup
- Periode-filter anvendes på den dedupede subquery (filtrerer på seneste rækkes `created_at`)
- Limit batch på 1000 i SQL for at undgå Supabase row limit; UI paginerer 50 ad gangen
- Genbruger eksisterende shadcn-komponenter (Card, Table, Select, Badge, Button, Calendar/Popover til date range)
- Følger eksisterende mønstre fra `AuditLogTable` for layout og loading-tilstande

### Hvad der IKKE er med i denne plan

- Ingen "gensend"-handling (kan tilføjes senere fra DLQ)
- Ingen HTML preview af mailindhold
- Ingen CSV-eksport
- Ingen realtime-opdatering — kun manuel refresh + auto-fetch ved filterskift