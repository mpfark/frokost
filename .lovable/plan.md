## Plan: Passwordless login med engangskode (OTP)

### Mål
Brugere skal kunne logge ind ved blot at indtaste deres email og modtage en 6-cifret engangskode, så de slipper for at huske et password. Adgangskode-login bevares som fallback (admin/kitchen kan stadig bruge det), men brugerne præsenteres for OTP som standard.

### Sådan vil flowet se ud

**Login-skærm (ny standard)**
1. Bruger indtaster email → klikker "Send kode"
2. Supabase sender en 6-cifret kode til emailen (via Lovable's auth email templates)
3. Bruger indtaster koden → logges ind med det samme
4. Sessionen forbliver aktiv som normalt (ingen forskel fra password-login)

**Fallback til password**
- Et lille link "Log ind med adgangskode i stedet" under email-feltet
- Bruges primært af admins/køkken eller hvis email-leveringen fejler

**Førstegangs-tilmelding (uændret)**
- Brugere oprettes stadig via invitation/Webflow-sync
- Når de første gang åbner appen via invite-link, sættes kontoen op uden at de behøver vælge password (Supabase tillader brugere uden password så længe de logger ind med OTP)

### Tekniske ændringer

**1. `src/components/auth/AuthForm.tsx`**
- Default mode skifter fra `signInWithPassword` til OTP-flow
- Tilføj to-trins UI: trin 1 (email-input + "Send kode"), trin 2 (6-cifret kode-input via `InputOTP` fra `src/components/ui/input-otp.tsx`)
- Brug `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })` — `shouldCreateUser: false` sikrer at kun eksisterende brugere kan logge ind (ingen anonyme tilmeldinger)
- Verificering: `supabase.auth.verifyOtp({ email, token, type: 'email' })`
- Tilføj knap "Send ny kode" + countdown (60 sek) for at undgå spam
- Behold password-flow som tilgængeligt via et "Log ind med adgangskode" link

**2. Auth email templates (Lovable Cloud)**
- Tjek om custom auth email templates allerede er sat op for projektet
- Hvis ikke: scaffold dem så "Magic Link / OTP"-emailen får Plus-branding (logo, farver, dansk tekst som "Din login-kode er: 123456")
- Hvis allerede sat op: opdater kun OTP-skabelonen så koden vises tydeligt

**3. `src/pages/AcceptInvitation.tsx` (gennemgang)**
- Sikre at invitations-flowet stadig fungerer — nye brugere skal kunne acceptere invitation uden at vælge password
- Hvis siden i dag tvinger password-valg, skal det gøres valgfrit eller springes over

**4. Admin-side `src/components/admin/UserManagement.tsx` (lille tilpasning)**
- "Send nulstillingslink"-knappen kan blive til "Send login-kode" som primær handling, og password-reset bliver sekundær

### Hvad ændres IKKE
- Eksisterende passwords forbliver gyldige — brugere kan stadig logge ind med password hvis de vil
- Invitation/Webflow-sync flow er uændret
- Admin/kitchen roller og RLS er uændret
- Microsoft-integration, kalendere osv. påvirkes ikke

### Sikkerhedsovervejelser
- `shouldCreateUser: false` forhindrer at fremmede kan oprette konti via OTP-flowet
- Domæne-restriktion (`restrict_signup_to_domain`) gælder stadig for nye signups
- OTP-koder udløber automatisk efter 60 minutter (Supabase default)
- Rate limiting håndteres af Supabase Auth out-of-the-box

### Filer der ændres
| Fil | Ændring |
|-----|---------|
| `src/components/auth/AuthForm.tsx` | Hovedrefaktorering til to-trins OTP-flow + password-fallback |
| `src/pages/AcceptInvitation.tsx` | Gennemgå og tilpas så nye brugere ikke tvinges til password |
| `src/components/admin/UserManagement.tsx` | Mindre tekstændringer på reset-knappen |
| `supabase/functions/_shared/email-templates/magic-link.tsx` | Scaffold/opdater OTP-email med Plus-branding |
| `supabase/functions/auth-email-hook/index.ts` | Scaffold hvis ikke allerede oprettet |

### Spørgsmål inden vi går i gang
Vil du have password-login bevaret som synlig fallback ("Log ind med adgangskode i stedet"-link), eller vil du helt fjerne password-feltet fra login-skærmen og kun beholde OTP? Admins kan stadig bruge "glemt kodeord"-flow uanset hvad.
