import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(): Promise<string> {
  const tenantId = Deno.env.get("AZURE_TENANT_ID");
  const clientId = Deno.env.get("AZURE_CLIENT_ID");
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Azure AD credentials not configured");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Token error:", errorText);
    throw new Error(`Failed to get access token: ${res.status}`);
  }

  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the user is authenticated
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

    // Parse request body
    const { email, startDate, endDate } = await req.json();

    // If no email provided, use the authenticated user's email
    const targetEmail = email || user.email;

    if (!targetEmail) {
      return new Response(
        JSON.stringify({ error: "No email provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get Microsoft Graph access token
    const accessToken = await getAccessToken();

    // Build the calendar view URL
    const start = startDate || new Date().toISOString();
    const end =
      endDate ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
      targetEmail
    )}/calendarView?startDateTime=${start}&endDateTime=${end}&$select=subject,start,end,organizer,attendees,location,isAllDay&$orderby=start/dateTime&$top=50`;

    console.log("Fetching calendar for:", targetEmail);

    const graphRes = await fetch(graphUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!graphRes.ok) {
      const errorText = await graphRes.text();
      console.error("Graph API error:", graphRes.status, errorText);

      if (graphRes.status === 403) {
        return new Response(
          JSON.stringify({
            error: "calendar_permission_denied",
            message:
              "Calendars.Read permission er ikke godkendt endnu. Bed din administrator om at give admin consent i Azure Portal.",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (graphRes.status === 404) {
        return new Response(
          JSON.stringify({
            error: "user_not_found",
            message: `Brugeren ${targetEmail} blev ikke fundet i Microsoft 365.`,
          }),
          {
            status: 404,
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

    // Map events to a cleaner format
    const events = (calendarData.value || []).map((event: any) => ({
      id: event.id,
      subject: event.subject,
      startTime: event.start?.dateTime,
      startTimezone: event.start?.timeZone,
      endTime: event.end?.dateTime,
      endTimezone: event.end?.timeZone,
      location: event.location?.displayName || null,
      isAllDay: event.isAllDay,
      organizer: event.organizer?.emailAddress?.name || null,
      attendeeCount: event.attendees?.length || 0,
    }));

    return new Response(JSON.stringify({ events }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
