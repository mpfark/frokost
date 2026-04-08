import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { DEFAULT_COLORS, hslToHex, generateInvitationEmail, delay } from "../_shared/email-utils.ts";

interface InviteRequest {
  emails: string[];
}

const emailSchema = z.string().trim().email().max(255);
const emailArraySchema = z.array(emailSchema).min(1).max(50);

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseServiceClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin using secure RPC function
    const { data: isAdmin, error: roleError } = await supabaseServiceClient
      .rpc("has_role", { _user_id: user.id, _role: "admin" });

    if (roleError || !isAdmin) {
      throw new Error("Admin access required");
    }

    // Check rate limit: max 50 invitations per hour per admin
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count: recentRequests } = await supabaseServiceClient
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("action", "send_invitations")
      .gte("timestamp", oneHourAgo);

    if (recentRequests && recentRequests >= 50) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Maximum 50 invitations per hour." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        }
      );
    }

    // Record this request for rate limiting
    await supabaseServiceClient
      .from("rate_limits")
      .insert({ user_id: user.id, action: "send_invitations" });

    const { emails }: InviteRequest = await req.json();

    // Validate email array
    const emailsValidation = emailArraySchema.safeParse(emails);
    if (!emailsValidation.success) {
      throw new Error("Invalid email format in request");
    }

    // Get admin profile for email
    const { data: adminProfile } = await supabaseServiceClient
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const adminName = adminProfile?.full_name || adminProfile?.email || "En administrator";

    // Fetch company colors
    const { data: companySettings } = await supabaseServiceClient
      .from("company_settings")
      .select("primary_color, accent_color")
      .single();

    const primaryColor = companySettings?.primary_color || DEFAULT_COLORS.primary;
    const accentColor = companySettings?.accent_color || DEFAULT_COLORS.accent;

    // Create batch if multiple invites
    let batchId = null;
    if (emails.length > 1) {
      const { data: batch, error: batchError } = await supabaseServiceClient
        .from("invitation_batches")
        .insert({
          created_by: user.id,
          total_invites: emails.length,
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
    const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/") || "https://frokost.pluskontoret.dk";

    for (const email of emails) {
      const requestId = crypto.randomUUID();
      try {
        console.log("Request ID:", requestId, "Processing invitation for", email);
        
        // Check if active invitation exists
        const { data: existingInvite } = await supabaseServiceClient
          .from("invitations")
          .select("id, status, used_by")
          .eq("email", email.toLowerCase())
          .in("status", ["pending", "accepted"])
          .maybeSingle();

        if (existingInvite) {
          results.push({
            email,
            success: false,
            error: existingInvite.status === "accepted" ? "Invitation already accepted" : "Invitation already pending",
          });
          continue;
        }

        // Generate invite code for tracking
        const inviteCode = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Create invitation record
        const { data: invitationData, error: inviteError } = await supabaseServiceClient
          .from("invitations")
          .insert({
            email: email.toLowerCase(),
            invite_code: inviteCode,
            invited_by: user.id,
            expires_at: expiresAt.toISOString(),
            batch_id: batchId,
          })
          .select()
          .single();

        if (inviteError || !invitationData) {
          console.error("Invitation creation error:", inviteError);
          results.push({
            email,
            success: false,
            error: "Failed to create invitation",
          });
          continue;
        }

        const productionUrl = "https://frokost.pluskontoret.dk";
        const inviteLink = `${productionUrl}/accept-invitation/${invitationData.id}`;

        // Send custom email via Resend with company colors
        const emailHtml = generateInvitationEmail(inviteLink, adminName, primaryColor, accentColor);
        
        const { error: emailError } = await resend.emails.send({
          from: "Frokost Tilmelding <tilmelding@frokost.pluskontoret.dk>",
          to: [email.toLowerCase()],
          subject: "Du er inviteret til Plusfrokost",
          html: emailHtml,
        });

        if (emailError) {
          console.error("Resend email error:", emailError);
          results.push({
            email,
            success: false,
            error: "Failed to send invitation email",
          });
          continue;
        }

        // Update invitation with link_sent_at timestamp
        const { error: updateError } = await supabaseServiceClient
          .from("invitations")
          .update({ link_sent_at: new Date().toISOString() })
          .eq("id", invitationData.id);

        if (updateError) {
          console.error("Failed to update link_sent_at:", updateError);
        }

        console.log(`Invitation email sent successfully to ${email} via Resend`);
        results.push({
          email,
          success: true,
          inviteCode,
        });

        // Rate limiting: wait 500ms between emails
        await delay(500);
      } catch (error: any) {
        console.error("Request ID:", requestId, "Error processing invitation:", error);
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
    console.error("Invitation function error:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
