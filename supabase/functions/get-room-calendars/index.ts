import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getAppToken } from "../_shared/microsoft-auth.ts";
import { mapGraphEvent } from "../_shared/graph-utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { startDate, endDate, roomEmails } = await req.json();

    if (!roomEmails || !Array.isArray(roomEmails) || roomEmails.length === 0) {
      return new Response(
        JSON.stringify({ error: "bad_request", message: "roomEmails er påkrævet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = Deno.env.get("AZURE_TENANT_ID")!;
    const clientId = Deno.env.get("AZURE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET")!;

    const accessToken = await getAppToken(tenantId, clientId, clientSecret);

    const start = startDate || new Date().toISOString();
    const end = endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch room display names from Graph API
    let roomDisplayNames: Record<string, string> = {};
    try {
      const placesUrl = "https://graph.microsoft.com/v1.0/places/microsoft.graph.room";
      const placesRes = await fetch(placesUrl, {
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });
      if (placesRes.ok) {
        const placesData = await placesRes.json();
        for (const room of (placesData.value || [])) {
          if (room.emailAddress) {
            roomDisplayNames[room.emailAddress.toLowerCase()] = room.displayName;
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch room names:", e);
    }

    // Fetch calendar events for each room in parallel
    const roomResults = await Promise.all(
      roomEmails.map(async (email: string) => {
        const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/calendarView?startDateTime=${start}&endDateTime=${end}&$select=subject,start,end,organizer,attendees,location,isAllDay,iCalUId&$orderby=start/dateTime&$top=50`;

        const graphRes = await fetch(graphUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Prefer: 'outlook.timezone="Europe/Copenhagen"',
          },
        });

        if (!graphRes.ok) {
          const errorText = await graphRes.text();
          console.error(`Graph API error for ${email}:`, graphRes.status, errorText);
          return { roomEmail: email, displayName: roomDisplayNames[email.toLowerCase()] || null, events: [], error: `API fejl: ${graphRes.status}` };
        }

        const calendarData = await graphRes.json();
        const events = (calendarData.value || []).map(mapGraphEvent);

        return { roomEmail: email, displayName: roomDisplayNames[email.toLowerCase()] || null, events, error: null };
      })
    );

    return new Response(JSON.stringify({ rooms: roomResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "internal_error", message: "An internal error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
