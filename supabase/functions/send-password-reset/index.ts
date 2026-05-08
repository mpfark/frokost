import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface PasswordResetRequest {
  email: string;
}

const emailSchema = z.string().trim().email().max(255);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: isAdmin, error: roleError } = await supabaseClient
      .rpc("has_role", { _user_id: user.id, _role: "admin" });

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Rate limit
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count: recentRequests } = await supabaseAdmin
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("action", "password_reset")
      .gte("timestamp", oneHourAgo);

    if (recentRequests && recentRequests >= 10) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Maximum 10 password resets per hour." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    await supabaseAdmin
      .from("rate_limits")
      .insert({ user_id: user.id, action: "password_reset" });

    const { email }: PasswordResetRequest = await req.json();

    const emailValidation = emailSchema.safeParse(email);
    if (!emailValidation.success) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || '';
    const redirectUrl = `${origin}/reset-password`;

    const requestId = crypto.randomUUID();
    console.log("Request ID:", requestId, "Processing password reset request");

    // Send password reset via Supabase Auth (this triggers the auth-email-hook for branded email)
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (resetError) {
      console.error("Request ID:", requestId, "Error sending password reset:", resetError);
      throw resetError;
    }

    // Also send a notification via transactional email
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("email", email)
      .maybeSingle();

    await supabaseAdmin.functions.invoke("send-transactional-email", {
      body: {
        templateName: "password-reset",
        recipientEmail: email,
        idempotencyKey: `password-reset-notification-${requestId}`,
        templateData: { userName: profile?.full_name || email.split("@")[0] },
      },
    });

    console.log("Request ID:", requestId, "Password reset email sent successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Password reset email sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-password-reset function:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
