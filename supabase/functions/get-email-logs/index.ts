import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const STATUS_PRIORITY: Record<string, number> = {
  sent: 5,
  bounced: 4,
  complained: 4,
  dlq: 4,
  failed: 3,
  suppressed: 2,
  pending: 1,
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await serviceClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    const templateName = url.searchParams.get("template_name");
    const status = url.searchParams.get("status");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);

    // Fetch a wide window (capped) and dedupe in JS to keep this simple
    let query = serviceClient
      .from("email_send_log")
      .select("id, message_id, template_name, recipient_email, status, error_message, created_at, metadata")
      .order("created_at", { ascending: false })
      .limit(2000);

    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);

    const { data: rawRows, error: queryError } = await query;
    if (queryError) {
      console.error("Email log query failed:", queryError);
      return new Response(JSON.stringify({ error: "Server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dedupe by message_id, keeping the row with highest status priority
    // (and falling back to most recent if no message_id)
    const byMessageId = new Map<string, typeof rawRows[0]>();
    const noMessageIdRows: typeof rawRows = [];

    for (const row of rawRows ?? []) {
      if (!row.message_id) {
        noMessageIdRows.push(row);
        continue;
      }
      const existing = byMessageId.get(row.message_id);
      if (!existing) {
        byMessageId.set(row.message_id, row);
      } else {
        const existingPriority = STATUS_PRIORITY[existing.status] ?? 0;
        const newPriority = STATUS_PRIORITY[row.status] ?? 0;
        if (newPriority > existingPriority) {
          byMessageId.set(row.message_id, row);
        }
      }
    }

    let deduped = [...byMessageId.values(), ...noMessageIdRows];

    // Apply template + status filters
    if (templateName && templateName !== "all") {
      deduped = deduped.filter((r) => r.template_name === templateName);
    }
    if (status && status !== "all") {
      if (status === "failed") {
        deduped = deduped.filter((r) =>
          ["failed", "dlq", "bounced"].includes(r.status)
        );
      } else if (status === "suppressed") {
        deduped = deduped.filter((r) =>
          ["suppressed", "complained"].includes(r.status)
        );
      } else {
        deduped = deduped.filter((r) => r.status === status);
      }
    }

    deduped.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Stats over filtered/deduped set
    const stats = {
      total: deduped.length,
      sent: deduped.filter((r) => r.status === "sent").length,
      failed: deduped.filter((r) =>
        ["failed", "dlq", "bounced"].includes(r.status)
      ).length,
      suppressed: deduped.filter((r) =>
        ["suppressed", "complained"].includes(r.status)
      ).length,
    };

    const paged = deduped.slice(offset, offset + limit);

    // Resolve triggered_by user IDs to names from profiles
    const userIds = Array.from(
      new Set(
        paged
          .map((r) => (r.metadata as any)?.triggered_by)
          .filter((v): v is string => typeof v === "string" && v !== "system" && /^[0-9a-f-]{36}$/i.test(v))
      )
    );

    const nameById = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profs } = await serviceClient
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      for (const p of profs ?? []) {
        nameById.set(p.id, p.full_name || p.email || p.id);
      }
    }

    const enrichedLogs = paged.map((r) => {
      const tb = (r.metadata as any)?.triggered_by;
      let triggered_by_label: string | null = null;
      if (tb === "system") triggered_by_label = "System";
      else if (typeof tb === "string") triggered_by_label = nameById.get(tb) ?? "Ukendt bruger";
      return { ...r, triggered_by_label };
    });

    // Distinct templates from raw rows for dropdown
    const templates = Array.from(
      new Set((rawRows ?? []).map((r) => r.template_name).filter(Boolean))
    ).sort();

    return new Response(
      JSON.stringify({
        stats,
        logs: enrichedLogs,
        total: deduped.length,
        templates,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("get-email-logs error:", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
