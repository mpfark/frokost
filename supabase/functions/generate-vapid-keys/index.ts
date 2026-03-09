import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Generate ECDSA P-256 key pair for VAPID
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );

    const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

    // Convert to URL-safe base64 (application server key format)
    const publicKey = publicKeyJwk.x + publicKeyJwk.y; // This isn't right for VAPID

    // Export raw public key
    const rawPublicKey = await crypto.subtle.exportKey("raw", keyPair.publicKey);
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(rawPublicKey)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Export private key as base64url (d parameter from JWK)
    const privateKeyBase64 = privateKeyJwk.d!;

    return new Response(JSON.stringify({
      publicKey: publicKeyBase64,
      privateKey: privateKeyBase64,
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
