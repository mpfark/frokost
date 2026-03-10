import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  importVapidKeys,
  ApplicationServer,
  PushMessageError,
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
    const VAPID_KEYS_JSON = Deno.env.get("VAPID_KEYS_JSON");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!VAPID_KEYS_JSON) {
      throw new Error("VAPID keys not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Import VAPID keys from JWK format
    console.log("VAPID_KEYS_JSON type:", typeof VAPID_KEYS_JSON);
    console.log("VAPID_KEYS_JSON length:", VAPID_KEYS_JSON.length);
    console.log("VAPID_KEYS_JSON first 100 chars:", VAPID_KEYS_JSON.substring(0, 100));
    
    const exportedKeys = JSON.parse(VAPID_KEYS_JSON);
    console.log("Parsed keys type:", typeof exportedKeys);
    console.log("Parsed keys has publicKey:", !!exportedKeys.publicKey);
    console.log("Parsed keys has privateKey:", !!exportedKeys.privateKey);
    console.log("publicKey type:", typeof exportedKeys.publicKey);
    console.log("privateKey type:", typeof exportedKeys.privateKey);
    
    // If keys are strings (double-stringified), parse them
    const keysToImport = {
      publicKey: typeof exportedKeys.publicKey === 'string' ? JSON.parse(exportedKeys.publicKey) : exportedKeys.publicKey,
      privateKey: typeof exportedKeys.privateKey === 'string' ? JSON.parse(exportedKeys.privateKey) : exportedKeys.privateKey,
    };
    console.log("keysToImport publicKey kty:", keysToImport.publicKey?.kty);
    
    const vapidKeys = await importVapidKeys(keysToImport);

    // Create application server
    const appServer = await ApplicationServer.new({
      contactInformation: "mailto:admin@plusfrokost.dk",
      vapidKeys,
    });

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
          const subscriber = appServer.subscribe({
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          });

          await subscriber.pushTextMessage(
            JSON.stringify(payloadObj),
            { ttl: 86400, urgency: "normal", topic: payloadObj.tag as string || "default" }
          );
          sent++;
        } catch (err) {
          if (err instanceof PushMessageError && err.isGone()) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
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
