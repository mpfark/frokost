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
      note: "Set VAPID_PUBLIC_KEY to applicationServerKey and VAPID_PRIVATE_KEY to the matching private key. The frontend fetches the public key from send-push-notification automatically; all phones must re-enable notifications after rotation."
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
