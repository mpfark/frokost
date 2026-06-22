## Hvad jeg ændrer

### 1. Email-kø: instant flush + 1-min safety-net
- `enqueue_email` RPC udvides: efter den lægger en mail i `pgmq`, kalder den straks `process-email-queue` via `pg_net.http_post` (fire-and-forget). Bruger får uændret hastighed.
- Cron `process-email-queue` ændres fra **hvert 5. sekund → hvert 1. minut** (sikkerhedsnet hvis instant-flush fejler).
- **Effekt:** 17.280 → 1.440 DB-vågninger/dag (–90 %).

### 2. Weekly reminder: kør kun når admin har valgt
- Erstatter `0 * * * *` med ét cron-job der kører **én gang om ugen** på `company_settings.reminder_day` + `reminder_hour` (i dag fredag kl. 8).
- Trigger på `company_settings` re-schedule'r jobbet hvis admin ændrer dag/time/enabled. DST håndteres ved at læse UTC-offset på re-schedule-tidspunktet (worst case: én uges reminder forskydes med 1 time efter et DST-skifte).
- `reminder_enabled = false` → jobbet unschedule'es.
- **Effekt:** 168 → 1 DB-vågning/uge.

### 3. Reconcile room bookings: kun i arbejdstiden, hvert 30. min
- Cron skiftes fra `*/15 * * * *` til `*/30 7-18 * * 1-5` (Europe/Copenhagen via UTC-offset).
- MS Graph-webhooks håndterer stadig real-time ændringer; reconcile er kun safety-net.
- **Effekt:** 96 → ~24 kald/dag (–75 %).

## Samlet forventet effekt
- DB'en får nu reelle tomgangsperioder om natten, weekender og uden for arbejdstid → kan auto-pause.
- `Cloud compute pico` falder fra ~1,86 credits/dag mod **~0,8–1,2 credits/dag** (estimat).
- Ingen funktionel ændring for brugere: emails sendes stadig prompte, reminder kommer på samme tid, room sync er fortsat realtid via webhooks.

## Teknisk implementering
Én migration der:
1. Opdaterer `public.enqueue_email` til at fire-and-forget kalde `process-email-queue` efter `pgmq.send`.
2. Unschedule + re-schedule `process-email-queue` til `* * * * *`.
3. Opretter `public.reschedule_weekly_reminder()` helper + trigger på `company_settings` (AFTER UPDATE OF reminder_day, reminder_hour, reminder_enabled).
4. Unschedule det gamle hourly weekly-reminder job, kalder helper én gang for at oprette det nye.
5. Unschedule + re-schedule `reconcile-room-bookings-15min` til `*/30 7-18 * * 1-5` (omdøbes til `reconcile-room-bookings-workhours`).

Verifikation: efter migration kigger jeg i `cron.job` og `cron.job_run_details` for at bekræfte jobbenes nye frekvens.
