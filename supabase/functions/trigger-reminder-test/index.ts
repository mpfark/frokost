import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body to get testEmail
    const body = await req.text();
    const { testEmail } = body ? JSON.parse(body) : {};
    
    if (!testEmail) {
      return new Response(
        JSON.stringify({ error: 'Test email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create Supabase client with service role to access cron_settings
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Create regular client to verify user is admin
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify user is authenticated and is admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('User error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Check if user has admin role using RPC to bypass RLS
    const { data: isAdmin, error: roleError } = await supabaseClient
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (roleError || !isAdmin) {
      console.error('Role check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch cron secret using service role
    const { data: cronSecret, error: secretError } = await supabaseAdmin
      .from('cron_settings')
      .select('setting_value')
      .eq('setting_key', 'cron_secret')
      .single();

    if (secretError || !cronSecret) {
      console.error('Error fetching cron secret:', secretError);
      return new Response(
        JSON.stringify({ error: 'Could not fetch cron secret' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call the send-weekly-lunch-reminder function with test email
    const reminderResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-weekly-lunch-reminder`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': cronSecret.setting_value,
        },
        body: JSON.stringify({ testEmail }),
      }
    );

    if (!reminderResponse.ok) {
      const errorText = await reminderResponse.text();
      console.error('Error calling reminder function:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to send reminders' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await reminderResponse.json();

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in trigger-reminder-test:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
