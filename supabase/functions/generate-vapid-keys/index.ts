import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  generateVapidKeys,
  exportVapidKeys,
  exportApplicationServerKey,
} from "jsr:@negrel/webpush@0.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Generate extractable VAPID keys
    const keys = await generateVapidKeys({ extractable: true });
    
    // Export in JWK format (for storage/import)
    const exportedKeys = await exportVapidKeys(keys);
    
    // Export application server key (for frontend push subscription)
    const applicationServerKey = await exportApplicationServerKey(keys);

    return new Response(JSON.stringify({
      vapidKeysJson: JSON.stringify(exportedKeys),
      applicationServerKey,
      note: "Save 'vapidKeysJson' as VAPID_KEYS_JSON secret. Use 'applicationServerKey' in your frontend PushSubscriptionButton."
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
