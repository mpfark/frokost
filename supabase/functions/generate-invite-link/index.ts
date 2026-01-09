import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify admin access
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check admin role
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Parse request body
    const { inviteCode } = await req.json();
    if (!inviteCode) {
      return new Response(JSON.stringify({ error: "Missing inviteCode" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Find the invitation
    const { data: invitation, error: inviteError } = await supabaseServiceClient
      .from("invitations")
      .select("*")
      .eq("invite_code", inviteCode)
      .single();

    if (inviteError || !invitation) {
      return new Response(JSON.stringify({ error: "Invitation not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Generate magic link
    const productionUrl = "https://frokost.pluskontoret.dk";
    const redirectUrl = `${productionUrl}/set-password`;

    // First try 'invite' type, if user exists use 'magiclink' instead
    let linkData;
    let linkError;

    const generateResult = await supabaseServiceClient.auth.admin.generateLink({
      type: 'invite',
      email: invitation.email.toLowerCase(),
      options: {
        redirectTo: redirectUrl,
        data: {
          invite_code: invitation.invite_code,
        }
      }
    });

    linkData = generateResult.data;
    linkError = generateResult.error;

    // If user already exists, use magiclink instead
    if (linkError?.code === 'email_exists') {
      console.log(`User ${invitation.email} already exists, using magiclink instead`);
      const magicResult = await supabaseServiceClient.auth.admin.generateLink({
        type: 'magiclink',
        email: invitation.email.toLowerCase(),
        options: {
          redirectTo: redirectUrl,
          data: {
            invite_code: invitation.invite_code,
          }
        }
      });
      linkData = magicResult.data;
      linkError = magicResult.error;
    }

    if (linkError || !linkData?.properties?.action_link) {
      console.error("Generate link error:", linkError);
      return new Response(JSON.stringify({ error: "Failed to generate link" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ 
      link: linkData.properties.action_link 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
