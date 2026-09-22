import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getAppToken } from "../_shared/microsoft-auth.ts";

import { reconcileCalendarOrders } from "../_shared/calendar-reconciliation.ts";

function todayInCopenhagen(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
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

    // Cron callers (CRON_SECRET) may use up to 60 days; user callers capped at 30.
    const isCronCaller = !!(cronSecret && bearer === cronSecret);
    let body: { daysAhead?: number; weekStart?: string } = {};
    try { body = await req.json(); } catch { body = {}; }
    const requestedDays = Number(body.daysAhead) || 14;
    const maxDays = isCronCaller ? 60 : 30;
    const daysAhead = Math.floor(Math.min(Math.max(requestedDays, 1), maxDays));
    const requestedStart = (body.weekStart && /^\d{4}-\d{2}-\d{2}$/.test(body.weekStart))
      ? body.weekStart
      : todayInCopenhagen();
    const startDateStr = requestedStart < todayInCopenhagen() ? todayInCopenhagen() : requestedStart;
    const startDate = new Date(`${startDateStr}T00:00:00Z`).toISOString();
    const endDate = new Date(new Date(`${startDateStr}T00:00:00Z`).getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString();


    const appToken = await getAppToken(Deno.env.get("AZURE_TENANT_ID")!, Deno.env.get("AZURE_CLIENT_ID")!, Deno.env.get("AZURE_CLIENT_SECRET")!);
    const result = await reconcileCalendarOrders(serviceClient, appToken, startDate, endDate);
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("reconcile-room-bookings error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
