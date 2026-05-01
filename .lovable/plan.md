## Plan: Migrér email-udsendelse fra Resend til Lovable Email

### Sender-domæne
Vi bruger **`mail.frokost.pluskontoret.dk`** som afsender-subdomæne.

Hvorfor ikke `frokost.pluskontoret.dk` direkte? Lovable Email opretter en NS-delegering på subdomænet til Lovables nameservers for at håndtere SPF/DKIM/MX automatisk. Hvis vi delegerede selve `frokost.pluskontoret.dk`, ville Lovable overtage al DNS for det domæne — og det er også der selve appen kører. Et separat `mail.`-subdomæne holder mail-routing adskilt fra app-routing.

Du skal selv tilføje to NS-records hos din domæne-udbyder (instruktionerne kommer i setup-dialogen). DNS-propagering tager normalt 1-24 timer.

---

### Fase 1 — Auth-mails (OTP, password reset, invitations)

**Mål:** Alle Supabase Auth-mails (OTP-koder til login, password reset, evt. invitation magic links) sendes via Lovable's branded skabeloner i stedet for Supabase's standard.

**Hvad sker der:**
1. Sæt mail-domænet `mail.frokost.pluskontoret.dk` op (NS-delegering + SPF/DKIM provisioneres automatisk)
2. Sæt email-infrastruktur op (kø, retry, suppression list — skal ligge klar inden vi kan sende noget)
3. Scaffold auth-email-skabeloner (6 stk: signup, magic-link, recovery, invite, email-change, reauthentication)
4. Brand skabelonerne med Plusfrokost-farver (primary fra `company_settings`), logo (hvis tilgængeligt) og dansk tekst
5. Deploy `auth-email-hook` edge-funktionen så Supabase Auth ruter alle auth-mails gennem Lovable
6. Standard auth-mails (uden branding) sendes fortsat indtil DNS er verificeret — derefter aktiveres de brandede automatisk

**Vigtig effekt for OTP-flowet:** Når Fase 1 er aktiv, kommer dine 6-cifrede login-koder fra `mail.frokost.pluskontoret.dk` med Plus-branding i stedet for Supabase's grå standard-mail. Det ser væsentligt mere professionelt ud.

---

### Fase 2 — Transactional mails (app-mails)

**Mål:** Erstat Resend i alle steder hvor app'en sender ikke-auth mails. I dag bruges Resend i:

- `supabase/functions/send-invitations/index.ts` — invitations-mails fra admin (branded HTML med company colors)
- `supabase/functions/send-manual-reminder/index.ts` — manuel påmindelse fra køkken til brugere uden tilmelding
- `supabase/functions/send-weekly-lunch-reminder/index.ts` — ugentlige cron-baserede påmindelser
- `supabase/functions/send-password-reset/index.ts` — admin nulstiller password for bruger

**Hvad sker der:**
1. Scaffold transactional-email-infrastruktur (`send-transactional-email` edge-funktion + unsubscribe-håndtering)
2. Konvertér de eksisterende mail-skabeloner i `_shared/email-utils.ts` til React Email-komponenter under `_shared/transactional-email-templates/`:
   - `invitation.tsx` (fra `generateInvitationEmail`)
   - `manual-reminder.tsx` (inline HTML i `send-manual-reminder`)
   - `weekly-reminder.tsx` (fra `send-weekly-lunch-reminder`)
   - `password-reset.tsx` (fra `send-password-reset`, hvis den sender custom-template)
3. Registrér alle skabeloner i `registry.ts`
4. Opdatér de fire edge-funktioner: erstat `resend.emails.send(...)` med `supabase.functions.invoke('send-transactional-email', { body: { templateName, recipientEmail, idempotencyKey, templateData } })`
5. Bevar 500ms-delay og rate limiting (500ms-delayet kan faktisk fjernes — Lovable's kø håndterer rate-limit selv, men vi lader det stå indtil vi har bekræftet stabil drift)
6. Lav unsubscribe-side i appen (kræves af transactional-systemet — ren teknisk side, vores brugere bruger den næppe da alle mails er drifts-relaterede)
7. Opret unsubscribe-side på fx `/email-unsubscribe` der matcher Plus-design

**Hvad ændres IKKE:**
- Triggers og cron-skemaer (ugentlige påmindelser kører fortsat på samme tidspunkt)
- Logik for hvem der modtager hvilke mails (samme filter på `is_active`, `reminder_enabled`, opt-outs osv.)
- Indhold/formulering i mails — vi flytter blot leveringen, sproget/branding bevares 1:1
- Rate-limiting på `rate_limits`-tabellen for `send_invitations` (admin må stadig kun sende 50 invitationer/time)

---

### Efter migrering

- `RESEND_API_KEY` kan fjernes fra secrets (jeg gør det i sidste step efter vi har bekræftet alt virker)
- Alle mails får automatisk retry på fejl, en kø der overlever rate-limits, og logning i `email_send_log`-tabellen
- Du kan se mail-historik og status i **Cloud → Emails**

---

### Filer der ændres

| Fil | Ændring |
|-----|---------|
| `supabase/functions/_shared/transactional-email-templates/invitation.tsx` | NY — React Email-version af invitations-mailen |
| `supabase/functions/_shared/transactional-email-templates/manual-reminder.tsx` | NY |
| `supabase/functions/_shared/transactional-email-templates/weekly-reminder.tsx` | NY |
| `supabase/functions/_shared/transactional-email-templates/password-reset.tsx` | NY (hvis relevant) |
| `supabase/functions/_shared/transactional-email-templates/registry.ts` | NY — registry over alle skabeloner |
| `supabase/functions/send-invitations/index.ts` | Erstat Resend med `send-transactional-email` |
| `supabase/functions/send-manual-reminder/index.ts` | Samme |
| `supabase/functions/send-weekly-lunch-reminder/index.ts` | Samme |
| `supabase/functions/send-password-reset/index.ts` | Samme |
| `supabase/functions/_shared/email-templates/*.tsx` | NY — auth-skabeloner med Plus-branding |
| `supabase/functions/auth-email-hook/index.ts` | NY — hook der ruter auth-mails gennem Lovable |
| `src/pages/EmailUnsubscribe.tsx` | NY — unsubscribe-side |
| `src/App.tsx` | Tilføj route til unsubscribe-siden |

---

### Rækkefølge for udførelse

1. Sæt `mail.frokost.pluskontoret.dk` op (du tilføjer NS-records hos domæne-udbyder)
2. Setup email infrastruktur (kø + tabeller)
3. Fase 1: scaffold + brand auth-skabeloner + deploy `auth-email-hook`
4. Fase 2: scaffold transactional + skriv skabeloner + opdater 4 edge-funktioner + lav unsubscribe-side
5. Test af både auth (request OTP-kode) og transactional (send test-invitation)
6. Fjern `RESEND_API_KEY` fra secrets

DNS-verifikation kan tage timer — alt scaffolding og deployment kan dog køres inden DNS er færdigt; mailene skifter automatisk over når DNS er verificeret. Indtil da bruges Resend (Fase 2) og standard Supabase-skabeloner (Fase 1).
