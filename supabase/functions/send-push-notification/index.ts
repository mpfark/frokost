import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  importVapidKeys,
  buildPushPayload,
} from "jsr:@negrel/webpush@0.6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Import VAPID keys using the library
    const vapidKeys = await importVapidKeys({
      publicKey: VAPID_PUBLIC_KEY,
      privateKey: VAPID_PRIVATE_KEY,
    });

    const { notification_id, user_notification_id, target_user_id } = await req.json();

    // Helper to send push to a list of subscriptions
    async function sendToSubscriptions(
      subscriptions: any[],
      payloadObj: Record<string, unknown>
    ): Promise<{ sent: number; failed: number }> {
      let sent = 0;
      let failed = 0;

      for (const sub of subscriptions) {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };

          const payload = await buildPushPayload(
            {
              ...pushSubscription,
              // @ts-ignore - webpush expects slightly different format
              expirationTime: null,
            },
            vapidKeys,
            JSON.stringify(payloadObj),
            { adminContact: "mailto:admin@plusfrokost.dk", ttl: 86400 }
          );

          const response = await fetch(sub.endpoint, payload);

          if (response.status === 201 || response.status === 200) {
            sent++;
          } else if (response.status === 410 || response.status === 404) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            failed++;
          } else {
            const body = await response.text();
            console.error(`Push failed for ${sub.endpoint}: ${response.status} ${body}`);
            failed++;
          }
        } catch (err) {
          console.error(`Push error for subscription ${sub.id}:`, err);
          failed++;
        }
      }

      return { sent, failed };
    }

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

      const payloadObj = {
        title: "✅ Forplejning godkendt",
        body: userNotif.message,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        tag: `user-${userNotif.id}`,
        data: { url: "/" },
      };

      const result = await sendToSubscriptions(subscriptions, payloadObj);
      return new Response(JSON.stringify(result), {
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

    const payloadObj = {
      title: notification.type === "new_order" ? "🍽️ Ny forplejningsbestilling" : "⚠️ Forplejning annulleret",
      body: notification.message,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: `catering-${notification.id}`,
      data: { url: "/" },
    };

    const result = await sendToSubscriptions(subscriptions, payloadObj);
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
