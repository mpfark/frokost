import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  emails: string[];
  batchDescription?: string;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      throw new Error("Admin access required");
    }

    const { emails, batchDescription }: InviteRequest = await req.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      throw new Error("No emails provided");
    }

    // Get admin profile for email
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const adminName = adminProfile?.full_name || adminProfile?.email || "Admin";

    // Create batch if multiple invites
    let batchId = null;
    if (emails.length > 1) {
      const { data: batch, error: batchError } = await supabase
        .from("invitation_batches")
        .insert({
          created_by: user.id,
          total_invites: emails.length,
          description: batchDescription,
        })
        .select()
        .single();

      if (batchError) {
        console.error("Batch creation error:", batchError);
        throw new Error("Failed to create invitation batch");
      }
      batchId = batch.id;
    }

    const results = [];
    const appUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "") || "";

    for (const email of emails) {
      try {
        // Check if user already exists
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email.toLowerCase())
          .single();

        if (existingProfile) {
          results.push({
            email,
            success: false,
            error: "User already exists",
          });
          continue;
        }

        // Check if active invitation exists
        const { data: existingInvite } = await supabase
          .from("invitations")
          .select("id, status")
          .eq("email", email.toLowerCase())
          .in("status", ["pending", "accepted"])
          .single();

        if (existingInvite) {
          results.push({
            email,
            success: false,
            error: existingInvite.status === "accepted" ? "Invitation already accepted" : "Invitation already pending",
          });
          continue;
        }

        // Generate invite code
        const inviteCode = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

        // Create invitation
        const { error: inviteError } = await supabase
          .from("invitations")
          .insert({
            email: email.toLowerCase(),
            invite_code: inviteCode,
            invited_by: user.id,
            expires_at: expiresAt.toISOString(),
            batch_id: batchId,
          });

        if (inviteError) {
          console.error("Invitation creation error:", inviteError);
          results.push({
            email,
            success: false,
            error: "Failed to create invitation",
          });
          continue;
        }

        // Send email
        const inviteLink = `${appUrl}/?invite=${inviteCode}&email=${encodeURIComponent(email)}`;
        
        const { error: emailError } = await resend.emails.send({
          from: "Office Lunch <onboarding@resend.dev>",
          to: [email],
          subject: "You're invited to Office Lunch!",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #333;">You're invited to Office Lunch!</h1>
              <p>Hi there,</p>
              <p><strong>${adminName}</strong> has invited you to join the Office Lunch scheduling system.</p>
              <p>Click the link below to create your account:</p>
              <div style="margin: 30px 0;">
                <a href="${inviteLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Accept Invitation</a>
              </div>
              <p style="color: #666; font-size: 14px;">This invitation expires in 7 days.</p>
              <p style="color: #666; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
          `,
        });

        if (emailError) {
          console.error("Email send error:", emailError);
          results.push({
            email,
            success: false,
            error: "Failed to send email",
          });
        } else {
          results.push({
            email,
            success: true,
            inviteCode,
          });
        }
      } catch (error: any) {
        console.error(`Error processing ${email}:`, error);
        results.push({
          email,
          success: false,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        results,
        totalSent: results.filter(r => r.success).length,
        totalFailed: results.filter(r => !r.success).length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in send-invitations:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});