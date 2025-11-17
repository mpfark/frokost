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

    // Extract client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Rate limiting: Check recent attempts (max 10 per minute per IP)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recentAttempts, error: rateLimitCheckError } = await supabaseClient
      .from('rate_limits')
      .select('id', { count: 'exact' })
      .eq('action', 'validate_invitation')
      .eq('user_id', clientIp)
      .gte('timestamp', oneMinuteAgo);

    if (rateLimitCheckError) {
      console.log('Rate limit check error:', rateLimitCheckError);
    }

    const attemptCount = recentAttempts?.length || 0;
    if (attemptCount >= 10) {
      console.log('Rate limit exceeded for IP:', clientIp);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'For mange forsøg. Prøv venligst igen om et øjeblik.' 
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log this validation attempt
    await supabaseClient
      .from('rate_limits')
      .insert({
        user_id: clientIp,
        action: 'validate_invitation',
        timestamp: new Date().toISOString()
      });

    const { inviteCode, email } = await req.json() as ValidateRequest;

    if (!inviteCode) {
      console.log('Validation attempt without invite code from IP:', clientIp);
      return new Response(
        JSON.stringify({ valid: false, error: 'Ugyldig eller udløbet invitation' }),
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

    // Detailed logging server-side only
    if (error || !invitation) {
      console.log('Validation failed for code:', inviteCode, 'IP:', clientIp, 'Reason: not found');
    } else if (new Date(invitation.expires_at) < new Date()) {
      console.log('Validation failed for code:', inviteCode, 'IP:', clientIp, 'Reason: expired');
    } else if (email && invitation.email.toLowerCase() !== email.toLowerCase()) {
      console.log('Validation failed for code:', inviteCode, 'IP:', clientIp, 'Reason: email mismatch');
    }

    // Generic error message for all failure cases to prevent enumeration
    if (error || !invitation || 
        new Date(invitation.expires_at) < new Date() ||
        (email && invitation.email.toLowerCase() !== email.toLowerCase())) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Ugyldig eller udløbet invitation' 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Success case - log and return
    console.log('Validation successful for code:', inviteCode, 'IP:', clientIp);
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
    // Log detailed error server-side only
    console.log('Validation error:', error instanceof Error ? error.message : 'Unknown error');
    return new Response(
      JSON.stringify({ 
        valid: false, 
        error: 'Ugyldig eller udløbet invitation' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
