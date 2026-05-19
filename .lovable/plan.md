## Mål

Når en ny bruger klikker invitationslinket, skal de logges direkte ind og lande på forsiden — ingen adgangskode-trin. Invitationen er fortsat gyldig i 7 dage.

## Ændringer

### 1. `supabase/functions/generate-invite-link/index.ts`
- Skift `redirectUrl` fra `/set-password` til `/` (forsiden).
- Behold "invite → fallback magiclink" logikken som den er.

### 2. `src/pages/SetPassword.tsx` + rute
- Fjern siden og dens rute fra `src/App.tsx`.
- Hvis vi vil være forsigtige, beholder vi ruten som en redirect til `/` for at undgå brudte links i gamle mails (valgfrit — anbefales i 30 dage).

### 3. Auth-callback / forsiden
- Tjek at `Index`/`AuthForm` korrekt opfanger den session som magic-linket etablerer (Supabase sætter session via URL-fragment automatisk) og viser den indloggede UI uden at vise login-formularen.
- Trigger `accept-invitation` edge function efter session er etableret, så invitationen markeres `accepted` (det sker i dag fra SetPassword — flyttes til en lille effekt i `AuthCallback`/`Index` der kører én gang når en frisk session opdages med `invite_code` i user metadata).

### 4. Invitationsmail
- Opdater teksten i `_shared/email-templates/invite.tsx` (eller den template der bruges af `send-invitations`) så den siger "Klik på linket for at logge ind — ingen adgangskode nødvendig. Linket virker i 7 dage."

### 5. Levetider — uændret
- `invitations.expires_at`: **7 dage** (som i dag).
- Det Supabase-genererede magic action_link genereres on-demand ved klik og er gyldigt ~1 time fra det klik — uændret.

## Teknisk note

Selve invite-koden i DB er den 7-dages "billet". Når brugeren klikker, veksles den til et frisk Supabase magic link som straks bruges. Det betyder brugeren kan klikke det samme invitationsbrev op til 7 dage efter modtagelse, og hver gang få et nyt 1-times login-link uden at skulle vælge adgangskode.

## Filer der ændres

- `supabase/functions/generate-invite-link/index.ts` (redirect URL)
- `src/App.tsx` (fjern/redirect `/set-password`)
- `src/pages/SetPassword.tsx` (slet eller erstat med redirect-stub)
- `src/pages/Index.tsx` eller en ny lille `useEffect` der kalder `accept-invitation` ved første login efter invite
- `supabase/functions/_shared/email-templates/invite.tsx` (mail-tekst)
