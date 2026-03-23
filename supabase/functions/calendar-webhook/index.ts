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
        .select("id, meeting_subject, meeting_date, meeting_time, meeting_location, meeting_external_id, status")
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

      // Fetch calendar events for that range — include iCalUId for matching
      const graphUrl = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${startDate}&endDateTime=${endDate}&$select=subject,start,end,organizer,attendees,location,isAllDay,iCalUId&$top=100`;

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
      const allEvents = (calendarData.value || []).filter((e: any) => !e.isAllDay);

      // Build lookup by iCalUId
      const eventByExternalId = new Map<string, any>();
      for (const e of allEvents) {
        if (e.iCalUId) {
          eventByExternalId.set(e.iCalUId, e);
        }
      }

      // Filter events for orphan detection (same logic as before)
      const filteredEvents = allEvents
        .filter((e: any) => (e.attendees || []).filter((a: any) => a.type !== "resource").length > 0 && e.location?.displayName)
        .filter((e: any) => {
          if (roomDisplayNames.length > 0) {
            const loc = (e.location?.displayName || "").toLowerCase();
            return roomDisplayNames.some((name) => loc.includes(name.toLowerCase()) || name.toLowerCase().includes(loc));
          }
          return true;
        });

      // Build event keys for orphan detection
      const eventKeys = new Set<string>();
      for (const e of filteredEvents) {
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

      // Process each order: detect updates or orphans
      const orphanedIds: string[] = [];
      for (const order of orders) {
        // Try matching by external ID first
        if (order.meeting_external_id) {
          const matchedEvent = eventByExternalId.get(order.meeting_external_id);
          if (matchedEvent) {
            // Event still exists — check if location/time/subject changed
            try {
              const startDt = new Date(matchedEvent.start.dateTime + "Z");
              const endDt = new Date(matchedEvent.end.dateTime + "Z");
              const newDate = startDt.toISOString().split("T")[0];
              const newTime = `${startDt.toTimeString().slice(0, 5)} - ${endDt.toTimeString().slice(0, 5)}`;
              const newLocation = matchedEvent.location?.displayName || null;
              const newSubject = matchedEvent.subject || order.meeting_subject;

              const locationChanged = (newLocation || "") !== (order.meeting_location || "");
              const timeChanged = newTime !== order.meeting_time;
              const dateChanged = newDate !== order.meeting_date;
              const subjectChanged = newSubject !== order.meeting_subject;

              if (locationChanged || timeChanged || dateChanged || subjectChanged) {
                const updates: Record<string, unknown> = {
                  meeting_location: newLocation,
                  meeting_time: newTime,
                  meeting_date: newDate,
                  meeting_subject: newSubject,
                  status: "pending",
                  confirmed_by: null,
                  confirmed_at: null,
                };
                await serviceClient
                  .from("catering_orders")
                  .update(updates)
                  .eq("id", order.id);

                const changes: string[] = [];
                if (locationChanged) changes.push(`lokale: "${order.meeting_location || "?"}" → "${newLocation || "?"}"`);
                if (timeChanged) changes.push(`tid: ${order.meeting_time} → ${newTime}`);
                if (dateChanged) changes.push(`dato: ${order.meeting_date} → ${newDate}`);
                if (subjectChanged) changes.push(`emne ændret`);

                console.log(`Updated order ${order.id} for user ${userId}: ${changes.join(", ")}`);
              }
            } catch (e) {
              console.error("Error checking event changes:", e);
            }
            continue; // matched by external ID, skip orphan check
          }
        }

        // Fallback: legacy key matching for orphan detection
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
