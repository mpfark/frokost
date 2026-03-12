import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(
  refreshToken: string,
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: "offline_access Calendars.Read",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    console.error("Token refresh error:", await res.text());
    return null;
  }
  return await res.json();
}

async function getValidAccessToken(serviceClient: any, userId: string, tokenData: any) {
  const tenantId = Deno.env.get("AZURE_TENANT_ID")!;
  const clientId = Deno.env.get("AZURE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET")!;

  if (new Date(tokenData.expires_at) <= new Date()) {
    const refreshed = await refreshAccessToken(tokenData.refresh_token, tenantId, clientId, clientSecret);
    if (!refreshed) return null;

    await serviceClient
      .from("microsoft_tokens")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || tokenData.refresh_token,
        expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
      })
      .eq("user_id", userId);

    return refreshed.access_token;
  }
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  // Microsoft Graph sends a validation request with a validationToken query param
  const url = new URL(req.url);
  const validationToken = url.searchParams.get("validationToken");

  if (validationToken) {
    // Must respond with the token as plain text to confirm the subscription
    return new Response(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const notifications = body?.value || [];

    if (notifications.length === 0) {
      return new Response("OK", { status: 200 });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const tenantId = Deno.env.get("AZURE_TENANT_ID")!;
    const clientId = Deno.env.get("AZURE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET")!;

    // Get configured room emails from company settings
    const { data: companySettings } = await serviceClient
      .from("company_settings")
      .select("resource_room_emails")
      .single();
    const resourceRoomEmails: string[] = (companySettings as any)?.resource_room_emails || [];

    // Fetch room display names from Graph API for filtering
    let roomDisplayNames: string[] = [];
    if (resourceRoomEmails.length > 0) {
      try {
        const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        const tokenBody = new URLSearchParams({
          client_id: clientId, client_secret: clientSecret,
          grant_type: "client_credentials", scope: "https://graph.microsoft.com/.default",
        });
        const tokenRes = await fetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: tokenBody.toString() });
        if (tokenRes.ok) {
          const tokenData2 = await tokenRes.json();
          const appToken = tokenData2.access_token;
          const placesRes = await fetch("https://graph.microsoft.com/v1.0/places/microsoft.graph.room", {
            headers: { Authorization: `Bearer ${appToken}`, "Content-Type": "application/json" },
          });
          if (placesRes.ok) {
            const placesData = await placesRes.json();
            const configuredEmailsLower = new Set(resourceRoomEmails.map(e => e.toLowerCase()));
            roomDisplayNames = (placesData.value || [])
              .filter((r: any) => configuredEmailsLower.has((r.emailAddress || "").toLowerCase()))
              .map((r: any) => r.displayName)
              .filter(Boolean);
          }
        }
      } catch (e) {
        console.error("Failed to fetch room display names for webhook:", e);
      }
    }

    // Group notifications by subscriptionId to avoid duplicate work
    const subscriptionIds = [...new Set(notifications.map((n: any) => n.subscriptionId))];

    for (const subscriptionId of subscriptionIds) {
      // Find the user associated with this subscription
      const { data: subData } = await serviceClient
        .from("graph_subscriptions")
        .select("user_id")
        .eq("subscription_id", subscriptionId)
        .single();

      if (!subData) {
        console.warn("No user found for subscription:", subscriptionId);
        continue;
      }

      const userId = subData.user_id;

      // Get user's Microsoft tokens
      const { data: tokenData } = await serviceClient
        .from("microsoft_tokens")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!tokenData) {
        console.warn("No Microsoft tokens for user:", userId);
        continue;
      }

      const accessToken = await getValidAccessToken(serviceClient, userId, tokenData);
      if (!accessToken) {
        console.warn("Could not get valid access token for user:", userId);
        continue;
      }

      // Get pending/confirmed orders for this user (current and future)
      const today = new Date().toISOString().split("T")[0];
      const { data: orders } = await serviceClient
        .from("catering_orders")
        .select("id, meeting_subject, meeting_date, meeting_time, status")
        .eq("user_id", userId)
        .in("status", ["pending", "confirmed"])
        .gte("meeting_date", today);

      if (!orders || orders.length === 0) continue;

      // Determine date range from orders
      const dates = orders.map((o) => o.meeting_date).sort();
      const startDate = new Date(dates[0]).toISOString();
      const lastDate = new Date(dates[dates.length - 1]);
      lastDate.setDate(lastDate.getDate() + 1);
      const endDate = lastDate.toISOString();

      // Fetch calendar events for that range
      const graphUrl = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${startDate}&endDateTime=${endDate}&$select=subject,start,end,organizer,attendees,location,isAllDay&$top=100`;

      const graphRes = await fetch(graphUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!graphRes.ok) {
        console.error("Graph API error for user", userId, ":", graphRes.status);
        continue;
      }

      const calendarData = await graphRes.json();
      const events = (calendarData.value || [])
        .filter((e: any) => !e.isAllDay && (e.attendees || []).filter((a: any) => a.type !== "resource").length > 0 && e.location?.displayName)
        .filter((e: any) => {
          if (roomDisplayNames.length > 0) {
            const loc = (e.location?.displayName || "").toLowerCase();
            return roomDisplayNames.some((name) => loc.includes(name.toLowerCase()) || name.toLowerCase().includes(loc));
          }
          return true;
        });

      // Build event keys
      const eventKeys = new Set<string>();
      for (const e of events) {
        try {
          const startDt = new Date(e.start.dateTime + "Z");
          const endDt = new Date(e.end.dateTime + "Z");
          const date = startDt.toISOString().split("T")[0];
          const startTime = startDt.toTimeString().slice(0, 5);
          const endTime = endDt.toTimeString().slice(0, 5);
          eventKeys.add(`${e.subject}|${date}|${startTime} - ${endTime}`);
        } catch {
          // skip parse errors
        }
      }

      // Find orphaned orders
      const orphanedIds: string[] = [];
      for (const order of orders) {
        const key = `${order.meeting_subject}|${order.meeting_date}|${order.meeting_time}`;
        if (!eventKeys.has(key)) {
          orphanedIds.push(order.id);
        }
      }

      if (orphanedIds.length > 0) {
        console.log(`Auto-cancelling ${orphanedIds.length} orphaned orders for user ${userId}`);
        for (const id of orphanedIds) {
          await serviceClient
            .from("catering_orders")
            .update({ status: "cancelled" })
            .eq("id", id);
        }
        // The database trigger will automatically create kitchen notifications
      }
    }

    // Microsoft requires 202 Accepted
    return new Response("OK", { status: 202 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Error", { status: 200 }); // Don't return 5xx to Microsoft
  }
});
