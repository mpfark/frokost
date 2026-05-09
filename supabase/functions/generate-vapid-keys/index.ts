import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  generateVapidKeys,
  exportVapidKeys,
  exportApplicationServerKey,
} from "jsr:@negrel/webpush@0.5";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyAdmin } from "../_shared/auth-utils.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Restrict to authenticated admins only — this is a sensitive setup utility
    const auth = await verifyAdmin(req);
    if (auth.response) return auth.response;

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
    console.error("generate-vapid-keys error:", error);
    return new Response(JSON.stringify({ error: "An internal error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
