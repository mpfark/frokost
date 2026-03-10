import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateVapidKeys } from "jsr:@negrel/webpush@0.6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const vapidKeys = await generateVapidKeys();

    return new Response(JSON.stringify({
      publicKey: vapidKeys.publicKey,
      privateKey: vapidKeys.privateKey,
      note: "Save these as VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
