# Microsoft som eneste login

## Kodeændringer

- Forsiden viser kun den eksisterende Microsoft-knap gennem Lovables Cloud Auth-integration.
- OTP-formular, adgangskode-/invitationsloginsider, ubrugte valideringsregler, OTP-komponent og dens pakke samt seks Auth-mailtemplates er fjernet.
- `/accept-invitation/:inviteCode` og `/set-password` viderestiller til forsiden uden at generere eller videresende loginlinks.
- Invitationer er fortsat almindelige mails. Modtageren skal selv logge ind med Microsoft med samme arbejdsmail. Kun ikke-udløbne invitationer til den godkendte brugers bekræftede e-mail markeres accepteret.
- Microsoft-tokenudvekslingen kontrollerer nu også fejl returneret fra `setSession`.
- Brugeroplysninger, rettigheder, kalenderforbindelsen og historiske databaseændringer er bevaret. Microsofts kalenderforbindelse er en særskilt integration og er ikke fjernet.
- `generate-invite-link` og `validate-invitation` indeholder kun et afvisningssvar (410). `auth-email-hook` afviser Auth-mails (403). Disse små kompatibilitetsfiler beholdes for at overskrive allerede udgivne funktioner; slettede filer på GitHub sletter ikke nødvendigvis de kørende funktioner.
- Mailkøen flytter ventende Auth-mails til fejlkøen uden at sende dem. Almindelige invitationer og frokostpåmindelser behandles fortsat.
- Tekstlåsefilerne er opdateret for fjernelsen af `input-otp`. Den gamle ekstra `bun.lockb` er fjernet; `bun.lock` bevares. Det eksisterende mismatch mellem npm-manifest og låsefil er ikke generelt repareret i denne ændring.

## Nødvendig opsætning i Lovable Cloud

**Kodeændringerne deaktiverer ikke i sig selv Supabase Auths offentlige login-API.** Projektets aktuelle Auth-indstillinger er ikke læst eller ændret under denne opgave.

1. Kontrollér Microsoft-login for både en eksisterende administrator og en almindelig bruger, før andre loginmetoder deaktiveres.
2. Deaktivér e-mail-/adgangskodelogin, e-mail-OTP/magic links, telefonlogin, anonymt login og eventuelle øvrige loginudbydere. Bevar den allerede fungerende Microsoft-konfiguration og dens tilladte returadresser. Ændr ikke Microsoft-integrationen til en anden provider som led i oprydningen.
3. Kontrollér, hvordan Lovables Microsoft-integration opretter nye brugere. Slå ikke global brugeroprettelse fra uden at teste, at nye inviterede Microsoft-brugere fortsat kan komme ind. Invitationen er ikke i sig selv en ny serverbaseret adgangsregel; organisationens Microsoft-/tenantbegrænsning skal bevares.
4. Bevar eksisterende konti og identiteter, så bruger-id'er, roller, tilmeldinger og historik ikke mister forbindelsen. Kontrollér, at Microsoft-login med samme e-mail bruger den eksisterende konto. Opret ikke erstatningskonti som standardløsning.
5. Udgiv `generate-invite-link`, `validate-invitation`, `auth-email-hook`, `accept-invitation`, `process-email-queue` og `send-transactional-email` inklusive de ændrede fælles filer. Den sidste funktion indeholder den opdaterede invitationstemplate. Udgiv også `preview-transactional-email`, hvis preview bruges.
6. Afkobl den gamle Auth-mailhook i Cloud, når e-mail-login er deaktiveret. Hvis `send-password-reset` findes som gammel udgivet funktion, så slet eller deaktivér den. Den eksisterede kun som konfigurationsreference i denne version af repositoryet.
7. Publicér brugerfladen. Kontrollér de gamle login- og invitationsadresser og direkte forsøg på e-mailkode, adgangskodelogin og gamle loginlinks — de skal ikke kunne starte nye sessioner.
8. Allerede udstedte sessioner og links kan have en restlevetid. Hvis overgangen skal gælde alle eksisterende sessioner med det samme, skal sessionsinvalidering planlægges og gennemføres gennem Auth-administration. Der er ikke logget brugere ud som del af kodearbejdet.

De gamle afvisningsfunktioner kan slettes fra kode og Cloud i en senere oprydning, når de er afkoblet, og deres offentlige adresser er verificeret utilgængelige. Fjern dem ikke kun fra kode, mens en gammel version stadig er udgivet.

## Test

Kør med Node 24 og projektets afhængigheder:

```sh
node --test --test-isolation=none tests/microsoft-only-auth.test.ts
node --test --test-isolation=none tests/microsoft-login.test.mjs
node --test --test-isolation=none tests/microsoft-email-queue.test.mjs
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

Testene bruger den faktiske loginvisning, Auth-adapter, afvisningsfunktioner og mailkø med eksterne tjenester erstattet af lokale testmodeller. De verificerer ikke en rigtig Microsoft-loginrunde, produktionsindstillinger eller kontosammenkædning i Cloud. Bygningen er kontrolleret med en diagnostisk installation uden ændring af låsefilernes øvrige afhængigheder.

Officiel baggrund:
- [Supabase: Password-based Auth](https://supabase.com/docs/guides/auth/passwords)
- [Supabase: Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Supabase: General configuration](https://supabase.com/docs/guides/auth/general-configuration)
