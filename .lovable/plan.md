## Hvad jeg fandt

Databasen er 3,20 GB. Heraf er **3,25 GB** (99 %) tabellen `cron.job_run_details` — Postgres' interne log over hver eneste cron-kørsel. Alle dine egne tabeller fylder under 10 MB tilsammen.

Den gamle 5-sekunders email-cron skrev 17.280 rækker/døgn i måneder. Selv efter vi sænkede frekvensen, bliver gamle rækker liggende for evigt fordi pg_cron ikke selv rydder op.

Det forklarer hvorfor:
- Frokost fylder ~3 GB hvor dine andre projekter fylder <1 GB
- Optimering af trafik ikke flyttede `Cloud compute pico` mærkbart: instansen bruger stadig CPU/RAM/IO på autovacuum, backups og query-planning over 3 GB bloat
- "DB-størrelse driver prisen"-hypotesen var delvist rigtig, men årsagen var ikke dine data — det var log-bloat

## Plan

### 1. Truncate `cron.job_run_details` nu (migration)
Tømmer hele tabellen i én operation. Ingen funktionel påvirkning — det er kun historiske run-logs, ikke selve jobbene. Forventet effekt: DB falder fra 3,2 GB til ~10 MB.

### 2. Auto-cleanup hver nat (migration)
Nyt cron-job `cleanup-cron-history` der kører kl. 03:00 og sletter rækker ældre end 7 dage fra `cron.job_run_details`. Sikrer at problemet ikke kommer tilbage. 7 dage er rigeligt til debugging af fejlede jobs.

### 3. Tjek de 712k rolled-back transactions
Efter truncate kigger jeg i `pg_stat_database` og edge function-logs for at se om noget stadig fejler løbende (kunne være en trigger eller en webhook der rammer en låst række). Hvis tallet vokser hurtigt igen efter restart-vinduet, har vi et separat problem at fixe.

### 4. Formulere support-spørgsmål (kun hvis 1+2 ikke flytter prisen)
Hvis `Cloud compute pico` ikke falder mærkbart inden for 3-5 dage efter oprydningen, skriver jeg et konkret spørgsmål til Lovable support: "DB er nu 10 MB, trafik er minimeret, men pico koster stadig X credits/dag — hvad driver prisen på vores instans?" Det er først meningsfuldt at spørge når vi har elimineret den åbenlyse årsag.

## Hvad jeg IKKE foreslår længere
- **Retention på dine egne tabeller** (signup_audit_log, email_send_log osv.) — de fylder kilobytes, ikke gigabytes. Spild af tid.
- **Yderligere React Query / polling-optimering** — vi har allerede gjort det relevante, og det var ikke flaskehalsen.

## Forventet effekt
- DB-størrelse: 3,2 GB → ~10 MB (–99 %)
- Backup-tid, autovacuum-arbejde, RAM-cache-pres falder markant
- `Cloud compute pico` *bør* falde til niveau med dine andre projekter (~0,05-0,2 credits/dag). Hvis ikke, har vi nu et rent grundlag at gå til support med.

## Ærlig caveat
Jeg ved stadig ikke den eksakte Lovable Cloud-prisformel. Men fundet her er så ekstremt (99 % bloat fra én log-tabel) at det med meget høj sandsynlighed er hovedforklaringen. Hvis prisen ikke falder efter dette, så ved vi at det ER instansens grundpris og ikke aktivitet — og så er svaret enten at acceptere prisen eller kontakte support.
