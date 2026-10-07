import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const json = (obj: unknown, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const body = await req.json().catch(() => ({}));

    // Public: the VAPID public key is not secret; the frontend uses it so it always matches the sender.
    if (body.action === "get_public_key") {
      return json({ publicKey: Deno.env.get("VAPID_PUBLIC_KEY") ?? null });
    }

    // Auth: database triggers send x-push-token (stored server-side only).
    // Logged-in users may only send a test push to themselves.
    let selfTestUserId: string | null = null;
    const pushToken = req.headers.get("x-push-token");
    let authorized = false;
    if (pushToken) {
      const { data: cfg } = await supabase.from("push_internal_config").select("token").eq("id", 1).single();
      authorized = !!cfg?.token && cfg.token === pushToken;
    } else if (req.headers.get("Authorization") === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
      authorized = true;
    } else if (body.action === "self_test") {
      const jwt = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
      const { data: u } = await supabase.auth.getUser(jwt);
      if (u?.user) { selfTestUserId = u.user.id; authorized = true; }
    }
    if (!authorized) return json({ error: "Unauthorized" }, 401);
    if (selfTestUserId) { body.test_push = true; body.target_user_id = selfTestUserId; }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("VAPID keys not configured in secrets");
      return new Response(JSON.stringify({ error: "An internal error occurred" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Using VAPID keys from environment secrets");

    webpush.setVapidDetails(
      "mailto:admin@plusfrokost.dk",
      vapidPublicKey,
      vapidPrivateKey
    );

    const { notification_id, user_notification_id, target_user_id } = body;

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

          const topic = ((payloadObj.tag as string) || "default").substring(0, 32);
          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(payloadObj),
            { TTL: 86400, urgency: "normal" as any, topic }
          );
          sent++;
          console.log(`Push sent to subscription ${sub.id}`);
        } catch (err: any) {
          console.error(`Push error for sub ${sub.id}: statusCode=${err?.statusCode}, body=${err?.body}, message=${err?.message}`);
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            console.log(`Deleted expired subscription ${sub.id}`);
          }
          failed++;
        }
      }
      return { sent, failed };
    }

    // Handle test push
    if (body.test_push && body.target_user_id) {
      const { data: subscriptions } = await supabase
        .from("push_subscriptions").select("*").eq("user_id", body.target_user_id);

      if (!subscriptions?.length) {
        return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await sendToSubscriptions(subscriptions, {
        title: "🧪 Test Push",
        body: "Push-notifikationer virker! 🎉",
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        tag: `test-${Date.now()}`,
        data: { url: "/" },
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
