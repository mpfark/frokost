import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { delay } from "../_shared/email-utils.ts";

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

// In-memory rate limiting for failed auth attempts (per IP, max 5 failures per hour)
const failedAttempts = new Map<string, { count: number; firstAttempt: number }>();
const MAX_FAILED_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = failedAttempts.get(ip);
  if (!record) return false;
  if (now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    failedAttempts.delete(ip);
    return false;
  }
  return record.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const record = failedAttempts.get(ip);
  if (!record || now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    failedAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    record.count++;
  }
}

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

async function processReminders(req: Request, testEmail?: string, cronSecret?: string, providedSecret?: string): Promise<void> {
  try {
    if (!providedSecret || cronSecret !== providedSecret) {
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
      console.error(`Unauthorized weekly reminder attempt from IP: ${ip}`);
      return;
    }

    console.log("Starting weekly lunch reminder check...");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("company_settings")
      .select("reminder_enabled, reminder_day, reminder_hour")
      .single();

    if (settingsError) {
      console.error("Error fetching company settings:", settingsError);
      return;
    }

    if (!settings?.reminder_enabled) {
      console.log("Weekly reminders are disabled in company settings");
      return;
    }

    const now = new Date();
    const danishTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' }));
    const currentDay = danishTime.getDay();
    const currentHour = danishTime.getHours();

    const configuredDay = settings.reminder_day ?? 1;
    const configuredHour = settings.reminder_hour ?? 8;

    if (!testEmail && (currentDay !== configuredDay || currentHour !== configuredHour)) {
      console.log(`Schedule check: Current day=${currentDay} hour=${currentHour}, configured day=${configuredDay} hour=${configuredHour}. Skipping.`);
      return;
    }

    console.log(`Schedule matched! Proceeding with reminders (day=${currentDay}, hour=${currentHour})`);

    const daysUntilMonday = currentDay === 1 ? 7 : (8 - currentDay) % 7;
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0);

    const nextFriday = new Date(nextMonday);
    nextFriday.setDate(nextMonday.getDate() + 4);
    nextFriday.setHours(23, 59, 59, 999);

    const mondayStr = nextMonday.toISOString().split("T")[0];
    const fridayStr = nextFriday.toISOString().split("T")[0];
    const weekNumber = getISOWeekNumber(nextMonday);

    console.log(`Checking signups for week: ${mondayStr} to ${fridayStr}`);

    // Test email mode
    if (testEmail) {
      console.log(`Test mode: Sending reminder to ${testEmail}`);
      try {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("email", testEmail)
          .single();

        const userName = profile?.full_name || testEmail.split("@")[0];

        await supabaseAdmin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "weekly-reminder",
            recipientEmail: testEmail,
            idempotencyKey: `weekly-test-${testEmail}-${mondayStr}`,
            templateData: { userName, weekNumber },
            triggeredBy: "system",
          },
        });

        console.log(`Test email queued for ${testEmail}`);
      } catch (emailError) {
        console.error(`Failed to send test email to ${testEmail}:`, emailError);
      }
      return;
    }

    // Get active users with reminders enabled
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, is_active")
      .eq("is_active", true)
      .eq("reminder_enabled", true);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    console.log(`Found ${profiles?.length || 0} active users`);

    const { data: signups, error: signupsError } = await supabaseAdmin
      .from("lunch_signups")
      .select("id, user_id, lunch_date")
      .gte("lunch_date", mondayStr)
      .lte("lunch_date", fridayStr);

    if (signupsError) throw signupsError;

    const { data: optouts, error: optoutsError } = await supabaseAdmin
      .from("lunch_optouts")
      .select("id, user_id, lunch_date")
      .gte("lunch_date", mondayStr)
      .lte("lunch_date", fridayStr);

    if (optoutsError) console.error("Error fetching optouts:", optoutsError);

    const { data: closedDates, error: closedError } = await supabaseAdmin
      .from("closed_dates")
      .select("date, reason")
      .gte("date", mondayStr)
      .lte("date", fridayStr);

    if (closedError) console.error("Error fetching closed dates:", closedError);

    const closedDatesSet = new Set((closedDates || []).map((d) => d.date));

    const weekdays: string[] = [];
    for (let i = 0; i < 5; i++) {
      const day = new Date(nextMonday);
      day.setDate(nextMonday.getDate() + i);
      weekdays.push(day.toISOString().split("T")[0]);
    }

    if (weekdays.every((day) => closedDatesSet.has(day))) {
      console.log("Kitchen is closed all week - skipping reminders");
      return;
    }

    const signedUpUserIds = new Set(signups?.map((s) => s.user_id) || []);
    const optedOutUserIds = new Set(optouts?.map((o) => o.user_id) || []);
    const usersWithDecision = new Set([...signedUpUserIds, ...optedOutUserIds]);

    const usersWithoutDecision = profiles?.filter((profile) => !usersWithDecision.has(profile.id)) || [];

    console.log(`Found ${usersWithoutDecision.length} users without any decision`);
    console.log(`Sending ${usersWithoutDecision.length} emails...`);

    let emailsSent = 0;
    let emailsFailed = 0;

    for (const user of usersWithoutDecision) {
      try {
        const userName = user.full_name || user.email.split("@")[0];

        await supabaseAdmin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "weekly-reminder",
            recipientEmail: user.email,
            idempotencyKey: `weekly-reminder-${user.id}-${mondayStr}`,
            templateData: { userName, weekNumber },
          },
        });

        emailsSent++;
        await delay(500);
      } catch (emailError) {
        console.error(`Failed to send email to ${user.email}:`, emailError);
        emailsFailed++;
        await delay(500);
      }
    }

    const result = {
      success: true,
      week: `${mondayStr} to ${fridayStr}`,
      totalActiveUsers: profiles?.length || 0,
      usersWithSignups: signedUpUserIds.size,
      usersWithOptouts: optedOutUserIds.size,
      usersWithoutDecision: usersWithoutDecision.length,
      emailsSent,
      emailsFailed,
      closedDates: closedDates?.length || 0,
    };

    console.log("Weekly reminder completed:", result);
  } catch (error: any) {
    console.error("Error in send-weekly-lunch-reminder function:", error);
  }
}

addEventListener('beforeunload', (ev) => {
  console.log('Function shutdown:', (ev as any).detail?.reason);
});

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const { testEmail } = body ? JSON.parse(body) : {};

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    if (isRateLimited(ip)) {
      console.error(`Rate limited weekly reminder attempt from IP: ${ip}`);
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const cronSecret = Deno.env.get("CRON_SECRET");
    const providedSecret = req.headers.get("x-cron-secret");

    if (!providedSecret || cronSecret !== providedSecret) {
      recordFailedAttempt(ip);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    EdgeRuntime.waitUntil(processReminders(req, testEmail, cronSecret, providedSecret));

    return new Response(
      JSON.stringify({ success: true, message: "Reminder processing started in background" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-weekly-lunch-reminder function:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred", success: false }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
