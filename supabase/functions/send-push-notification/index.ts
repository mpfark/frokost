import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Web Push utilities using Web Crypto API
function b64urlToBytes(b64url: string): Uint8Array {
  const padding = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function bytesToB64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateVapidAuth(endpoint: string, vapidSubject: string, publicKey: string, privateKey: string) {
  const urlObj = new URL(endpoint);
  const audience = `${urlObj.protocol}//${urlObj.host}`;

  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: vapidSubject,
  };

  const headerB64 = bytesToB64url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key - supports both PKCS8 (base64) and JWK d-parameter (base64url) formats
  const privateKeyBytes = b64urlToBytes(privateKey);
  let cryptoKey: CryptoKey;

  if (privateKeyBytes.length > 32) {
    // PKCS8 format (full encoded key)
    cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      privateKeyBytes,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
  } else {
    // Raw d-parameter (32 bytes) - build JWK
    const publicKeyBytes = b64urlToBytes(publicKey);
    const x = bytesToB64url(publicKeyBytes.slice(1, 33));
    const y = bytesToB64url(publicKeyBytes.slice(33, 65));
    const jwk = { kty: "EC", crv: "P-256", x, y, d: privateKey, ext: true };
    cryptoKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
  }

  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format if needed
  const signatureBytes = new Uint8Array(signatureBuffer);
  let r: Uint8Array, s: Uint8Array;
  
  if (signatureBytes.length === 64) {
    // Already in raw format
    r = signatureBytes.slice(0, 32);
    s = signatureBytes.slice(32, 64);
  } else {
    // DER format - parse it
    // Skip 0x30 <len> 0x02 <rlen>
    let offset = 2;
    const rLen = signatureBytes[offset + 1];
    offset += 2;
    const rRaw = signatureBytes.slice(offset, offset + rLen);
    r = rRaw.length > 32 ? rRaw.slice(rRaw.length - 32) : rRaw;
    offset += rLen;
    const sLen = signatureBytes[offset + 1];
    offset += 2;
    const sRaw = signatureBytes.slice(offset, offset + sLen);
    s = sRaw.length > 32 ? sRaw.slice(sRaw.length - 32) : sRaw;
  }

  // Pad to 32 bytes each
  const rPadded = new Uint8Array(32);
  rPadded.set(r, 32 - r.length);
  const sPadded = new Uint8Array(32);
  sPadded.set(s, 32 - s.length);

  const rawSig = new Uint8Array(64);
  rawSig.set(rPadded, 0);
  rawSig.set(sPadded, 32);

  const sigB64 = bytesToB64url(rawSig);
  const token = `${unsignedToken}.${sigB64}`;

  return {
    authorization: `vapid t=${token}, k=${publicKey}`,
  };
}

async function encryptPayload(payload: string, p256dhKey: string, authSecret: string) {
  // Decode subscription keys
  const clientPublicKeyBytes = b64urlToBytes(p256dhKey);
  const authBytes = b64urlToBytes(authSecret);

  // Generate ephemeral ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const localPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeyPair.publicKey));

  // Import client public key
  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientPublicKey },
    localKeyPair.privateKey,
    256
  ));

  // HKDF to derive encryption key and nonce
  const encoder = new TextEncoder();
  
  // PRK = HKDF-Extract(auth, sharedSecret)
  const authHkdfKey = await crypto.subtle.importKey("raw", authBytes, { name: "HKDF" }, false, ["deriveBits"]);
  
  // Actually use HKDF properly with the ece draft spec
  // ikm = ECDH shared secret
  // salt = auth secret
  // info for PRK extraction
  const ikmKey = await crypto.subtle.importKey("raw", sharedSecret, { name: "HKDF" }, false, ["deriveBits"]);
  
  // Build info for content encryption
  const keyInfoBuf = createInfo("aesgcm", clientPublicKeyBytes, localPublicKeyRaw);
  const nonceInfoBuf = createInfo("nonce", clientPublicKeyBytes, localPublicKeyRaw);

  // Use two-step HKDF: first extract PRK from auth + shared_secret
  const prkKey = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveBits"]);
  
  const prk = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authBytes, info: encoder.encode("Content-Encoding: auth\0") },
    prkKey,
    256
  ));

  const prkCryptoKey = await crypto.subtle.importKey("raw", prk, "HKDF", false, ["deriveBits"]);

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive content encryption key
  const cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: keyInfoBuf },
    prkCryptoKey,
    128
  );

  // Derive nonce
  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfoBuf },
    prkCryptoKey,
    96
  );

  // Encrypt with AES-128-GCM
  const cek = await crypto.subtle.importKey("raw", cekBits, "AES-GCM", false, ["encrypt"]);
  
  // Add padding: 2 bytes for padding length + payload
  const paddingLength = 0;
  const paddedPayload = new Uint8Array(2 + paddingLength + encoder.encode(payload).length);
  paddedPayload[0] = (paddingLength >> 8) & 0xff;
  paddedPayload[1] = paddingLength & 0xff;
  paddedPayload.set(encoder.encode(payload), 2 + paddingLength);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonceBits, tagLength: 128 },
    cek,
    paddedPayload
  );

  // Build the body: salt(16) + rs(4) + idlen(1) + keyid(65) + encrypted
  const rs = 4096;
  const body = new Uint8Array(16 + 4 + 1 + localPublicKeyRaw.length + new Uint8Array(encrypted).length);
  let offset = 0;
  body.set(salt, offset); offset += 16;
  body[offset++] = (rs >> 24) & 0xff;
  body[offset++] = (rs >> 16) & 0xff;
  body[offset++] = (rs >> 8) & 0xff;
  body[offset++] = rs & 0xff;
  body[offset++] = localPublicKeyRaw.length;
  body.set(localPublicKeyRaw, offset); offset += localPublicKeyRaw.length;
  body.set(new Uint8Array(encrypted), offset);

  return { body, salt, localPublicKey: localPublicKeyRaw };
}

function createInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const contentEncoding = encoder.encode(`Content-Encoding: ${type}\0`);
  const p256ecdsa = encoder.encode("P-256\0");
  
  const info = new Uint8Array(
    contentEncoding.length +
    p256ecdsa.length +
    2 + clientPublicKey.length +
    2 + serverPublicKey.length
  );
  
  let offset = 0;
  info.set(contentEncoding, offset); offset += contentEncoding.length;
  info.set(p256ecdsa, offset); offset += p256ecdsa.length;
  info[offset++] = 0; info[offset++] = clientPublicKey.length;
  info.set(clientPublicKey, offset); offset += clientPublicKey.length;
  info[offset++] = 0; info[offset++] = serverPublicKey.length;
  info.set(serverPublicKey, offset);
  
  return info;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error("VAPID keys not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { notification_id, user_notification_id, target_user_id } = await req.json();

    // Handle user-targeted notification (e.g. order confirmed)
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

      const vapidSubject = "mailto:admin@plusfrokost.dk";
      let sent = 0;
      let failed = 0;

      for (const sub of subscriptions) {
        try {
          const payloadObj = {
            title: "✅ Forplejning godkendt",
            body: userNotif.message,
            icon: "/pwa-192x192.png",
            badge: "/pwa-192x192.png",
            tag: `user-${userNotif.id}`,
            data: { url: "/" },
          };

          const { authorization } = await generateVapidAuth(
            sub.endpoint, vapidSubject, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
          );

          const { body: encryptedBody } = await encryptPayload(
            JSON.stringify(payloadObj), sub.p256dh, sub.auth
          );

          const response = await fetch(sub.endpoint, {
            method: "POST",
            headers: {
              "Authorization": authorization,
              "Content-Type": "application/octet-stream",
              "Content-Encoding": "aes128gcm",
              "TTL": "86400",
            },
            body: encryptedBody,
          });

          if (response.status === 201 || response.status === 200) {
            sent++;
          } else if (response.status === 410 || response.status === 404) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            failed++;
          } else {
            console.error(`Push failed for ${sub.endpoint}: ${response.status}`);
            failed++;
          }
        } catch (err) {
          console.error(`Push error for subscription ${sub.id}:`, err);
          failed++;
        }
      }

      return new Response(JSON.stringify({ sent, failed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle kitchen notification (existing flow)
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

    const vapidSubject = "mailto:admin@plusfrokost.dk";
    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        const payloadObj = {
          title: notification.type === "new_order" ? "🍽️ Ny forplejningsbestilling" : "⚠️ Forplejning annulleret",
          body: notification.message,
          icon: "/pwa-192x192.png",
          badge: "/pwa-192x192.png",
          tag: `catering-${notification.id}`,
          data: { url: "/" },
        };

        const { authorization } = await generateVapidAuth(
          sub.endpoint, vapidSubject, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
        );

        const { body: encryptedBody } = await encryptPayload(
          JSON.stringify(payloadObj), sub.p256dh, sub.auth
        );

        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Authorization": authorization,
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            "TTL": "86400",
          },
          body: encryptedBody,
        });

        if (response.status === 201 || response.status === 200) {
          sent++;
        } else if (response.status === 410 || response.status === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          failed++;
        } else {
          console.error(`Push failed for ${sub.endpoint}: ${response.status} ${await response.text()}`);
          failed++;
        }
      } catch (err) {
        console.error(`Push error for subscription ${sub.id}:`, err);
        failed++;
      }
    }

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Send push error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
