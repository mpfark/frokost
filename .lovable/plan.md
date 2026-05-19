## Problem

1. Når brugeren beder om en login-kode, sender Supabase både et magic link og en 6-cifret kode. Vores `magic-link.tsx` template viser kun en "Log ind"-knap (linket) — koden bliver aldrig vist, selvom appen forventer at brugeren indtaster den i OTP-feltet.
2. Knappen er stylet med `backgroundColor: 'hsl(25, 95%, 37%)'`. Flere mail-klienter (Outlook, Gmail i visse tilfælde) understøtter ikke `hsl()` i inline styles og falder tilbage til transparent/hvid baggrund. Resultat: hvid knap med hvid tekst — usynlig.
3. Login-siden tilbyder tre tilstande på én gang (engangskode + adgangskode-link). Brugeren ønsker at strømline til ét flow.

## Løsning

### 1. Mailen viser nu koden i stedet for en knap
Omskriv `supabase/functions/_shared/email-templates/magic-link.tsx` så den viser den 6-cifrede `token` stort og tydeligt (samme stil som `reauthentication.tsx`), i stedet for en knap med magic link. Fjern `confirmationUrl`-knappen helt. Subject ændres fra "Your login link" → "Din login-kode" i `auth-email-hook/index.ts` (`EMAIL_SUBJECTS.magiclink`).

Template-flowet: Plusfrokost-brand → overskrift "Din login-kode" → kort dansk tekst → stort kode-display → footer om udløb.

### 2. Fix hsl()-farver i alle auth-mail-templates
Konverter `hsl(25, 95%, 37%)` → `#bd5a0e` (primary), `hsl(20, 14%, 15%)` → `#2b2521` (foreground), `hsl(25, 8%, 45%)` → `#75706b` (muted) i:
- `magic-link.tsx`
- `recovery.tsx`
- `reauthentication.tsx`
- `signup.tsx`, `invite.tsx`, `email-change.tsx` (samme problem, samme fix)
- `_shared/transactional-email-templates/password-reset.tsx`

Beholder samme visuelle udtryk, blot i hex så alle mail-klienter renderer korrekt.

### 3. Strømlin login-UI'et
I `src/components/auth/AuthForm.tsx`:
- Fjern `"password"` fra `AuthMode`-typen og hele password-grenen i renderingen.
- Fjern `signInWithPassword`-funktionen og `password`-state.
- Fjern "Log ind med adgangskode i stedet"-link under e-mail-formularen.
- Bevar engangskode-flowet (e-mail → 6-cifret kode → log ind) som det eneste flow.

Adgangskode-baseret login bliver dermed udelukket fra UI'et. Selve Supabase-funktionaliteten røres ikke (admin kan stadig nulstille), men brugerne ser kun OTP-flowet.

### Deploy
Efter ændringer deployes `auth-email-hook` så de nye templates aktiveres.

## Filer der ændres

- `supabase/functions/_shared/email-templates/magic-link.tsx` — omskrives til kode-visning
- `supabase/functions/_shared/email-templates/recovery.tsx` — hsl → hex
- `supabase/functions/_shared/email-templates/reauthentication.tsx` — hsl → hex
- `supabase/functions/_shared/email-templates/signup.tsx` — hsl → hex
- `supabase/functions/_shared/email-templates/invite.tsx` — hsl → hex
- `supabase/functions/_shared/email-templates/email-change.tsx` — hsl → hex
- `supabase/functions/_shared/transactional-email-templates/password-reset.tsx` — hsl → hex
- `supabase/functions/auth-email-hook/index.ts` — opdater `EMAIL_SUBJECTS.magiclink`
- `src/components/auth/AuthForm.tsx` — fjern password-mode
