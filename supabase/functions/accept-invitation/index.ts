import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create a Supabase client with the user's token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Create Supabase admin client with service role key for privileged updates
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Extract the access token from the Bearer header
    const token = authHeader.replace('Bearer ', '').trim();

    // Get the current user using the access token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user?.email || !user.email_confirmed_at) {
      console.error('Failed to get user from token:', userError);
      throw new Error('Unauthorized');
    }

    console.log('Accepting invitation for user:', user.email);

    // Update the invitation to accepted using the admin client (bypasses RLS but still scoped to this user)
    const { data, error } = await supabaseAdmin
      .from('invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        used_by: user.id,
      })
      .eq('email', user.email!.toLowerCase())
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      console.error('Failed to update invitation:', error);
      throw new Error(`Failed to update invitation: ${error.message}`);
    }

    if (!data || data.length === 0) {
      console.log('No pending invitation for:', user.email, '(normal for returning users)');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No pending invitation (already accepted or none exists)',
          noop: true
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Successfully accepted invitation:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invitation accepted successfully',
        invitationId: data[0]?.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in accept-invitation function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      {
        status: errorMessage === 'Unauthorized' ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
