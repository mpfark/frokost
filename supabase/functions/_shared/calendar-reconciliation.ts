import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface Meeting {
  id: string;
  iCalUId: string;
  subject?: string;
  isCancelled?: boolean;
  isAllDay?: boolean;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName?: string };
  organizer?: { emailAddress?: { address?: string } };
}
export interface Order {
  id: string;
  meeting_external_id: string | null;
  meeting_date: string;
  meeting_time: string;
  meeting_location: string | null;
  meeting_subject: string;
  updated_at: string;
}
export interface Change {
  kind: "moved" | "cancelled" | "location" | "subject";
  date?: string;
  time?: string;
  location?: string | null;
  subject?: string;
}
const graphRoot = "https://graph.microsoft.com/v1.0";
const select = "id,iCalUId,subject,start,end,location,organizer,isCancelled,isAllDay";
const normalize = (value: string | null | undefined) => (value || "").trim().replace(/\s+/g, " ");

// Graph is explicitly requested to return Copenhagen wall-clock values.
// Never append Z to these local values (that shifts times around DST).
function wallClock(value: { dateTime: string; timeZone: string }) {
  if (value.timeZone !== "Europe/Copenhagen") throw new Error("Unexpected Graph timezone");
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value.dateTime);
  if (!match) throw new Error("Invalid Graph date");
  return { date: match[1], time: match[2] };
}

export function decideChange(order: Order, event: Meeting | null): Change | null {
  if (!event) return { kind: "cancelled" };
  if (event.iCalUId !== order.meeting_external_id) throw new Error("Meeting identity mismatch");
  if (event.isCancelled) return { kind: "cancelled" };
  const start = wallClock(event.start);
  const end = wallClock(event.end);
  const next = { date: start.date, time: `${start.time} - ${end.time}`,
    location: normalize(event.location?.displayName) || null,
    subject: event.subject || order.meeting_subject };
  if (event.isAllDay || start.date !== end.date || next.date !== order.meeting_date ||
      next.time !== normalize(order.meeting_time).replace(/\s*-\s*/g, " - ")) {
    return { kind: "moved", ...next };
  }
  if (normalize(next.location).toLowerCase() !== normalize(order.meeting_location).toLowerCase()) {
    return { kind: "location", ...next };
  }
  if (next.subject !== order.meeting_subject) return { kind: "subject", ...next };
  return null;
}

export function graphHeaders(token: string) {
  return { Authorization: `Bearer ${token}`,
    Prefer: 'outlook.timezone="Europe/Copenhagen", IdType="ImmutableId"' };
}

