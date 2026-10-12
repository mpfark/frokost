// Run with PGLITE_TEST_PACKAGE pointing to an isolated PGlite installation.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(process.env.PGLITE_TEST_PACKAGE || import.meta.url);
const { PGlite } = require('@electric-sql/pglite');
const db = new PGlite();
const admin = '11111111-1111-4111-8111-111111111111';
const employee = '22222222-2222-4222-8222-222222222222';
const kitchen = '33333333-3333-4333-8333-333333333333';
await db.exec(`
  CREATE ROLE authenticated; CREATE ROLE anon;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
    $$ SELECT nullif(current_setting('test.user_id', true), '')::uuid $$;
  CREATE TYPE app_role AS ENUM ('admin', 'kitchen', 'employee');
  CREATE TABLE profiles(id uuid PRIMARY KEY, is_active boolean);
  CREATE TABLE user_roles(user_id uuid, role app_role);
  CREATE FUNCTION has_role(u uuid, r app_role) RETURNS boolean LANGUAGE sql AS
    $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=u AND role=r) $$;
  CREATE TABLE closed_dates(date date);
  CREATE TABLE lunch_optouts(id uuid DEFAULT gen_random_uuid(), user_id uuid, lunch_date date, UNIQUE(user_id,lunch_date));
  CREATE TABLE lunch_signups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, lunch_date date);
  CREATE TABLE guests(signup_id uuid REFERENCES lunch_signups(id) ON DELETE CASCADE);
  INSERT INTO profiles VALUES ('${admin}',true),('${employee}',true),('${kitchen}',true);
  INSERT INTO user_roles VALUES ('${admin}','admin'),('${kitchen}','kitchen');
`);
await db.exec(readFileSync(new URL('../supabase/migrations/20261012120000_admin_lunch_absence.sql', import.meta.url), 'utf8'));
const { rows: [dates] } = await db.query(`SELECT
  (date_trunc('week', now() AT TIME ZONE 'Europe/Copenhagen')::date + 14)::text AS start,
  (date_trunc('week', now() AT TIME ZONE 'Europe/Copenhagen')::date + 20)::text AS finish,
  (date_trunc('week', now() AT TIME ZONE 'Europe/Copenhagen')::date + 16)::text AS closed`);
async function actor(id) { await db.query("SELECT set_config('test.user_id', $1, false)", [id]); }
async function apply(remove = false, start = dates.start, end = dates.finish, user = employee) {
  return (await db.query('SELECT admin_set_lunch_absence($1,$2,$3,$4) AS count', [user,start,end,remove])).rows[0].count;
}
async function count(table) { return (await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n; }
for (const id of ['', employee, kitchen]) {
  await actor(id);
  await assert.rejects(apply(), /Kun administratorer/);
}
await actor(admin);
await db.exec(`UPDATE profiles SET is_active=false WHERE id='${admin}'`);
await assert.rejects(apply(), /Kun administratorer/);
await db.exec(`UPDATE profiles SET is_active=true WHERE id='${admin}'`);
await assert.rejects(apply(false, dates.finish, dates.start), /gyldig periode/);
await assert.rejects(apply(false, '2000-01-01', dates.finish), /gyldig periode/);
await assert.rejects(apply(false, null, dates.finish), /gyldig periode/);
await assert.rejects(apply(false, dates.start, dates.finish, '44444444-4444-4444-8444-444444444444'), /findes ikke/);
await db.query('INSERT INTO closed_dates VALUES ($1)', [dates.closed]);
await db.query('INSERT INTO lunch_signups(user_id,lunch_date) VALUES ($1,$2),($1,$3)', [employee, dates.start, dates.closed]);
await db.exec('INSERT INTO guests SELECT id FROM lunch_signups');
assert.equal(await apply(), 4); // Five weekdays, one closed day; no weekend optouts.
assert.equal(await count('lunch_optouts'), 4);
assert.equal(await count('lunch_signups'), 1); // Closed-day signup untouched.
assert.equal(await count('guests'), 1);
assert.equal(await apply(), 0); // Repeated periods do not duplicate optouts.
assert.equal(await apply(true), 4);
assert.equal(await count('lunch_optouts'), 0);
assert.equal(await count('lunch_signups'), 1); // Cancellation does not restore signups.

// A signup-delete failure must roll back the optouts inserted in the same call.
await db.query('INSERT INTO lunch_signups(user_id,lunch_date) VALUES ($1,$2)', [employee,dates.start]);
await db.exec(`CREATE FUNCTION reject_delete() RETURNS trigger LANGUAGE plpgsql AS
  $$ BEGIN RAISE EXCEPTION 'test deletion failure'; END $$;
  CREATE TRIGGER reject_delete BEFORE DELETE ON lunch_signups FOR EACH ROW EXECUTE FUNCTION reject_delete();`);
await assert.rejects(apply(), /test deletion failure/);
assert.equal(await count('lunch_optouts'), 0);
assert.equal(await count('lunch_signups'), 2);
await db.exec('SET ROLE anon');
await assert.rejects(apply(), /permission denied/);
await db.exec('RESET ROLE');
await db.close();
console.log('PASS: admin access, dates, weekends, closures, guests, overlapping periods, cancellation and transaction rollback');
