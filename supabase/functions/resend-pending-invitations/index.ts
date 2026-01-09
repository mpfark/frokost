import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Default colors (HSL format matching the app defaults)
const DEFAULT_COLORS = {
  primary: "25 95% 37%",
  accent: "20 90% 48%"
};

// Convert HSL string to hex for email compatibility
const hslToHex = (hsl: string): string => {
  const parts = hsl.split(' ');
  if (parts.length !== 3) return '#b45309';
  
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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    <h2 style="color: #1f2937; margin-top: 0;">Nyt invitationslink</h2>
    
    <p>Hej!</p>
    
    <p>Her er et nyt invitationslink til <strong>Plusfrokost</strong> - vores frokost tilmeldingssystem.</p>
    
    <p>Klik på knappen nedenfor for at acceptere invitationen og oprette din adgangskode:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${inviteLink}" style="background: ${accentHex}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Acceptér invitation
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">
      <strong>Bemærk:</strong> Dette link udløber om 7 dage.
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

    // Check if user is admin
    const { data: isAdmin, error: roleError } = await supabaseServiceClient
      .rpc("has_role", { _user_id: user.id, _role: "admin" });

    if (roleError || !isAdmin) {
      throw new Error("Admin access required");
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

    // Fetch all pending invitations
    const { data: pendingInvitations, error: fetchError } = await supabaseServiceClient
      .from("invitations")
      .select("*")
      .eq("status", "pending");

    if (fetchError) {
      throw new Error("Failed to fetch pending invitations");
    }

    if (!pendingInvitations || pendingInvitations.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "No pending invitations found",
          totalResent: 0,
          totalFailed: 0,
          results: []
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const results = [];
    const productionUrl = "https://frokost.pluskontoret.dk";

    for (const invitation of pendingInvitations) {
      try {
        console.log(`Resending invitation to ${invitation.email}`);

        // Generate new magic link
        const redirectUrl = `${productionUrl}/set-password`;
        
        const { data: linkData, error: linkError } = await supabaseServiceClient.auth.admin.generateLink({
          type: 'invite',
          email: invitation.email.toLowerCase(),
          options: {
            redirectTo: redirectUrl,
            data: {
              invite_code: invitation.invite_code,
              full_name: invitation.email.split('@')[0],
            }
          }
        });

        if (linkError || !linkData?.properties?.action_link) {
          console.error("Generate link error for", invitation.email, ":", linkError);
          results.push({
            email: invitation.email,
            success: false,
            error: "Failed to generate invitation link",
          });
          continue;
        }

        const inviteLink = linkData.properties.action_link;

        // Send email via Resend
        const emailHtml = generateInvitationEmail(inviteLink, adminName, primaryColor, accentColor);
        
        const { error: emailError } = await resend.emails.send({
          from: "Frokost Tilmelding <tilmelding@frokost.pluskontoret.dk>",
          to: [invitation.email.toLowerCase()],
          subject: "Nyt invitationslink til Plusfrokost",
          html: emailHtml,
        });

        if (emailError) {
          console.error("Resend email error for", invitation.email, ":", emailError);
          results.push({
            email: invitation.email,
            success: false,
            error: "Failed to send invitation email",
          });
          continue;
        }

        // Update link_sent_at
        await supabaseServiceClient
          .from("invitations")
          .update({ link_sent_at: new Date().toISOString() })
          .eq("id", invitation.id);

        // Extend expiration by 7 days
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 7);
        await supabaseServiceClient
          .from("invitations")
          .update({ expires_at: newExpiresAt.toISOString() })
          .eq("id", invitation.id);

        console.log(`Successfully resent invitation to ${invitation.email}`);
        results.push({
          email: invitation.email,
          success: true,
        });

        // Rate limiting: wait 500ms between emails
        await delay(500);
      } catch (error: any) {
        console.error("Error resending to", invitation.email, ":", error);
        results.push({
          email: invitation.email,
          success: false,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Resend complete",
        totalResent: results.filter(r => r.success).length,
        totalFailed: results.filter(r => !r.success).length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Resend pending invitations error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
