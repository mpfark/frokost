import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, service);
    const { data: isPlatformAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "platform_admin",
    });
    if (!isPlatformAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email } = await req.json();
    const target = String(email ?? "").trim().toLowerCase();
    if (!target || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      return new Response(JSON.stringify({ error: "Ugyldig email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectTo = "https://frokost.gakgak.net/";

    // Try to find existing user by email
    let userId: string | null = null;
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", target)
      .maybeSingle();
    if (existingProfile) {
      userId = existingProfile.id;
      // Send a magic link so they can log in
      const { error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: target,
        options: { redirectTo },
      });
      if (linkErr) {
        return new Response(JSON.stringify({ error: linkErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(target, {
        redirectTo,
      });
      if (invErr || !invited.user) {
        return new Response(JSON.stringify({ error: invErr?.message ?? "Invite failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = invited.user.id;
    }

    // Assign platform_admin role (ignore duplicate)
    const { error: rErr } = await admin
      .from("user_roles")
      .insert({ user_id: userId, role: "platform_admin" });
    if (rErr && !rErr.message.includes("duplicate")) {
      return new Response(JSON.stringify({ error: rErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, existed: !!existingProfile }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
