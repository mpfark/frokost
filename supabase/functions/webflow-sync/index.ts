import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { delay } from "../_shared/email-utils.ts";
import { verifyAdmin } from "../_shared/auth-utils.ts";

interface WebflowItem {
  id: string;
  isDraft?: boolean;
  isArchived?: boolean;
  lastPublished?: string;
  fieldData: {
    name: string;
    email: string;
    [key: string]: any;
  };
}

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/") || "https://frokost.pluskontoret.dk";

    // Verify admin authorization
    const adminResult = await verifyAdmin(req);
    if (adminResult.response) return adminResult.response;
    const { user } = adminResult;

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
      const allWebflowItems: WebflowItem[] = webflowData.items || [];

      console.log(`Fetched ${allWebflowItems.length} items from Webflow`);

      // Filter out drafts and archived items unless include_drafts is enabled
      const webflowItems = settings.include_drafts
        ? allWebflowItems.filter(item => !item.isArchived)
        : allWebflowItems.filter(item => !item.isDraft && !item.isArchived);

      const skippedDrafts = allWebflowItems.length - webflowItems.length;
      if (skippedDrafts > 0) {
        console.log(`Filtered out ${skippedDrafts} draft/archived items (include_drafts: ${settings.include_drafts})`);
        details.skipped = details.skipped || [];
        details.skipped.push(`${skippedDrafts} draft/archived items skipped`);
      }

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

      if (webflowItems.length > 0) {
        console.log('First Webflow item fieldData keys:', Object.keys(webflowItems[0].fieldData));
        console.log('First Webflow item fieldData:', JSON.stringify(webflowItems[0].fieldData, null, 2));
        console.log('Looking for mapping:', fieldMapping);
      }

      for (const item of webflowItems) {
        const rawEmail = item.fieldData[fieldMapping.email];
        const rawName = item.fieldData[fieldMapping.name];

        if (!rawEmail || !rawName) {
          details.errors.push(`Skipped item ${item.id}: missing email or name (mapping: ${JSON.stringify(fieldMapping)}, available fields: ${Object.keys(item.fieldData).join(', ')})`);
          continue;
        }

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

        if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
          details.errors.push(`Skipped ${email}: domain not allowed`);
          continue;
        }

        webflowEmails.add(email);

        const existingProfile = existingProfiles?.find(p => p.email === email);

        if (existingProfile) {
          const updates: any = {};
          if (existingProfile.full_name !== name) {
            updates.full_name = name;
          }
          updates.webflow_id = item.id;
          updates.webflow_synced = true;
          updates.is_active = true;

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
          const existingInvitation = existingInvitations?.find(
            inv => inv.email === email
          );

          if (existingInvitation) {
            details.success.push(`Skipped ${email}: pending invitation already exists`);
            continue;
          }

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

          try {
            const productionUrl = "https://frokost.pluskontoret.dk";
            const inviteLink = `${productionUrl}/accept-invitation/${invitation.invite_code}`;

            const { error: emailError } = await supabase.functions.invoke(
              "send-transactional-email",
              {
                body: {
                  templateName: "invitation",
                  recipientEmail: email,
                  idempotencyKey: `invitation-${invitation.id}`,
                  templateData: { adminName, inviteLink },
                  triggeredBy: user.id,
                },
              }
            );

            if (emailError) {
              console.error(`Failed to send email to ${email}:`, emailError);
              details.errors.push(`Failed to send email to ${email}: ${emailError.message}`);
            } else {
              await supabase
                .from('invitations')
                .update({ link_sent_at: new Date().toISOString() })
                .eq('id', invitation.id);

              console.log(`Invitation email queued for ${email}`);
            }

            usersAdded++;
            details.success.push(`Created invitation and sent email to ${email}`);

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
          const { error: authDeleteError } = await supabase.auth.admin.deleteUser(profile.id);
          
          if (!authDeleteError) {
            usersRemoved++;
            details.success.push(`Soft-deleted ${profile.email}`);
          }
        } else if (settings.removal_policy === 'full-delete') {
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
