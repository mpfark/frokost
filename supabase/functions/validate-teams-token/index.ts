import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    
    if (!token) {
      throw new Error('Teams token is required');
    }

    const AZURE_CLIENT_ID = Deno.env.get('AZURE_CLIENT_ID');
    const AZURE_CLIENT_SECRET = Deno.env.get('AZURE_CLIENT_SECRET');
    const AZURE_TENANT_ID = Deno.env.get('AZURE_TENANT_ID');
    
    if (!AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_TENANT_ID) {
      throw new Error('Azure AD credentials not configured');
    }

    console.log('Validating Teams token...');

    // Validate token with Microsoft Graph
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!graphResponse.ok) {
      const errorText = await graphResponse.text();
      console.error('Microsoft Graph API error:', errorText);
      throw new Error('Invalid Teams token');
    }

    const userData = await graphResponse.json();
    console.log('User data from Graph:', { email: userData.mail || userData.userPrincipalName, displayName: userData.displayName });

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get or create user in Supabase
    const email = userData.mail || userData.userPrincipalName;
    const fullName = userData.displayName || email;

    // Check if user exists
    const { data: existingUser, error: getUserError } = await supabase.auth.admin.listUsers();
    
    if (getUserError) {
      console.error('Error listing users:', getUserError);
      throw new Error('Failed to check existing users');
    }

    let userId: string;
    const userExists = existingUser?.users.find(u => u.email === email);

    if (userExists) {
      userId = userExists.id;
      console.log('User exists:', userId);
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          azure_oid: userData.id,
        },
      });

      if (createError) {
        console.error('Error creating user:', createError);
        throw new Error('Failed to create user');
      }

      userId = newUser.user.id;
      console.log('Created new user:', userId);
    }

    // Generate Supabase session token
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (sessionError) {
      console.error('Error generating session:', sessionError);
      throw new Error('Failed to generate session');
    }

    console.log('Successfully validated Teams token and created session');

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          email,
          full_name: fullName,
        },
        session_url: sessionData.properties.action_link,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in validate-teams-token:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
