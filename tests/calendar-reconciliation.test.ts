import { test } from "node:test";
import assert from "node:assert/strict";
import { decideChange, graphPages, readSource, reconcileCalendarOrders, type Meeting, type Order } from "../supabase/functions/_shared/calendar-reconciliation.ts";

const order: Order = { id: "order", meeting_external_id: "ical", meeting_date: "2026-09-22",
  meeting_time: "10:00 - 11:00", meeting_location: "A", meeting_subject: "Møde", updated_at: "2026-09-22T07:00:00Z" };
const event: Meeting = { id: "immutable", iCalUId: "ical", subject: "Møde",
  start: { dateTime: "2026-09-22T10:00:00.0000000", timeZone: "Europe/Copenhagen" },
  end: { dateTime: "2026-09-22T11:00:00.0000000", timeZone: "Europe/Copenhagen" }, location: { displayName: "A" } };

test("existing meeting is preserved independently of order ownership", () => {
  assert.equal(decideChange(order, event), null);
});
test("date move outside displayed week cancels and carries the new date", () => {
  const moved = { ...event, start: { ...event.start, dateTime: "2027-01-04T10:00:00" }, end: { ...event.end, dateTime: "2027-01-04T11:00:00" } };
  assert.deepEqual(decideChange(order, moved), { kind: "moved", date: "2027-01-04", time: "10:00 - 11:00", location: "A", subject: "Møde" });
});
test("start or end time changes cancel", () => {
  assert.equal(decideChange(order, { ...event, start: { ...event.start, dateTime: "2026-09-22T10:30:00" } })?.kind, "moved");
  assert.equal(decideChange(order, { ...event, end: { ...event.end, dateTime: "2026-09-22T11:30:00" } })?.kind, "moved");
});
test("location and title changes are distinct; whitespace is harmless", () => {
  assert.equal(decideChange(order, { ...event, location: { displayName: "B" } })?.kind, "location");
  assert.equal(decideChange(order, { ...event, subject: "Nyt navn" })?.kind, "subject");
  assert.equal(decideChange(order, { ...event, location: { displayName: " a " } }), null);
});
test("explicit cancellation or verified deletion cancels", () => {
  assert.equal(decideChange(order, null)?.kind, "cancelled");
  assert.equal(decideChange(order, { ...event, isCancelled: true })?.kind, "cancelled");
});
test("identity mismatch and unexpected time zones fail closed", () => {
  assert.throws(() => decideChange(order, { ...event, iCalUId: "different" }));
  assert.throws(() => decideChange(order, { ...event, start: { ...event.start, timeZone: "UTC" } }));
});
test("Copenhagen wall-clock times stay unchanged over DST dates", () => {
  for (const date of ["2026-03-29", "2026-10-25"]) {
    assert.equal(decideChange({ ...order, meeting_date: date }, { ...event,
      start: { ...event.start, dateTime: `${date}T10:00:00` }, end: { ...event.end, dateTime: `${date}T11:00:00` } }), null);
  }
});
test("pagination follows all pages including an empty final page", async (t) => {
  let count = 0;
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(++count === 1
    ? { value: [event], "@odata.nextLink": "https://graph.microsoft.com/v1.0/next" } : { value: [] })));
  assert.equal((await graphPages("https://graph.microsoft.com/v1.0/start", "token")).length, 1);
  assert.equal(count, 2);
});
test("failed second page never returns a partial snapshot", async (t) => {
  let count = 0;
  t.mock.method(globalThis, "fetch", async () => ++count === 1
    ? new Response(JSON.stringify({ value: [event], "@odata.nextLink": "https://graph.microsoft.com/v1.0/next" }))
    : new Response("", { status: 429 }));
  await assert.rejects(graphPages("https://graph.microsoft.com/v1.0/start", "token"));
});
test("non-Graph pagination links fail closed", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ value: [], "@odata.nextLink": "https://example.com/token" })));
  await assert.rejects(graphPages("https://graph.microsoft.com/v1.0/start", "token"));
});
const source = { order_id: "order", mailbox: "organizer@example.com", event_id: "immutable", external_id: "ical" };
test("404 establishes deletion only if organizer calendar is accessible", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => String(url).includes("/events/")
    ? new Response(JSON.stringify({ error: { code: "ErrorItemNotFound" } }), { status: 404 })
    : new Response(JSON.stringify({ id: "calendar" })));
  assert.equal(await readSource(source, "token"), null);
});
test("missing mailbox, forbidden and transient failures preserve orders", async (t) => {
  for (const status of [403, 429, 500, 404]) {
    const mock = t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ error: { code: "ErrorItemNotFound" } }), { status }));
    await assert.rejects(readSource(source, "token"));
    mock.mock.restore();
  }
});

function fakeDatabase(savedSource: typeof source | null) {
  const mutations: unknown[] = [];
  const filters: unknown[] = [];
  const db = {
    from(table: string) {
      const query = {
        select: () => query, in: () => query, gte: () => query, lt: () => query,
        order: () => query, range: () => query, single: () => query, maybeSingle: () => query,
        eq: (column: string, value: string) => { filters.push([column, value]); return query; },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve(resolve({ error: null, data: table === "catering_orders" ? [order]
            : table === "company_settings" ? { resource_room_emails: ["room@example.com"] } : savedSource }));
        },
      };
      return query;
    },
    async rpc(_name: string, args: unknown) { mutations.push(args); return { data: true, error: null }; },
  };
  return { db: db as unknown as Parameters<typeof reconcileCalendarOrders>[0], mutations, filters };
}
test("unknown missing meeting is preserved even with a successful empty room snapshot", async (t) => {
  const { db, mutations } = fakeDatabase(null);
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ value: [] })));
  const result = await reconcileCalendarOrders(db, "token", "2026-09-22T00:00:00Z", "2026-09-23T00:00:00Z");
  assert.equal(result.skipped, 1);
  assert.equal(mutations.length, 0);
});
test("verified organizer move is processed for any order owner", async (t) => {
  const { db, mutations, filters } = fakeDatabase(source);
  t.mock.method(globalThis, "fetch", async (url) => new Response(JSON.stringify(String(url).includes("/events/")
    ? { ...event, start: { ...event.start, dateTime: "2026-09-22T09:30:00" } } : { value: [] })));
  const result = await reconcileCalendarOrders(db, "token", "2026-09-22T00:00:00Z", "2026-09-23T00:00:00Z");
  assert.equal(result.cancelled, 1);
  assert.equal(mutations.length, 1);
  assert.deepEqual(filters, [["order_id", "order"]]);
});
