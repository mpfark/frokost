import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  // Convert DER signature to raw r||s (64 bytes)
  const sigArray = new Uint8Array(sig);
  let r: Uint8Array, s: Uint8Array;
  if (sigArray.length === 64) {
    r = sigArray.slice(0, 32);
    s = sigArray.slice(32);
  } else {
    // DER format parsing
    let offset = 2;
    const rLen = sigArray[offset + 1];
    r = sigArray.slice(offset + 2, offset + 2 + rLen);
    offset = offset + 2 + rLen;
    const sLen = sigArray[offset + 1];
    s = sigArray.slice(offset + 2, offset + 2 + sLen);
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
): Promise<{ body: Uint8Array }> {
  const enc = new TextEncoder();

  const localKey = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );

  const subPubKeyRaw = base64UrlDecode(p256dhKey);
  const subPubKey = await crypto.subtle.importKey(
    "raw", subPubKeyRaw, { name: "ECDH", namedCurve: "P-256" }, false, [],
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: subPubKey }, localKey.privateKey, 256,
    ),
  );

  const localPubKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKey.publicKey),
  );

  const authSecretBytes = base64UrlDecode(authSecret);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF key derivation (RFC 8291)
  const authInfo = enc.encode("Content-Encoding: auth\0");
  const ikmForAuth = await crypto.subtle.importKey(
    "raw", sharedSecret, { name: "HKDF" }, false, ["deriveBits"],
  );
  const prk = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: authSecretBytes, info: authInfo },
      ikmForAuth, 256,
    ),
  );

  const keyInfo = enc.encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = enc.encode("Content-Encoding: nonce\0");

  const prkKey = await crypto.subtle.importKey(
    "raw", prk, { name: "HKDF" }, false, ["deriveBits"],
  );

  const contentKey = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: keyInfo }, prkKey, 128,
    ),
  );

  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo }, prkKey, 96,
    ),
  );

  const aesKey = await crypto.subtle.importKey(
    "raw", contentKey, { name: "AES-GCM" }, false, ["encrypt"],
  );

  const payloadBytes = enc.encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2;

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce }, aesKey, paddedPayload,
    ),
  );

  // aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + localPubKeyRaw.length);
  header.set(salt);
  new DataView(header.buffer).setUint32(16, rs);
  header[20] = localPubKeyRaw.length;
  header.set(localPubKeyRaw, 21);

  const body = new Uint8Array(header.length + encrypted.length);
  body.set(header);
  body.set(encrypted, header.length);

  return { body };
}

async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string,
  privateKeyJwk: JsonWebKey,
  publicKeyB64: string,
): Promise<Response> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const authorization = await generateVapidAuthHeader(
    audience, "mailto:admin@plusfrokost.dk", privateKeyJwk, publicKeyB64,
  );

  const { body } = await encryptPayload(payload, p256dh, auth);

  return fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
      "Urgency": "normal",
    },
    body,
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Load VAPID keys from database
    const { data: vapidRow, error: vapidError } = await supabase
      .from("vapid_keys")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (vapidError || !vapidRow) {
      throw new Error("VAPID keys not found in database: " + vapidError?.message);
    }

    const privateKeyJwk = vapidRow.private_key_jwk as JsonWebKey;
    const publicKeyB64 = vapidRow.application_server_key as string;

    console.log("VAPID keys loaded from DB, applicationServerKey length:", publicKeyB64.length);

    const { notification_id, user_notification_id, target_user_id } = await req.json();

    async function sendToSubscriptions(
      subscriptions: any[],
      payloadObj: Record<string, unknown>
    ): Promise<{ sent: number; failed: number }> {
      let sent = 0;
      let failed = 0;

      for (const sub of subscriptions) {
        try {
          const response = await sendWebPush(
            sub.endpoint, sub.p256dh, sub.auth,
            JSON.stringify(payloadObj), privateKeyJwk, publicKeyB64,
          );

          if (response.ok) {
            sent++;
            console.log(`Push sent successfully to subscription ${sub.id}`);
          } else {
            const body = await response.text();
            console.error(`Push failed ${response.status}: ${body}`);
            if (response.status === 404 || response.status === 410) {
              await supabase.from("push_subscriptions").delete().eq("id", sub.id);
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
        .from("user_notifications").select("*").eq("id", user_notification_id).single();

      if (!userNotif) {
        return new Response(JSON.stringify({ sent: 0, reason: "notification_not_found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: subscriptions } = await supabase
        .from("push_subscriptions").select("*").eq("user_id", target_user_id);

      if (!subscriptions?.length) {
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
      .from("kitchen_notifications").select("*").eq("id", notification_id).single();

    if (notifError || !notification) throw new Error("Notification not found");

    const { data: kitchenRoles } = await supabase
      .from("user_roles").select("user_id").in("role", ["kitchen", "admin"]);

    if (!kitchenRoles?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subscriptions } = await supabase
      .from("push_subscriptions").select("*").in("user_id", kitchenRoles.map(r => r.user_id));

    if (!subscriptions?.length) {
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
