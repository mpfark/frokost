import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { refreshAccessToken } from "../_shared/microsoft-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const tenantId = Deno.env.get("AZURE_TENANT_ID")!;
    const clientId = Deno.env.get("AZURE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET")!;

    // Get subscriptions expiring within 24 hours
    const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: subs } = await serviceClient
      .from("graph_subscriptions")
      .select("*, microsoft_tokens:user_id(access_token, refresh_token, expires_at)")
      .lte("expires_at", cutoff);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ renewed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/calendar-webhook`;
    let renewed = 0;

    for (const sub of subs) {
      const { data: tokenData } = await serviceClient
        .from("microsoft_tokens")
        .select("*")
        .eq("user_id", sub.user_id)
        .single();

      if (!tokenData) {
        await serviceClient.from("graph_subscriptions").delete().eq("id", sub.id);
        continue;
      }

      let accessToken = tokenData.access_token;
      if (new Date(tokenData.expires_at) <= new Date()) {
        const refreshed = await refreshAccessToken(tokenData.refresh_token, tenantId, clientId, clientSecret);
        if (!refreshed) {
          await serviceClient.from("graph_subscriptions").delete().eq("id", sub.id);
          continue;
        }
        accessToken = refreshed.access_token;
        await serviceClient
          .from("microsoft_tokens")
          .update({
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token || tokenData.refresh_token,
            expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
          })
          .eq("user_id", sub.user_id);
      }

      const newExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 - 60000).toISOString();

      const renewRes = await fetch(
        `https://graph.microsoft.com/v1.0/subscriptions/${sub.subscription_id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ expirationDateTime: newExpiry }),
        }
      );

      if (renewRes.ok) {
        await serviceClient
          .from("graph_subscriptions")
          .update({ expires_at: newExpiry, updated_at: new Date().toISOString() })
          .eq("id", sub.id);
        renewed++;
      } else {
        console.error("Failed to renew subscription", sub.subscription_id, await renewRes.text());
        const createRes = await fetch("https://graph.microsoft.com/v1.0/subscriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            changeType: "created,updated,deleted",
            notificationUrl: webhookUrl,
            resource: "me/events",
            expirationDateTime: newExpiry,
          }),
        });

        if (createRes.ok) {
          const newSub = await createRes.json();
          await serviceClient
            .from("graph_subscriptions")
            .update({
              subscription_id: newSub.id,
              expires_at: newSub.expirationDateTime,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);
          renewed++;
        } else {
          console.error("Failed to recreate subscription for user", sub.user_id);
          await serviceClient.from("graph_subscriptions").delete().eq("id", sub.id);
        }
      }
    }

    return new Response(JSON.stringify({ renewed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Renewal error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
