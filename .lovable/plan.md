## Mål
Lukke security-findings uden at bryde det delte forplejnings-/mødelokale-flow, hvor *alle* autentificerede brugere kan se rum-kalendere og oprette/redigere ordrer.

---

## 1. `calendar-webhook` — verificér `clientState` (HØJ prioritet)

**Risiko nu:** Hvem som helst kan POSTe til webhook-URL og udløse Graph-kald + auto-cancel af ordrer.

**Fix (ingen UX-konsekvens):**
- Generér en `GRAPH_WEBHOOK_CLIENT_STATE`-secret (random 32 chars)
- I `microsoft-auth-callback` + alle steder hvor vi opretter Graph-subscriptions: send `clientState` med
- I `calendar-webhook`: afvis 401 hvis `notification.clientState !== Deno.env.get("GRAPH_WEBHOOK_CLIENT_STATE")`
- Bagudkompatibilitet: eksisterende subscriptions har ikke clientState — vi lader webhooken acceptere notifikationer hvor subscription'en blev oprettet før secret blev sat (lookup i `graph_subscriptions`). Når brugerne reconnect'er Microsoft, får de nye subs med clientState. Efter 30 dage håndhæves det strikt.

---

## 2. `send-transactional-email` — kun service_role (HØJ prioritet)

**Verificeret:** Funktionen kaldes *kun* fra andre edge functions (`send-invitations`, `send-manual-reminder`, `send-weekly-lunch-reminder`, `webflow-sync`, `auth-email-hook`, `process-email-queue`). Ingen klient-kald. Sikkert at låse.

**Fix:**
- I funktionen: tjek at JWT-claim `role === 'service_role'`, ellers 403
- Skifter `verify_jwt = false` så vi selv validerer (mere robust og matcher de andre interne functions)
- Ingen UX-konsekvens — alle reelle kaldere bruger allerede service-role key

---

## 3. `get-room-calendars` — server-side email allowlist (MELLEM)

**Bevarer delt funktionalitet:** Alle brugere skal stadig kunne se mødelokale-kalenderen i forplejnings-fanen. Vi *fjerner ikke* role-check ift. autentifikation, men:

**Fix:**
- Tilføj: hent `company_settings.resource_room_emails` server-side, og afvis enhver `roomEmails`-værdi i request body som ikke findes på listen (returner 400)
- Effekt: en autentificeret bruger kan ikke længere bruge funktionen til at læse vilkårlige kollegers kalendere — kun de godkendte mødelokaler

Dette lukker den faktiske exploit (kalender-enumeration) uden at fjerne adgang fra normale brugere.

---

## 4. `reconcile-room-bookings` — hærd cancel-logik (MELLEM)

**Bevarer delt funktionalitet:** Per memory trigges denne både fra cron *og* fra "tab-open" af normale brugere. At begrænse til admin/kitchen ville bryde auto-reconciliation når en bruger åbner mødelokale-fanen.

**Fix uden at fjerne tab-open trigger:**
- Hvis Graph returnerer **0 events** for et rum i hele vinduet → spring cancel-fasen over for det rum og log "skipped (no events)". Det fjerner den faktiske abuse-vektor (deliberat trigger under Graph-nedbrud) uden at ændre normal drift.
- Tilføj rate-limit: maks. 1 reconcile pr. bruger pr. 5 min. (per-user IP/uid bucket i `rate_limits`-tabel)
- Server-side: ignorér `daysAhead > 30` fra ikke-cron-kald (cron må stadig bruge 60)

---

## 5. Database-warnings (LAV — rydder linter op)

### `SECURITY DEFINER` funktioner kaldbare af anon/authenticated
Gennemgang af alle `SECURITY DEFINER` funktioner og:
- `REVOKE EXECUTE ... FROM anon` for funktioner der ikke skal kaldes uden login (fx `cleanup_old_lunch_data`, `expire_old_invitations`, `cleanup_old_rate_limits`, `move_to_dlq`, `read_email_batch`, `delete_email`)
- Behold execute for funktioner som *skal* være kaldbare (`has_role`, `is_platform_admin`)

### `search_path mutable`
Tilføj `SET search_path = public` til de få funktioner der mangler det (`move_to_dlq`, `read_email_batch`, `delete_email`).

---

## 6. Dependency-vulns (LAV — kosmetisk støj)

**Hvad jeg foreslår:** Bump kun pakker med faktisk reel risiko:
- `react-router-dom` 6.30.1 → 6.31.x (XSS via open redirects — vi bruger ikke det mønster, men billig fix)
- `@supabase/supabase-js` 2.80.0 → seneste 2.x (ws DoS — irrelevant i browser, men også billig)

**Spring over:** `recharts` og `vite-plugin-pwa` — deres vulns sidder i transitive devDependencies (lodash i build-tooling, ikke runtime). Bump bryder ofte mere end det fixer.

---

## Rækkefølge & rollback

1. Database-migrations først (search_path + revoke execute) — kan ikke bryde noget
2. `send-transactional-email` lock + `calendar-webhook` clientState — interne funktioner
3. `get-room-calendars` + `reconcile-room-bookings` hærdning — test mødelokale-fanen efter
4. Dependency-bumps til sidst

Hver edge function deployes individuelt, så rollback er pr. funktion hvis noget viser sig.

## Hvad jeg eksplicit IKKE foreslår
- **Ikke** låse `get-room-calendars` til admin/kitchen — bryder delt mødelokale-visning
- **Ikke** låse `reconcile-room-bookings` til admin/kitchen — bryder tab-open auto-reconcile
- **Ikke** håndhæve clientState retroaktivt — kræver alle brugere reconnect'er Microsoft samme dag
