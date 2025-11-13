import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateRequest {
  inviteCode: string;
  email?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { inviteCode, email } = await req.json() as ValidateRequest;

    if (!inviteCode) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invitationskode er påkrævet' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Query invitation with service role to bypass RLS
    const { data: invitation, error } = await supabaseClient
      .from('invitations')
      .select('email, expires_at, status')
      .eq('invite_code', inviteCode)
      .eq('status', 'pending')
      .single();

    if (error || !invitation) {
      console.log('Invitation not found or error:', error);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Denne invitationskode er ugyldig eller udløbet' 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Denne invitation er udløbet' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If email provided, check if it matches
    if (email && invitation.email.toLowerCase() !== email.toLowerCase()) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Denne invitation blev sendt til en anden e-mailadresse' 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Return success with the invitation email (without exposing other data)
    return new Response(
      JSON.stringify({ 
        valid: true, 
        email: invitation.email 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error validating invitation:', error);
    return new Response(
      JSON.stringify({ 
        valid: false, 
        error: 'Der opstod en fejl under validering af invitationen' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
