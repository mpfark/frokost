// Run with @electric-sql/pglite installed in an isolated test directory.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(process.env.PGLITE_TEST_PACKAGE || import.meta.url);
const { PGlite } = require('@electric-sql/pglite');
const db = new PGlite();
const migration = name => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const owner = '11111111-1111-4111-8111-111111111111';
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE TABLE profiles(id uuid, full_name text, email text);
  INSERT INTO profiles VALUES ('${owner}', 'Bestiller', 'owner@example.com');
  CREATE TABLE user_notifications(id uuid DEFAULT gen_random_uuid(), user_id uuid, type text, message text, metadata jsonb);
  CREATE TABLE kitchen_notifications(id uuid DEFAULT gen_random_uuid(), order_id uuid, type text, message text, metadata jsonb);
  CREATE TABLE guests(id uuid DEFAULT gen_random_uuid());
`);
await db.exec(migration('20260308202326_51f35b94-ded2-4f24-b3ec-9a254e65bf82.sql').split('ALTER TABLE')[0]);
await db.exec(migration('20260313175819_ff252e3e-9c57-4bb0-9ca2-b4235275d2a7.sql'));
await db.exec(`CREATE TRIGGER original_kitchen AFTER INSERT OR UPDATE OR DELETE ON catering_orders FOR EACH ROW EXECUTE FUNCTION notify_kitchen_on_catering_change();`);
await db.exec(migration('20260313171559_f2634e31-c6fc-421b-bc1e-7b290577f86a.sql'));
await db.exec(migration('20260922120000_calendar_reconciliation.sql'));

async function insert() {
  const { rows } = await db.query(`INSERT INTO catering_orders(user_id, meeting_subject, meeting_date, meeting_time, meeting_location, status)
    VALUES ($1, 'Møde', '2026-09-22', '10:00 - 11:00', 'A', 'confirmed') RETURNING id,updated_at`, [owner]);
  await db.query('INSERT INTO guests(catering_order_id) VALUES ($1)', [rows[0].id]);
  await db.exec('DELETE FROM kitchen_notifications; DELETE FROM user_notifications;');
  return rows[0];
}
async function apply(order, change) {
  return (await db.query('SELECT apply_calendar_order_change($1,$2,$3) AS applied', [order.id, order.updated_at, JSON.stringify(change)])).rows[0].applied;
}
async function counts() {
  return (await db.query('SELECT (SELECT count(*)::int FROM kitchen_notifications) kitchen, (SELECT count(*)::int FROM user_notifications) users')).rows[0];
}
let order = await insert();
assert.equal(await apply(order, {kind:'moved', date:'2026-10-01', time:'12:00 - 13:00'}), true);
assert.equal(await apply(order, {kind:'moved', date:'2026-10-01', time:'12:00 - 13:00'}), false);
assert.deepEqual(await counts(), {kitchen:1, users:1});
assert.equal((await db.query('SELECT status FROM catering_orders WHERE id=$1',[order.id])).rows[0].status,'cancelled');
assert.equal((await db.query('SELECT count(*)::int AS n FROM guests WHERE catering_order_id=$1',[order.id])).rows[0].n,0);
assert.match((await db.query('SELECT message FROM user_notifications')).rows[0].message,/flyttet.*2026-10-01.*bestil igen/);
console.log('PASS: move cancellation, correct message, guest cleanup, repeated request deduplicated');

order = await insert();
assert.equal(await apply(order, {kind:'location', location:'B', subject:'Møde'}), true);
assert.equal(await apply(order, {kind:'location', location:'B', subject:'Møde'}), false);
assert.deepEqual(await counts(), {kitchen:1, users:1});
const row = (await db.query('SELECT status,meeting_location FROM catering_orders WHERE id=$1',[order.id])).rows[0];
assert.deepEqual(row,{status:'confirmed',meeting_location:'B'});
console.log('PASS: room move retains confirmation and sends one notification to each audience');

order = await insert();
assert.equal(await apply(order,{kind:'subject',subject:'Nyt navn'}),true);
assert.deepEqual(await counts(),{kitchen:0,users:0});
await db.query("UPDATE catering_orders SET status='cancelled' WHERE id=$1",[order.id]);
assert.deepEqual(await counts(),{kitchen:1,users:0});
console.log('PASS: title-only preserves order; manual cancellation still notifies kitchen');

order = await insert();
await db.exec(`CREATE FUNCTION reject_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END; $$;
 CREATE TRIGGER reject_notification BEFORE INSERT ON user_notifications FOR EACH ROW EXECUTE FUNCTION reject_notification();`);
await assert.rejects(apply(order,{kind:'cancelled'}));
assert.equal((await db.query('SELECT status FROM catering_orders WHERE id=$1',[order.id])).rows[0].status,'confirmed');
assert.deepEqual(await counts(),{kitchen:0,users:0});
console.log('PASS: notification failure rolls back cancellation atomically');
await db.exec('DROP TRIGGER reject_notification ON user_notifications');

assert.equal((await db.query("SELECT has_function_privilege('authenticated','apply_calendar_order_change(uuid,timestamptz,jsonb)','EXECUTE') AS allowed")).rows[0].allowed,false);
assert.equal((await db.query("SELECT has_function_privilege('service_role','apply_calendar_order_change(uuid,timestamptz,jsonb)','EXECUTE') AS allowed")).rows[0].allowed,true);
console.log('PASS: calendar mutations are service-only');
await db.close();
