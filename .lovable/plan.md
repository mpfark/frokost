

## Plan: Hent brugeroversigt fra Microsoft (Azure AD) til invitationer

### Hvad det gør
Tilføjer en ny fane "Microsoft" i invitationssektionen, hvor admin kan hente alle brugere fra organisationens Azure AD (Microsoft Entra ID) via Microsoft Graph API. Listen viser navn og email, og admin kan vælge hvilke brugere der skal inviteres — med automatisk filtrering af brugere der allerede er inviteret eller har en konto.

### Ændringer

**1. Ny edge function: `get-microsoft-users`**
- Bruger Application credentials (Client Credentials flow) med `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` (allerede konfigureret).
- Kalder `https://graph.microsoft.com/v1.0/users?$select=displayName,mail,userPrincipalName&$filter=accountEnabled eq true&$top=999`.
- Kræver admin-rolle (JWT check).
- Returnerer liste af `{ displayName, email }`.
- Bemærk: Kræver `User.Read.All` Application permission i Azure — dette skal muligvis tilføjes i Azure-portalen.

**2. `src/components/InvitationManagement.tsx` — Ny "Microsoft"-fane**
- Tilføj en tredje fane i TabsList: "Microsoft" med et cloud/building-ikon.
- Knap "Hent brugere fra Microsoft" kalder den nye edge function.
- Viser listen med checkboxes. Brugere der allerede er i `profiles` eller har pending/accepted invitationer markeres som "Allerede inviteret" og deaktiveres.
- "Send invitationer til valgte" knap sender de valgte emails via eksisterende `send-invitations` funktion.

**3. `supabase/config.toml` — Tilføj function config**
- Tilføj `[functions.get-microsoft-users]` med `verify_jwt = true`.

### Forudsætning
Azure-appen skal have `User.Read.All` Application permission. Jeg informerer dig om dette under implementeringen, så du kan verificere det i Azure-portalen.

### Filer der ændres
- Ny: `supabase/functions/get-microsoft-users/index.ts`
- Ændret: `src/components/InvitationManagement.tsx`
- Ændret: `supabase/config.toml`

