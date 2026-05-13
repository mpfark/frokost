import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getAppToken } from "../_shared/microsoft-auth.ts";

interface CateringOrder {
  id: string;
  meeting_subject: string;
  meeting_date: string;
  meeting_time: string;
  meeting_location: string | null;
  meeting_external_id: string | null;
  status: string;
}

function todayInCopenhagen(): string {
  // ISO date (yyyy-mm-dd) in Europe/Copenhagen
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function locationMatchesRoom(loc: string | null, roomNames: string[]): string | null {
  if (!loc) return null;
  const locLower = loc.toLowerCase();
  for (const name of roomNames) {
    const n = name.toLowerCase();
    if (locLower.includes(n) || n.includes(locLower)) return name;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth: either CRON_SECRET bearer or a valid user JWT
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "");
    const cronSecret = Deno.env.get("CRON_SECRET");
    let isAuthorized = false;
    if (cronSecret && bearer === cronSecret) {
      isAuthorized = true;
    } else if (bearer) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(bearer);
      if (!claimsError && claimsData?.claims) isAuthorized = true;
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const daysAhead = Math.min(Math.max(Number(body.daysAhead) || 14, 1), 60);
    const startDateStr = (body.weekStart && /^\d{4}-\d{2}-\d{2}$/.test(body.weekStart))
      ? body.weekStart
      : todayInCopenhagen();
    const startDate = new Date(`${startDateStr}T00:00:00Z`).toISOString();
    const endDate = new Date(new Date(`${startDateStr}T00:00:00Z`).getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

    // Resource room emails
    const { data: settings } = await serviceClient
      .from("company_settings")
      .select("resource_room_emails")
      .single();
    const roomEmails: string[] = (settings as any)?.resource_room_emails || [];
    if (roomEmails.length === 0) {
      return new Response(JSON.stringify({ checked: 0, cancelled: 0, cancelled_ids: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = Deno.env.get("AZURE_TENANT_ID")!;
    const clientId = Deno.env.get("AZURE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET")!;
    const appToken = await getAppToken(tenantId, clientId, clientSecret);

    // Fetch room display names
    const roomNamesByEmail: Record<string, string> = {};
    try {
      const placesRes = await fetch("https://graph.microsoft.com/v1.0/places/microsoft.graph.room", {
        headers: { Authorization: `Bearer ${appToken}`, "Content-Type": "application/json" },
      });
      if (placesRes.ok) {
        const placesData = await placesRes.json();
        const lower = new Set(roomEmails.map((e) => e.toLowerCase()));
        for (const r of (placesData.value || [])) {
          const email = (r.emailAddress || "").toLowerCase();
          if (lower.has(email) && r.displayName) roomNamesByEmail[email] = r.displayName;
        }
      }
    } catch (e) {
      console.error("Failed to fetch place names:", e);
    }

    // Fallback display names from email local-part
    const allRoomNames: string[] = [];
    const roomsWithSuccess: Set<string> = new Set();
    for (const email of roomEmails) {
      const name = roomNamesByEmail[email.toLowerCase()] ||
        email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      roomNamesByEmail[email.toLowerCase()] = name;
      allRoomNames.push(name);
    }

    // Fetch each room's calendarView; collect alive iCalUIds and key set
    const aliveICalIds = new Set<string>();
    const aliveKeys = new Set<string>(); // subject|date|HH:MM - HH:MM
    const aliveByRoom: Record<string, { ids: Set<string>; keys: Set<string> }> = {};

    for (const email of roomEmails) {
      const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/calendarView?startDateTime=${startDate}&endDateTime=${endDate}&$select=subject,start,end,iCalUId,isAllDay&$top=200`;
      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${appToken}`,
            "Content-Type": "application/json",
            Prefer: 'outlook.timezone="Europe/Copenhagen"',
          },
        });
        if (!res.ok) {
          console.error(`Room ${email} fetch failed:`, res.status);
          continue;
        }
        roomsWithSuccess.add(email.toLowerCase());
        const data = await res.json();
        const ids = new Set<string>();
        const keys = new Set<string>();
        for (const e of (data.value || [])) {
          if (e.isAllDay) continue;
          if (e.iCalUId) {
            aliveICalIds.add(e.iCalUId);
            ids.add(e.iCalUId);
          }
          try {
            const s = new Date(e.start.dateTime + "Z");
            const en = new Date(e.end.dateTime + "Z");
            const date = s.toISOString().split("T")[0];
            const startTime = s.toTimeString().slice(0, 5);
            const endTime = en.toTimeString().slice(0, 5);
            const key = `${e.subject}|${date}|${startTime} - ${endTime}`;
            aliveKeys.add(key);
            keys.add(key);
          } catch {/* skip */}
        }
        aliveByRoom[email.toLowerCase()] = { ids, keys };
      } catch (e) {
        console.error(`Room ${email} error:`, e);
      }
    }

    // Fetch active orders in window
    const endDateStr = endDate.split("T")[0];
    const { data: orders, error: ordersErr } = await serviceClient
      .from("catering_orders")
      .select("id, meeting_subject, meeting_date, meeting_time, meeting_location, meeting_external_id, status")
      .in("status", ["pending", "confirmed"])
      .gte("meeting_date", startDateStr)
      .lte("meeting_date", endDateStr);
    if (ordersErr) throw ordersErr;

    const matchedOrders: CateringOrder[] = [];
    for (const o of (orders || []) as CateringOrder[]) {
      const matched = locationMatchesRoom(o.meeting_location, allRoomNames);
      if (matched) matchedOrders.push(o);
    }

    // Determine orphans
    const orphanIds: string[] = [];
    for (const o of matchedOrders) {
      let alive = false;
      if (o.meeting_external_id) {
        if (aliveICalIds.has(o.meeting_external_id)) alive = true;
      } else {
        const key = `${o.meeting_subject}|${o.meeting_date}|${o.meeting_time}`;
        if (aliveKeys.has(key)) alive = true;
      }
      if (!alive) orphanIds.push(o.id);
    }

    // Cancel orphans
    if (orphanIds.length > 0) {
      // chunk by 50 (per project memory)
      for (let i = 0; i < orphanIds.length; i += 50) {
        const chunk = orphanIds.slice(i, i + 50);
        await serviceClient
          .from("catering_orders")
          .update({ status: "cancelled" })
          .in("id", chunk);
      }
      console.log(`Reconcile: cancelled ${orphanIds.length} orphan order(s)`);
    }

    return new Response(
      JSON.stringify({ checked: matchedOrders.length, cancelled: orphanIds.length, cancelled_ids: orphanIds }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("reconcile-room-bookings error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
