import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Extract keys for web-push: applicationServerKey (public) and d (private)
    const vapidPublicKey = vapidRow.application_server_key;
    const vapidPrivateKey = vapidRow.private_key_jwk.d;

    console.log("VAPID public key:", vapidPublicKey);
    console.log("VAPID private key length:", vapidPrivateKey.length);

    webpush.setVapidDetails(
      "mailto:admin@plusfrokost.dk",
      vapidPublicKey,
      vapidPrivateKey
    );

    const { notification_id, user_notification_id, target_user_id } = await req.json();

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

          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(payloadObj),
            { TTL: 86400, urgency: "normal", topic: (payloadObj.tag as string) || "default" }
          );
          sent++;
          console.log(`Push sent to subscription ${sub.id}`);
        } catch (err: any) {
          console.error(`Push error for sub ${sub.id}: statusCode=${err?.statusCode}, body=${err?.body}, message=${err?.message}`);
          // Clean up gone subscriptions
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            console.log(`Deleted expired subscription ${sub.id}`);
          }
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
