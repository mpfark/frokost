import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebflowItem {
  id: string;
  fieldData: {
    name: string;
    email: string;
    [key: string]: any;
  };
}

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
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-top: none;">
    <h2 style="color: #1f2937; margin-top: 0;">Du er inviteret!</h2>
    
    <p>Hej!</p>
    
    <p><strong>${adminName}</strong> har inviteret dig til at bruge Plusfrokost - vores frokost tilmeldingssystem.</p>
    
    <p>Klik på knappen nedenfor for at acceptere invitationen og oprette din adgangskode:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${inviteLink}" style="background: ${accentHex}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Acceptér invitation
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">Linket udløber om 7 dage.</p>
    
    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      Hvis knappen ikke virker, kan du kopiere dette link og indsætte det i din browser:<br>
      <a href="${inviteLink}" style="color: ${primaryHex}; word-break: break-all;">${inviteLink}</a>
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Denne email blev sendt automatisk via Plusfrokost</p>
  </div>
</body>
</html>
`;
};

// Zod schema for validating Webflow item data
const webflowUserSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .email({ message: "Invalid email format" })
    .max(255, { message: "Email must be less than 255 characters" }),
  name: z.string()
    .trim()
    .min(1, { message: "Name cannot be empty" })
    .max(100, { message: "Name must be less than 100 characters" })
    .regex(/^[a-zA-ZæøåÆØÅ\s\-'.]+$/, { message: "Name contains invalid characters" }),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webflowApiToken = Deno.env.get('WEBFLOW_API_TOKEN')!;
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get origin for redirect URL
    const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/") || "https://frokost.pluskontoret.dk";

    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get sync settings
    const { data: settings, error: settingsError } = await supabase
      .from('webflow_sync_settings')
      .select('*')
      .single();

    if (settingsError || !settings) {
      console.error('Settings error:', settingsError);
      return new Response(JSON.stringify({ error: 'Sync settings not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!settings.is_enabled) {
      return new Response(JSON.stringify({ error: 'Sync is disabled' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create sync log
    const { data: syncLog, error: logError } = await supabase
      .from('sync_logs')
      .insert({
        status: 'running',
        sync_started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) {
      console.error('Log creation error:', logError);
      return new Response(JSON.stringify({ error: 'Failed to create sync log' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let usersAdded = 0;
    let usersUpdated = 0;
    let usersRemoved = 0;
    const details: any = { errors: [], success: [] };

    try {
      // Fetch items from Webflow CMS
      console.log(`Fetching from Webflow collection: ${settings.collection_id}`);
      const webflowResponse = await fetch(
        `https://api.webflow.com/v2/collections/${settings.collection_id}/items`,
        {
          headers: {
            'Authorization': `Bearer ${webflowApiToken}`,
            'accept': 'application/json',
          },
        }
      );

      if (!webflowResponse.ok) {
        const errorText = await webflowResponse.text();
        throw new Error(`Webflow API error: ${webflowResponse.status} - ${errorText}`);
      }

      const webflowData = await webflowResponse.json();
      const webflowItems: WebflowItem[] = webflowData.items || [];

      console.log(`Fetched ${webflowItems.length} items from Webflow`);

      // Get existing profiles
      const { data: existingProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) {
        throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
      }

      // Get existing pending invitations to avoid duplicates
      const { data: existingInvitations } = await supabase
        .from('invitations')
        .select('id, email, status, invite_code')
        .eq('status', 'pending');

      // Get company settings for domain validation and colors
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('allowed_domain, primary_color, accent_color')
        .single();

      const allowedDomain = companySettings?.allowed_domain;
      const primaryColor = companySettings?.primary_color || DEFAULT_COLORS.primary;
      const accentColor = companySettings?.accent_color || DEFAULT_COLORS.accent;

      // Get admin profile for email sender name
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single();

      const adminName = adminProfile?.full_name || adminProfile?.email || "En administrator";

      // Map Webflow items to users
      const fieldMapping = settings.field_mapping as { name: string; email: string };
      const webflowEmails = new Set<string>();

      // Log first item's fieldData structure for debugging
      if (webflowItems.length > 0) {
        console.log('First Webflow item fieldData keys:', Object.keys(webflowItems[0].fieldData));
        console.log('First Webflow item fieldData:', JSON.stringify(webflowItems[0].fieldData, null, 2));
        console.log('Looking for mapping:', fieldMapping);
      }

      for (const item of webflowItems) {
        // Extract raw values from Webflow item
        const rawEmail = item.fieldData[fieldMapping.email];
        const rawName = item.fieldData[fieldMapping.name];

        // Check if fields exist
        if (!rawEmail || !rawName) {
          details.errors.push(`Skipped item ${item.id}: missing email or name (mapping: ${JSON.stringify(fieldMapping)}, available fields: ${Object.keys(item.fieldData).join(', ')})`);
          continue;
        }

        // Validate using Zod schema
        const validation = webflowUserSchema.safeParse({
          email: rawEmail,
          name: rawName,
        });

        if (!validation.success) {
          const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
          details.errors.push(`Skipped item ${item.id}: validation failed - ${errors}`);
          console.error(`Validation failed for item ${item.id}:`, validation.error.errors);
          continue;
        }

        const { email, name } = validation.data;

        // Validate domain if configured
        if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
          details.errors.push(`Skipped ${email}: domain not allowed`);
          continue;
        }

        webflowEmails.add(email);

        const existingProfile = existingProfiles?.find(p => p.email === email);

        if (existingProfile) {
          // Update existing profile
          const updates: any = {};
          if (existingProfile.full_name !== name) {
            updates.full_name = name;
          }
          updates.webflow_id = item.id;
          updates.webflow_synced = true;
          updates.is_active = true; // Reactivate if was inactive

          if (Object.keys(updates).length > 1) {
            const { error: updateError } = await supabase
              .from('profiles')
              .update(updates)
              .eq('id', existingProfile.id);

            if (updateError) {
              details.errors.push(`Failed to update ${email}: ${updateError.message}`);
            } else {
              usersUpdated++;
              details.success.push(`Updated ${email}`);
            }
          }
        } else {
          // Check if there's already a pending invitation for this email
          const existingInvitation = existingInvitations?.find(
            inv => inv.email === email
          );

          if (existingInvitation) {
            // Skip - invitation already exists, avoid duplicate emails
            details.success.push(`Skipped ${email}: pending invitation already exists`);
            continue;
          }

          // Create invitation for new user
          const inviteCode = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          
          const { data: invitation, error: inviteError } = await supabase
            .from('invitations')
            .insert({
              email,
              invite_code: inviteCode,
              invited_by: user.id,
              expires_at: expiresAt,
              status: 'pending',
            })
            .select()
            .single();

          if (inviteError) {
            details.errors.push(`Failed to create invitation for ${email}: ${inviteError.message}`);
            continue;
          }

          // Generate invitation link that points to the accept-invitation page
          // This page will generate a fresh magic link on-demand, allowing the invitation to stay valid for 7 days
          try {
            const productionUrl = "https://frokost.pluskontoret.dk";
            const inviteLink = `${productionUrl}/accept-invitation/${invitation.id}`;

            // Send branded email via Resend
            const emailHtml = generateInvitationEmail(inviteLink, adminName, primaryColor, accentColor);
            
            const { error: emailError } = await resend.emails.send({
              from: "Frokost Tilmelding <tilmelding@frokost.pluskontoret.dk>",
              to: [email],
              subject: "Du er inviteret til Plusfrokost",
              html: emailHtml,
            });

            if (emailError) {
              console.error(`Failed to send email to ${email}:`, emailError);
              details.errors.push(`Failed to send email to ${email}: ${emailError.message}`);
            } else {
              // Update invitation with link_sent_at timestamp
              await supabase
                .from('invitations')
                .update({ link_sent_at: new Date().toISOString() })
                .eq('id', invitation.id);
              
              console.log(`Invitation email sent to ${email}`);
            }

            usersAdded++;
            details.success.push(`Created invitation and sent email to ${email}`);

            // Rate limiting: wait 500ms between emails
            await delay(500);
            
          } catch (emailErr) {
            console.error(`Error sending invitation to ${email}:`, emailErr);
            details.errors.push(`Error sending invitation to ${email}: ${emailErr instanceof Error ? emailErr.message : 'Unknown error'}`);
            usersAdded++;
            details.success.push(`Created invitation for ${email} (email not sent)`);
          }
        }
      }

      // Handle removed users
      const removedProfiles = existingProfiles?.filter(
        p => p.webflow_synced && !webflowEmails.has(p.email)
      ) || [];

      for (const profile of removedProfiles) {
        if (settings.removal_policy === 'deactivate') {
          const { error: deactivateError } = await supabase
            .from('profiles')
            .update({ is_active: false })
            .eq('id', profile.id);

          if (!deactivateError) {
            usersRemoved++;
            details.success.push(`Deactivated ${profile.email}`);
          }
        } else if (settings.removal_policy === 'soft-delete') {
          // Delete from auth but keep profile
          const { error: authDeleteError } = await supabase.auth.admin.deleteUser(profile.id);
          
          if (!authDeleteError) {
            usersRemoved++;
            details.success.push(`Soft-deleted ${profile.email}`);
          }
        } else if (settings.removal_policy === 'full-delete') {
          // Check if user has lunch signups
          const { data: signups } = await supabase
            .from('lunch_signups')
            .select('id')
            .eq('user_id', profile.id)
            .limit(1);

          if (signups && signups.length > 0) {
            details.errors.push(`Cannot delete ${profile.email}: has lunch signups`);
          } else {
            const { error: deleteError } = await supabase.auth.admin.deleteUser(profile.id);
            if (!deleteError) {
              usersRemoved++;
              details.success.push(`Fully deleted ${profile.email}`);
            }
          }
        }
      }

      // Update sync log with success
      await supabase
        .from('sync_logs')
        .update({
          status: 'completed',
          sync_completed_at: new Date().toISOString(),
          users_added: usersAdded,
          users_updated: usersUpdated,
          users_removed: usersRemoved,
          details,
        })
        .eq('id', syncLog.id);

      // Update last sync time
      await supabase
        .from('webflow_sync_settings')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', settings.id);

      return new Response(
        JSON.stringify({
          success: true,
          users_added: usersAdded,
          users_updated: usersUpdated,
          users_removed: usersRemoved,
          details,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      console.error('Sync error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update sync log with error
      await supabase
        .from('sync_logs')
        .update({
          status: 'failed',
          sync_completed_at: new Date().toISOString(),
          error_message: errorMessage,
          users_added: usersAdded,
          users_updated: usersUpdated,
          users_removed: usersRemoved,
          details,
        })
        .eq('id', syncLog.id);

      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in webflow-sync function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
