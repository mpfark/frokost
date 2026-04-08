import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { refreshAccessToken } from "../_shared/microsoft-auth.ts";
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { startDate, endDate } = await req.json();

    // Get user's stored Microsoft tokens
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tokenData, error: tokenError } = await serviceClient
      .from("microsoft_tokens")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({
          error: "not_connected",
          message: "Microsoft-konto er ikke forbundet. Forbind din Outlook-kalender først.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let accessToken = tokenData.access_token;

    // Check if token is expired and refresh if needed
    const tenantId = Deno.env.get("AZURE_TENANT_ID")!;
    const clientId = Deno.env.get("AZURE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET")!;

    if (new Date(tokenData.expires_at) <= new Date()) {
      console.log("Token expired, refreshing...");
      const refreshed = await refreshAccessToken(
        tokenData.refresh_token,
        tenantId,
        clientId,
        clientSecret
      );

      if (!refreshed) {
        await serviceClient
          .from("microsoft_tokens")
          .delete()
          .eq("user_id", user.id);

        return new Response(
          JSON.stringify({
            error: "token_expired",
            message: "Din Microsoft-session er udløbet. Forbind venligst igen.",
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      accessToken = refreshed.access_token;

      await serviceClient
        .from("microsoft_tokens")
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token || tokenData.refresh_token,
          expires_at: new Date(
            Date.now() + (refreshed.expires_in || 3600) * 1000
          ).toISOString(),
        })
        .eq("user_id", user.id);
    }

    // Fetch calendar events using delegated token
    const start = startDate || new Date().toISOString();
    const end =
      endDate ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const graphUrl = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${start}&endDateTime=${end}&$select=subject,start,end,organizer,attendees,location,isAllDay,iCalUId&$orderby=start/dateTime&$top=50`;

    const graphRes = await fetch(graphUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: 'outlook.timezone="Europe/Copenhagen"',
      },
    });

    if (!graphRes.ok) {
      const errorText = await graphRes.text();
      console.error("Graph API error:", graphRes.status, errorText);

      if (graphRes.status === 401) {
        await serviceClient
          .from("microsoft_tokens")
          .delete()
          .eq("user_id", user.id);

        return new Response(
          JSON.stringify({
            error: "token_expired",
            message: "Din Microsoft-session er udløbet. Forbind venligst igen.",
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          error: "graph_api_error",
          message: `Microsoft Graph API fejl: ${graphRes.status}`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const calendarData = await graphRes.json();
    const events = (calendarData.value || []).map(mapGraphEvent);

    return new Response(JSON.stringify({ events }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "internal_error", message: "An internal error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
