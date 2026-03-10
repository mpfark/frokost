import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---- Web Push implementation using raw Web Crypto ----

function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const raw = atob(s);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function generateVapidAuthHeader(
  audience: string,
  subject: string,
  privateKeyJwk: JsonWebKey,
  publicKeyB64: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "jwk",
    { ...privateKeyJwk, key_ops: ["sign"] },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(unsignedToken),
  );

  // Convert DER signature to raw r||s
  const sigArray = new Uint8Array(sig);
  let r: Uint8Array, s: Uint8Array;
  if (sigArray.length === 64) {
    r = sigArray.slice(0, 32);
    s = sigArray.slice(32);
  } else {
    // DER format
    let offset = 2;
    const rLen = sigArray[offset + 1];
    r = sigArray.slice(offset + 2, offset + 2 + rLen);
    offset = offset + 2 + rLen;
    const sLen = sigArray[offset + 1];
    s = sigArray.slice(offset + 2, offset + 2 + sLen);
    // Trim leading zeros and pad to 32 bytes
    while (r.length > 32) r = r.slice(1);
    while (s.length > 32) s = s.slice(1);
    while (r.length < 32) r = new Uint8Array([0, ...r]);
    while (s.length < 32) s = new Uint8Array([0, ...s]);
  }
  const rawSig = new Uint8Array(64);
  rawSig.set(r);
  rawSig.set(s, 32);

  const token = `${unsignedToken}.${base64UrlEncode(rawSig.buffer)}`;
  return `vapid t=${token},k=${publicKeyB64}`;
}

async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string,
): Promise<{ body: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const enc = new TextEncoder();
  
  // Generate local ECDH key pair
  const localKey = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  
  // Import subscriber's public key
  const subPubKeyRaw = base64UrlDecode(p256dhKey);
  const subPubKey = await crypto.subtle.importKey(
    "raw",
    subPubKeyRaw,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  
  // Derive shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: subPubKey },
      localKey.privateKey,
      256,
    ),
  );
  
  // Export local public key
  const localPubKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKey.publicKey),
  );
  
  // Auth secret
  const authSecretBytes = base64UrlDecode(authSecret);
  
  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // HKDF-based key derivation (RFC 8291)
  const authInfo = enc.encode("Content-Encoding: auth\0");
  const ikmForAuth = await crypto.subtle.importKey(
    "raw", sharedSecret, { name: "HKDF" }, false, ["deriveBits"],
  );
  const prk = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: authSecretBytes, info: authInfo },
      ikmForAuth,
      256,
    ),
  );
  
  // Build key info and nonce info
  const keyInfo = new Uint8Array([
    ...enc.encode("Content-Encoding: aes128gcm\0"),
  ]);
  const nonceInfo = new Uint8Array([
    ...enc.encode("Content-Encoding: nonce\0"),
  ]);
  
  const prkKey = await crypto.subtle.importKey(
    "raw", prk, { name: "HKDF" }, false, ["deriveBits"],
  );
  
  const contentKey = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: keyInfo },
      prkKey,
      128,
    ),
  );
  
  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
      prkKey,
      96,
    ),
  );
  
  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw", contentKey, { name: "AES-GCM" }, false, ["encrypt"],
  );
  
  // Add padding delimiter
  const payloadBytes = enc.encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2; // delimiter
  
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      paddedPayload,
    ),
  );
  
  // Build aes128gcm body
  // Header: salt(16) + rs(4) + idlen(1) + keyid(65) + encrypted
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + localPubKeyRaw.length);
  header.set(salt);
  new DataView(header.buffer).setUint32(16, rs);
  header[20] = localPubKeyRaw.length;
  header.set(localPubKeyRaw, 21);
  
  const body = new Uint8Array(header.length + encrypted.length);
  body.set(header);
  body.set(encrypted, header.length);
  
  return { body, salt, localPublicKey: localPubKeyRaw };
}

async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string,
  privateKeyJwk: JsonWebKey,
  publicKeyB64: string,
  ttl = 86400,
): Promise<Response> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  
  const authorization = await generateVapidAuthHeader(
    audience,
    "mailto:admin@plusfrokost.dk",
    privateKeyJwk,
    publicKeyB64,
  );
  
  const { body } = await encryptPayload(payload, p256dh, auth);
  
  return fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": String(ttl),
      "Urgency": "normal",
    },
    body,
  });
}