export async function graphPages<T>(url: string, token: string): Promise<T[]> {
  const result: T[] = [];
  const seen = new Set<string>();
  while (url) {
    if (!url.startsWith(`${graphRoot}/`) || seen.has(url) || seen.size >= 100) {
      throw new Error("Unsafe or incomplete Graph pagination");
    }
    seen.add(url);
    const response = await fetch(url, { headers: graphHeaders(token), signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Graph fetch failed (${response.status})`);
    const page = await response.json();
    if (!Array.isArray(page.value)) throw new Error("Incomplete Graph response");
    result.push(...page.value);
    url = page["@odata.nextLink"] || "";
  }
  return result;
}

function calendarUrl(mailbox: string, start: string, end: string) {
  const params = new URLSearchParams({ startDateTime: start, endDateTime: end, "$select": select, "$top": "200" });
  return `${graphRoot}/users/${encodeURIComponent(mailbox)}/calendarView?${params}`;
}

interface Source { order_id: string; mailbox: string; event_id: string; external_id: string }

export async function readSource(source: Source, token: string): Promise<Meeting | null> {
  const mailbox = `${graphRoot}/users/${encodeURIComponent(source.mailbox)}`;
  const response = await fetch(`${mailbox}/events/${encodeURIComponent(source.event_id)}?$select=${select}`,
    { headers: graphHeaders(token), signal: AbortSignal.timeout(20000) });
  if (response.ok) return await response.json();
  const body = await response.json().catch(() => ({}));
  if (response.status !== 404 || body.error?.code !== "ErrorItemNotFound") {
    throw new Error(`Unable to verify meeting (${response.status})`);
  }
  // A missing/inaccessible mailbox must not look like a deleted meeting.
  const calendar = await fetch(`${mailbox}/calendar?$select=id`,
    { headers: graphHeaders(token), signal: AbortSignal.timeout(20000) });
  if (!calendar.ok) throw new Error("Unable to verify organizer calendar");
  return null;
}

/** Both the authenticated endpoint and Graph webhook use this implementation.
 * Order ownership is deliberately unrelated to the calendar being checked.
 * Only an organizer's previously verified event may establish deletion.
 */
export async function reconcileCalendarOrders(db: SupabaseClient, token: string, start: string, end: string) {
  const orders: Order[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("catering_orders")
      .select("id,meeting_external_id,meeting_date,meeting_time,meeting_location,meeting_subject,updated_at")
      .in("status", ["pending", "confirmed"]).gte("meeting_date", start.slice(0, 10))
      .lt("meeting_date", end.slice(0, 10)).order("id").range(offset, offset + 499);
    if (error) throw error;
    orders.push(...data);
    if (data.length < 500) break;
  }
  const { data: settings, error: settingsError } = await db.from("company_settings").select("resource_room_emails").single();
  if (settingsError) throw settingsError;
  const rooms: string[] = settings.resource_room_emails || [];
  // Include local midnight at either DST offset when discovering references.
  // The order query above still uses the exact requested dates.
  const discoveryStart = new Date(new Date(start).getTime() - 86400000).toISOString();
  const discoveryEnd = new Date(new Date(end).getTime() + 86400000).toISOString();
  const roomEvents: Meeting[] = [];
  // Partial room snapshots may discover an event, but never establish absence.
  for (const room of rooms) {
    try { roomEvents.push(...await graphPages<Meeting>(calendarUrl(room, discoveryStart, discoveryEnd), token)); }
    catch (error) { console.warn("Room discovery deferred", room, error); }
  }
  const organizerCalendars = new Map<string, Promise<Meeting[]>>();
  let cancelled = 0, updated = 0, skipped = 0;
  const cancelledIds: string[] = [];
  for (const order of orders) {
    try {
      if (!order.meeting_external_id) { skipped++; continue; }
      const { data: saved, error } = await db.from("catering_calendar_sources").select("*").eq("order_id", order.id).maybeSingle();
      if (error) throw error;
      let source: Source | null = saved?.external_id === order.meeting_external_id ? saved : null;
      if (!source) {
        const candidate = roomEvents.find(event => event.iCalUId === order.meeting_external_id && !event.isCancelled);
        const mailbox = candidate?.organizer?.emailAddress?.address?.toLowerCase();
        if (!mailbox) { skipped++; continue; }
        if (!organizerCalendars.has(mailbox)) {
          organizerCalendars.set(mailbox, graphPages<Meeting>(calendarUrl(mailbox, discoveryStart, discoveryEnd), token));
        }
        const matches = (await organizerCalendars.get(mailbox)!).filter(event => event.iCalUId === order.meeting_external_id);
        if (matches.length !== 1) { skipped++; continue; }
        source = { order_id: order.id, mailbox, event_id: matches[0].id, external_id: order.meeting_external_id };
        const { error: saveError } = await db.from("catering_calendar_sources").upsert(source);
        if (saveError) throw saveError;
      }
      // Direct immutable ID lookup also finds moves outside the displayed week,
      // removed room invitations and recurring exceptions.
      const event = await readSource(source, token);
      const change = decideChange(order, event);
      if (!change) continue;
      const { data: applied, error: applyError } = await db.rpc("apply_calendar_order_change", {
        p_order_id: order.id, p_expected_updated_at: order.updated_at, p_change: change,
      });
      if (applyError) throw applyError;
      if (!applied) { skipped++; continue; }
      if (change.kind === "moved" || change.kind === "cancelled") { cancelled++; cancelledIds.push(order.id); }
      else updated++;
    } catch (error) {
      skipped++;
      console.error("Calendar order check deferred", order.id, error);
    }
  }
  return { checked: orders.length, cancelled, updated, skipped, cancelled_ids: cancelledIds };
}
