import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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

    // Parse request body - support both inviteCode (admin OR public) and invitationId (legacy/admin only)
    const body = await req.json();
    const { inviteCode, invitationId } = body;

    const authHeader = req.headers.get("Authorization");

    // PUBLIC FLOW: inviteCode without auth header.
    // The invite_code is the unguessable secret delivered in the invitation email,
    // unlike `invitations.id` which can leak via logs/referrers.
    if (inviteCode && !authHeader) {
      // Rate limit: max 10 attempts per minute per IP
      const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "unknown";
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const { data: recentAttempts } = await supabaseServiceClient
        .from("rate_limits")
        .select("id")
        .eq("action", "generate_invite_link")
        .eq("user_id", clientIp)
        .gte("timestamp", oneMinuteAgo);

      if ((recentAttempts?.length || 0) >= 10) {
        return new Response(
          JSON.stringify({ success: false, error: "rate_limited" }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      await supabaseServiceClient
        .from("rate_limits")
        .insert({ user_id: clientIp, action: "generate_invite_link" });

      // Look up invitation by the secret invite_code
      const { data: invitation, error: inviteError } = await supabaseServiceClient
        .from("invitations")
        .select("*")
        .eq("invite_code", inviteCode)
        .maybeSingle();

      // Generic error for not_found / wrong code to prevent enumeration
      if (inviteError || !invitation) {
        return new Response(JSON.stringify({ success: false, error: "not_found" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (invitation.status === "accepted") {
        return new Response(JSON.stringify({ success: false, error: "already_accepted" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (new Date() > new Date(invitation.expires_at)) {
        return new Response(JSON.stringify({ success: false, error: "expired" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      return await generateMagicLink(supabaseServiceClient, invitation);
    }

    // LEGACY public path via invitationId is no longer allowed without auth.
    if (invitationId && !authHeader) {
      return new Response(JSON.stringify({ success: false, error: "not_found" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    // ADMIN FLOW: inviteCode with auth header
    if (inviteCode && authHeader) {
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

      return await generateMagicLink(supabaseServiceClient, invitation);
    }

    return new Response(JSON.stringify({ error: "Missing inviteCode or invitationId" }), {
      status: 400,
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

async function generateMagicLink(supabaseServiceClient: any, invitation: any) {
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
    success: true,
    link: linkData.properties.action_link 
  }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