// ---- Main handler ----

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const VAPID_KEYS_JSON = Deno.env.get("VAPID_KEYS_JSON");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!VAPID_KEYS_JSON) {
      throw new Error("VAPID keys not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Parse VAPID keys - support both JWK format and base64 string format
    const parsed = JSON.parse(VAPID_KEYS_JSON);
    let privateKeyJwk: JsonWebKey;
    let publicKeyB64: string;

    if (typeof parsed.privateKey === 'object' && parsed.privateKey.kty) {
      // Full JWK format from exportVapidKeys
      privateKeyJwk = parsed.privateKey;
      // Reconstruct base64url public key from JWK x,y coordinates
      const x = base64UrlDecode(parsed.publicKey.x);
      const y = base64UrlDecode(parsed.publicKey.y);
      const uncompressed = new Uint8Array(65);
      uncompressed[0] = 0x04;
      uncompressed.set(x, 1);
      uncompressed.set(y, 33);
      publicKeyB64 = base64UrlEncode(uncompressed.buffer);
    } else if (typeof parsed.privateKey === 'string' && typeof parsed.publicKey === 'string') {
      // Old format: base64url strings
      // privateKey is raw 32-byte d value
      const dBytes = base64UrlDecode(parsed.privateKey);
      const pubBytes = base64UrlDecode(parsed.publicKey);
      // Extract x,y from uncompressed point (04 || x || y)
      const xBytes = pubBytes.slice(1, 33);
      const yBytes = pubBytes.slice(33, 65);
      privateKeyJwk = {
        kty: "EC",
        crv: "P-256",
        x: base64UrlEncode(xBytes.buffer),
        y: base64UrlEncode(yBytes.buffer),
        d: base64UrlEncode(dBytes.buffer),
      };
      publicKeyB64 = parsed.publicKey;
    } else {
      throw new Error("Unsupported VAPID key format");
    }

    console.log("VAPID keys loaded successfully, publicKeyB64 length:", publicKeyB64.length);

    const { notification_id, user_notification_id, target_user_id } = await req.json();

    // Helper to send push to subscriptions
    async function sendToSubscriptions(
      subscriptions: any[],
      payloadObj: Record<string, unknown>
    ): Promise<{ sent: number; failed: number }> {
      let sent = 0;
      let failed = 0;

      for (const sub of subscriptions) {
        try {
          const response = await sendWebPush(
            sub.endpoint,
            sub.p256dh,
            sub.auth,
            JSON.stringify(payloadObj),
            privateKeyJwk,
            publicKeyB64,
          );

          if (response.ok) {
            sent++;
            console.log(`Push sent to ${sub.endpoint.substring(0, 50)}...`);
          } else {
            const body = await response.text();
            console.error(`Push failed ${response.status}: ${body}`);
            if (response.status === 404 || response.status === 410) {
              await supabase.from("push_subscriptions").delete().eq("id", sub.id);
              console.log(`Deleted expired subscription ${sub.id}`);
            }
            failed++;
          }
        } catch (err) {
          console.error(`Push error for subscription ${sub.id}:`, err);
          failed++;
        }
      }

      return { sent, failed };
    }

    // Handle user-targeted notification
    if (user_notification_id && target_user_id) {
      const { data: userNotif } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("id", user_notification_id)
        .single();

      if (!userNotif) {
        return new Response(JSON.stringify({ sent: 0, reason: "notification_not_found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", target_user_id);

      if (!subscriptions || subscriptions.length === 0) {
        return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await sendToSubscriptions(subscriptions, {
        title: "✅ Forplejning godkendt",
        body: userNotif.message,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        tag: `user-${userNotif.id}`,
        data: { url: "/" },
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle kitchen notification
    const { data: notification, error: notifError } = await supabase
      .from("kitchen_notifications")
      .select("*")
      .eq("id", notification_id)
      .single();

    if (notifError || !notification) {
      throw new Error("Notification not found");
    }

    const { data: kitchenRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["kitchen", "admin"]);

    if (!kitchenRoles || kitchenRoles.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = kitchenRoles.map(r => r.user_id);

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIds);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await sendToSubscriptions(subscriptions, {
      title: notification.type === "new_order" ? "🍽️ Ny forplejningsbestilling" : "⚠️ Forplejning annulleret",
      body: notification.message,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: `catering-${notification.id}`,
      data: { url: "/" },
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Send push error:", error);
    return new Response(JSON.stringify({ error: "An internal error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
