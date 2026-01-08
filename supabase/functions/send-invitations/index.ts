import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  emails: string[];
}

const emailSchema = z.string().trim().email().max(255);
const emailArraySchema = z.array(emailSchema).min(1).max(50);

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Default colors (HSL format matching the app defaults)
const DEFAULT_COLORS = {
  primary: "25 95% 37%",
  secondary: "35 40% 90%",
  accent: "20 90% 48%"
};

// Convert HSL string to hex for email compatibility
const hslToHex = (hsl: string): string => {
  const parts = hsl.split(' ');
  if (parts.length !== 3) return '#b45309'; // Fallback amber color
  
  const h = parseFloat(parts[0]) / 360;
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Helper function for rate limiting between emails
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Generate invitation email HTML with dynamic colors
const generateInvitationEmail = (inviteLink: string, adminName: string, primaryColor: string, accentColor: string): string => {
  const primaryHex = hslToHex(primaryColor);
  const accentHex = hslToHex(accentColor);
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation til Plusfrokost</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${primaryHex}; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🍽️ Plusfrokost</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0;">Du er inviteret!</h2>
    
    <p>Hej!</p>
    
    <p>${adminName} har inviteret dig til at bruge <strong>Plusfrokost</strong> - vores system til tilmelding af frokost.</p>
    
    <p>Klik på knappen nedenfor for at acceptere invitationen og oprette din adgangskode:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${inviteLink}" style="background: ${accentHex}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Acceptér invitation
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">
      <strong>Bemærk:</strong> Dette link udløber om 7 dage. Hvis linket er udløbet, kan du kontakte en administrator for at få tilsendt et nyt.
    </p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      Hvis knappen ikke virker, kan du kopiere dette link og indsætte det i din browser:<br>
      <a href="${inviteLink}" style="color: ${primaryHex}; word-break: break-all;">${inviteLink}</a>
    </p>
  </div>
  
  <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 20px;">
    Denne email blev sendt automatisk fra Plusfrokost-systemet.
  </p>
</body>
</html>
`;
};

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
    // Get the frontend URL from the request origin or use a fallback
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

        // Generate magic link using Supabase Admin API (without sending email)
        const redirectUrl = `${origin}/set-password`;
        
        const { data: linkData, error: linkError } = await supabaseServiceClient.auth.admin.generateLink({
          type: 'invite',
          email: email.toLowerCase(),
          options: {
            redirectTo: redirectUrl,
            data: {
              invite_code: inviteCode,
              full_name: email.split('@')[0],
            }
          }
        });

        if (linkError || !linkData?.properties?.action_link) {
          console.error("Generate link error:", linkError);
          results.push({
            email,
            success: false,
            error: "Failed to generate invitation link",
          });
          continue;
        }

        const inviteLink = linkData.properties.action_link;

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

        // Rate limiting: wait 500ms between emails (max 2/second for Resend)
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
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
