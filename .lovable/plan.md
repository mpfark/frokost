

## Plan: Omdøb "Tilladt domæne" til "Internt domæne" + tilføj valgfri domænebegrænsning

### Ændringer

**1. Database-migration**
- Tilføj kolonne `restrict_signup_to_domain boolean NOT NULL DEFAULT true` til `company_settings`.
- Default `true` sikrer bagudkompatibilitet (eksisterende adfærd bevares).

**2. GeneralSettings.tsx**
- Omdøb label fra "Tilladt e-mail-domæne" til "Internt domæne".
- Opdater beskrivelsestekst til noget generelt om at identificere virksomhedens domæne.
- Tilføj en Switch/Checkbox under domænefeltet: "Begræns tilmelding til dette domæne" med forklarende tekst.
- Gem den nye indstilling sammen med resten af payload.

**3. AuthForm.tsx**
- Hent `restrict_signup_to_domain` sammen med `allowed_domain` fra `company_settings`.
- Hvis `restrict_signup_to_domain` er `false`, spring domænevalidering over ved signup (brug standard signUpSchema i stedet for domænebegrænset schema).

**4. CateringOrderDialog.tsx**
- Ingen ændring nødvendig — bruger allerede `allowed_domain` til at filtrere interne/eksterne gæster, uafhængigt af signup-begrænsning.

### Tekniske detaljer
- Kolonne: `restrict_signup_to_domain boolean NOT NULL DEFAULT true`
- Feltet `allowed_domain` beholdes som det er i databasen (ingen rename) — kun UI-label ændres.
- `validations.ts` behøver ingen ændring; `AuthForm` vælger bare hvilken schema der bruges.

