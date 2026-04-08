import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getAppToken } from "../_shared/microsoft-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await serviceClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role using has_role RPC
    const { data: isAdmin } = await serviceClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Azure credentials
    const tenantId = Deno.env.get("AZURE_TENANT_ID");
    const clientId = Deno.env.get("AZURE_CLIENT_ID");
    const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");

    if (!tenantId || !clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "Azure credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const access_token = await getAppToken(tenantId, clientId, clientSecret);

    // Fetch all users with pagination
    const allUsers: { displayName: string; email: string }[] = [];
    let nextLink: string | null =
      "https://graph.microsoft.com/v1.0/users?$select=displayName,mail,userPrincipalName&$filter=accountEnabled eq true&$top=999";

    while (nextLink) {
      const graphRes = await fetch(nextLink, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      if (!graphRes.ok) {
        const graphErr = await graphRes.text();
        console.error("Graph error:", graphErr);
        return new Response(
          JSON.stringify({
            error: "Failed to fetch users from Microsoft. Ensure the app has User.Read.All permission.",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const graphData = await graphRes.json();

      for (const u of graphData.value || []) {
        const email = u.mail || u.userPrincipalName;
        if (email && email.includes("@")) {
          allUsers.push({
            displayName: u.displayName || email,
            email: email.toLowerCase(),
          });
        }
      }

      nextLink = graphData["@odata.nextLink"] || null;
    }

    // Sort by name
    allUsers.sort((a, b) => a.displayName.localeCompare(b.displayName));

    return new Response(JSON.stringify({ users: allUsers }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
