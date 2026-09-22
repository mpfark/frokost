import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getAppToken } from "../_shared/microsoft-auth.ts";
import { reconcileCalendarOrders } from "../_shared/calendar-reconciliation.ts";

Deno.serve(async (req) => {
  const validationToken = new URL(req.url).searchParams.get("validationToken");
  if (validationToken) return new Response(validationToken, { headers: { "Content-Type": "text/plain" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    if (!Array.isArray(body.value) || !body.value.length) return new Response("OK");
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let verified = false;
    for (const notification of body.value) {
      if (typeof notification.subscriptionId !== "string") continue;
      const { data: subscription, error } = await db.from("graph_subscriptions")
        .select("client_state").eq("subscription_id", notification.subscriptionId).maybeSingle();
      if (error) throw error;
      // Legacy subscriptions without a secret must renew; cron still reconciles.
      if (subscription?.client_state && subscription.client_state === notification.clientState) verified = true;
    }
    if (!verified) return new Response("OK");
    const token = await getAppToken(Deno.env.get("AZURE_TENANT_ID")!, Deno.env.get("AZURE_CLIENT_ID")!, Deno.env.get("AZURE_CLIENT_SECRET")!);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    // The subscriber need not be the person who placed the order.
    const { data: lastOrder, error } = await db.from("catering_orders").select("meeting_date")
      .in("status", ["pending", "confirmed"]).gte("meeting_date", today)
      .order("meeting_date", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (lastOrder) {
      const end = new Date(`${lastOrder.meeting_date}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      await reconcileCalendarOrders(db, token, `${today}T00:00:00Z`, end.toISOString());
    }
    return new Response("OK", { status: 202 });
  } catch (error) {
    console.error("Calendar webhook failed", error);
    return new Response("Retry later", { status: 503 });
  }
});
