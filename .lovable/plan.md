## Mål

Mails skal sendes fra firmaets eget subdomæne (Pluskontoret → `notify.frokost.pluskontoret.dk`, Gakgak → `notify.frokost.gakgak.net`) og platform-mails fra `notify.gakgak.net`. From-navn (fx "Plusfrokost", "Gakgak Frokost") skal også være per-firma.

## Trin

### 1. DNS / domæne-verifikation (kræver dig)

Du skal tilføje to nye Lovable email-domæner i Cloud → Emails:

- `notify.frokost.gakgak.net` (Gakgak firma-mails)
- `notify.gakgak.net` (platform-mails, fx platform admin invitationer)

For hvert af dem giver Lovable dig NS-records, som skal sættes hos registrar for `gakgak.net`. Først når statussen er "Active" kan de bruges. Vi fortsætter implementeringen parallelt, så koden er klar.

### 2. Database

Tilføj kolonner til `companies`:
- `sender_subdomain` (text) — fx `notify.frokost.pluskontoret.dk`
- `sender_from_name` (text) — fx `Plusfrokost`

Tilføj `platform_settings` rækker (eller hardkod platform-defaults i koden) til platform-domænet `notify.gakgak.net` med navnet "Frokost Platform".

Pre-udfyld eksisterende firmaer:
- Pluskontoret → `notify.frokost.pluskontoret.dk`, "Plusfrokost"
- Gakgak → `notify.frokost.gakgak.net`, "Gakgak Frokost"

### 3. Edge function: `send-transactional-email`

Erstat de hardkodede `SENDER_DOMAIN` / `FROM_DOMAIN` / `SITE_NAME` med opslag pr. request:

- Acceptér ny body-parameter `companyId` (UUID) eller `platform: true`.
- Hvis `companyId` → slå `sender_subdomain` + `sender_from_name` op fra `companies`.
- Hvis `platform: true` → brug platform-konstanter.
- Fallback til Pluskontoret hvis intet sendes (bagudkompatibel).

Disse værdier sættes i kø-payloadens `from`, `sender_domain` (det er det felt mail-providerens lookup bruger).

### 4. Kaldere skal sende tenant-context

Find alle `supabase.functions.invoke('send-transactional-email', ...)` kald og send `companyId` med (eller `platform: true` for platform admin invitationer):

- `send-invitations` (firma-invitationer) → tenant companyId
- `invite-platform-admin` → `platform: true`
- `send-manual-reminder` → tenant companyId
- `send-weekly-lunch-reminder` → tenant companyId
- Eventuelle andre triggere

### 5. Auth-emails (magic links / invitations fra Supabase Auth)

`auth-email-hook` sender pt. også fra det hardkodede domæne. Den får ikke tenant-context fra Supabase Auth, så vi udleder tenant ud fra brugerens email-domæne eller `companies.email_domain` mapping. Hvis ingen match → platform-domænet.

### 6. Test

- Send testinvitation som admin på Pluskontoret → mail kommer fra `noreply@notify.frokost.pluskontoret.dk` med navnet "Plusfrokost".
- Send testinvitation som admin på Gakgak → mail fra `notify.frokost.gakgak.net`.
- Inviter platform admin fra `frokost.gakgak.net` → mail fra `notify.gakgak.net`.

## Tekniske noter

- Selve afsendelsen sker i `process-email-queue`, som bruger `sender_domain` fra payloaden — så ingen ændringer der.
- Hver `sender_domain` skal være verificeret i Lovable Emails, ellers fejler udsendelsen med "No email domain record found".
- Vi sætter ikke et felt for "platform" på `companies`-tabellen — platform-værdier hardkodes i edge-funktionen (eller flyttes til en lille `platform_settings`-tabel hvis du foretrækker det).
