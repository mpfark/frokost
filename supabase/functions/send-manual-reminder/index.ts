import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { delay } from "../_shared/email-utils.ts";

function getISOWeekNumber(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

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

    // Verify JWT and role
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

    // Check admin or kitchen role
    const { data: isAdmin } = await serviceClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: isKitchen } = await serviceClient.rpc("has_role", { _user_id: user.id, _role: "kitchen" });

    if (!isAdmin && !isKitchen) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate current week (Mon-Fri) using Danish time
    const now = new Date();
    const danishTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Copenhagen" }));
    const currentDay = danishTime.getDay();

    let monday: Date;
    if (currentDay >= 1 && currentDay <= 5) {
      monday = new Date(danishTime);
      monday.setDate(danishTime.getDate() - (currentDay - 1));
    } else {
      const daysUntilMonday = currentDay === 0 ? 1 : 8 - currentDay;
      monday = new Date(danishTime);
      monday.setDate(danishTime.getDate() + daysUntilMonday);
    }
    monday.setHours(0, 0, 0, 0);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const mondayStr = monday.toISOString().split("T")[0];
    const fridayStr = friday.toISOString().split("T")[0];
    const weekNumber = getISOWeekNumber(monday);

    console.log(`Manual reminder for week ${weekNumber}: ${mondayStr} to ${fridayStr}`);

    // Check closed dates
    const { data: closedDates } = await serviceClient
      .from("closed_dates")
      .select("date")
      .gte("date", mondayStr)
      .lte("date", fridayStr);

    const weekdays: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekdays.push(d.toISOString().split("T")[0]);
    }

    const closedSet = new Set((closedDates || []).map(d => d.date));
    if (weekdays.every(d => closedSet.has(d))) {
      return new Response(JSON.stringify({ success: true, emailsSent: 0, message: "Køkkenet er lukket hele ugen" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get active users with reminders enabled
    const { data: profiles, error: profilesError } = await serviceClient
      .from("profiles")
      .select("id, email, full_name")
      .eq("is_active", true)
      .eq("reminder_enabled", true);

    if (profilesError) throw profilesError;

    // Get signups and optouts
    const [signupsRes, optoutsRes] = await Promise.all([
      serviceClient.from("lunch_signups").select("user_id").gte("lunch_date", mondayStr).lte("lunch_date", fridayStr),
      serviceClient.from("lunch_optouts").select("user_id").gte("lunch_date", mondayStr).lte("lunch_date", fridayStr),
    ]);

    const usersWithDecision = new Set([
      ...(signupsRes.data || []).map(s => s.user_id),
      ...(optoutsRes.data || []).map(o => o.user_id),
    ]);

    const usersWithoutDecision = (profiles || []).filter(p => !usersWithDecision.has(p.id));

    console.log(`Found ${usersWithoutDecision.length} users without decision`);

    let emailsSent = 0;
    let emailsFailed = 0;

    for (const u of usersWithoutDecision) {
      try {
        const userName = u.full_name || u.email.split("@")[0];

        await serviceClient.functions.invoke("send-transactional-email", {
          body: {
            templateName: "manual-reminder",
            recipientEmail: u.email,
            idempotencyKey: `manual-reminder-${u.id}-${mondayStr}`,
            templateData: { userName, weekNumber },
          },
        });

        emailsSent++;
        await delay(500);
      } catch (err) {
        console.error(`Failed to send to ${u.email}:`, err);
        emailsFailed++;
        await delay(500);
      }
    }

    return new Response(
      JSON.stringify({ success: true, emailsSent, emailsFailed, usersWithoutDecision: usersWithoutDecision.length, weekNumber }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-manual-reminder:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
