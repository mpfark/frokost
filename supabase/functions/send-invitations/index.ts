import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  emails: string[];
  batchDescription?: string;
}

const emailSchema = z.string().trim().email().max(255);
const emailArraySchema = z.array(emailSchema).min(1).max(50);

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const { emails, batchDescription }: InviteRequest = await req.json();

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

    const adminName = adminProfile?.full_name || adminProfile?.email || "Admin";

    // Create batch if multiple invites
    let batchId = null;
    if (emails.length > 1) {
      const { data: batch, error: batchError } = await supabaseServiceClient
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
    const redirectUrl = `${supabaseUrl.replace(".supabase.co", "")}/set-password`;

    for (const email of emails) {
      const requestId = crypto.randomUUID();
      try {
        console.log("Request ID:", requestId, "Processing invitation for", email);
        
        // Check if active invitation exists (users won't exist until they accept)
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
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

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

        // Send invitation email - user will be created when they accept
        const { data: inviteData, error: emailError } = await supabaseServiceClient.auth.admin.inviteUserByEmail(
          email.toLowerCase(),
          {
            redirectTo: `${redirectUrl}`,
            data: {
              invite_code: inviteCode,
              full_name: email.split('@')[0], // Default name from email
            }
          }
        );

        if (emailError) {
          console.error("Invitation email error:", emailError);
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

        console.log(`Invitation email sent successfully to ${email}`);
        results.push({
          email,
          success: true,
          inviteCode,
        });
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
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
