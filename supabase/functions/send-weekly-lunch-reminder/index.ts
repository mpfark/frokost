import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
// Helper function for rate limiting
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// In-memory rate limiting for failed auth attempts (per IP, max 5 failures per hour)
const failedAttempts = new Map<string, { count: number; firstAttempt: number }>();
const MAX_FAILED_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = failedAttempts.get(ip);
  if (!record) return false;
  // Reset if window expired
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
}

interface LunchSignup {
  id: string;
  user_id: string;
  lunch_date: string;
}

interface LunchOptout {
  id: string;
  user_id: string;
  lunch_date: string;
}

interface ClosedDate {
  date: string;
  reason: string | null;
}

// Calculate ISO week number
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

// Main processing function - runs in background
async function processReminders(req: Request, testEmail?: string, cronSecret?: string, providedSecret?: string): Promise<void> {
  try {
    // Verify cron secret to prevent unauthorized access
    if (!providedSecret || cronSecret !== providedSecret) {
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
      console.error(`Unauthorized weekly reminder attempt from IP: ${ip}`);
      return;
    }

    console.log("Starting weekly lunch reminder check...");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // Fetch reminder settings from database
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("company_settings")
      .select("reminder_enabled, reminder_day, reminder_hour")
      .single();

    if (settingsError) {
      console.error("Error fetching company settings:", settingsError);
      return;
    }

    // Check if reminders are enabled
    if (!settings?.reminder_enabled) {
      console.log("Weekly reminders are disabled in company settings");
      return;
    }

    // Check if current day and hour match the configured schedule (Danish timezone)
    const now = new Date();
    const danishTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' }));
    const currentDay = danishTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday
    const currentHour = danishTime.getHours();

    const configuredDay = settings.reminder_day ?? 1; // Default Monday
    const configuredHour = settings.reminder_hour ?? 8; // Default 08:00

    // If this is not a test email and the schedule doesn't match, skip
    if (!testEmail && (currentDay !== configuredDay || currentHour !== configuredHour)) {
      console.log(`Schedule check: Current day=${currentDay} hour=${currentHour}, configured day=${configuredDay} hour=${configuredHour}. Skipping.`);
      return;
    }

    console.log(`Schedule matched! Proceeding with reminders (day=${currentDay}, hour=${currentHour})`);

// Calculate the upcoming week (Monday to Friday) using Danish local time
    // Reuse danishTime from schedule check above

    // Calculate days until next Monday (always the NEXT Monday for the coming week)
    const daysUntilMonday = currentDay === 1 ? 7 : (8 - currentDay) % 7;

    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0);

    const nextFriday = new Date(nextMonday);
    nextFriday.setDate(nextMonday.getDate() + 4);
    nextFriday.setHours(23, 59, 59, 999);

    const mondayStr = nextMonday.toISOString().split("T")[0];
    const fridayStr = nextFriday.toISOString().split("T")[0];

    console.log(`Checking signups for week: ${mondayStr} to ${fridayStr}`);

    // If test email is provided, send only to that email
    if (testEmail) {
      console.log(`Test mode: Sending reminder to ${testEmail}`);

      try {
        // Try to find user in profiles to get full name
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("email", testEmail)
          .single();

        const userName = profile?.full_name || testEmail.split("@")[0];
        const weekNumber = getISOWeekNumber(nextMonday);

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <p style="color: #333; font-size: 16px; margin-bottom: 16px;">Hej ${userName},</p>
            
            <p style="color: #333; font-size: 16px; margin-bottom: 24px;">
              Husk at skriv dig op til den kommende uges frokost (uge ${weekNumber}).
            </p>
            
            <p style="margin-bottom: 32px;">
              <a href="https://frokost.pluskontoret.dk" 
                 style="color: #4CAF50; font-size: 16px; text-decoration: underline;">
                Tilmeld dig frokost her
              </a>
            </p>
            
            <p style="color: #999; font-size: 12px; margin-top: 32px;">
              Dette er en automatisk påmindelse.
            </p>
          </div>
        `;

        const emailResponse = await resend.emails.send({
          from: "Frokost Tilmelding <tilmelding@frokost.pluskontoret.dk>",
          to: [testEmail],
          subject: `Påmindelse: Tilmeld dig frokost (uge ${weekNumber})`,
          html: emailHtml,
        });

        console.log(`Test email sent to ${testEmail}:`, emailResponse);
      } catch (emailError) {
        console.error(`Failed to send test email to ${testEmail}:`, emailError);
      }
      return;
    }

    // Get all active users with reminders enabled
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

    // Get all signups for the upcoming week
    const { data: signups, error: signupsError } = await supabaseAdmin
      .from("lunch_signups")
      .select("id, user_id, lunch_date")
      .gte("lunch_date", mondayStr)
      .lte("lunch_date", fridayStr);

    if (signupsError) {
      console.error("Error fetching signups:", signupsError);
      throw signupsError;
    }

    console.log(`Found ${signups?.length || 0} signups for the upcoming week`);

    // Get all optouts for the upcoming week
    const { data: optouts, error: optoutsError } = await supabaseAdmin
      .from("lunch_optouts")
      .select("id, user_id, lunch_date")
      .gte("lunch_date", mondayStr)
      .lte("lunch_date", fridayStr);

    if (optoutsError) {
      console.error("Error fetching optouts:", optoutsError);
    }

    console.log(`Found ${optouts?.length || 0} optouts for the upcoming week`);

    // Get closed dates for the upcoming week
    const { data: closedDates, error: closedError } = await supabaseAdmin
      .from("closed_dates")
      .select("date, reason")
      .gte("date", mondayStr)
      .lte("date", fridayStr);

    if (closedError) {
      console.error("Error fetching closed dates:", closedError);
    }

    const closedDatesSet = new Set((closedDates || []).map((d) => d.date));

    // Generate all weekdays (Monday-Friday) for the upcoming week
    const weekdays: string[] = [];
    for (let i = 0; i < 5; i++) {
      const day = new Date(nextMonday);
      day.setDate(nextMonday.getDate() + i);
      weekdays.push(day.toISOString().split("T")[0]);
    }

    // Check if ALL weekdays are closed
    const allDaysClosed = weekdays.every((day) => closedDatesSet.has(day));

    if (allDaysClosed) {
      console.log("Kitchen is closed all week - skipping reminders");
      return;
    }

    // Create sets of user IDs who have already taken action (signup OR optout)
    const signedUpUserIds = new Set(signups?.map((s) => s.user_id) || []);
    const optedOutUserIds = new Set(optouts?.map((o) => o.user_id) || []);
    
    // Combine both sets - users who have made any decision
    const usersWithDecision = new Set([...signedUpUserIds, ...optedOutUserIds]);

    // Find users who haven't made any decision (neither signed up nor opted out)
    const usersWithoutDecision = profiles?.filter((profile) => !usersWithDecision.has(profile.id)) || [];

    console.log(`Found ${usersWithoutDecision.length} users without any decision (no signup or optout)`);

    // Calculate ISO week number for the upcoming week
    const weekNumber = getISOWeekNumber(nextMonday);
    console.log(`Week number: ${weekNumber}`);

    // Send reminder emails with rate limiting (2 emails/second for Resend)
    console.log(`Sending ${usersWithoutDecision.length} emails with rate limiting (2/second)...`);
    let emailsSent = 0;
    let emailsFailed = 0;

    for (const user of usersWithoutDecision) {
      try {
        const userName = user.full_name || user.email.split("@")[0];

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <p style="color: #333; font-size: 16px; margin-bottom: 16px;">Hej ${userName},</p>
            
            <p style="color: #333; font-size: 16px; margin-bottom: 24px;">
              Husk at skriv dig op til den kommende uges frokost (uge ${weekNumber}).
            </p>
            
            <p style="margin-bottom: 32px;">
              <a href="https://frokost.pluskontoret.dk" 
                 style="color: #4CAF50; font-size: 16px; text-decoration: underline;">
                Tilmeld dig frokost her
              </a>
            </p>
            
            <p style="color: #999; font-size: 12px; margin-top: 32px;">
              Dette er en automatisk påmindelse.
            </p>
          </div>
        `;

        const emailResponse = await resend.emails.send({
          from: "Frokost Tilmelding <tilmelding@frokost.pluskontoret.dk>",
          to: [user.email],
          subject: `Påmindelse: Tilmeld dig frokost (uge ${weekNumber})`,
          html: emailHtml,
        });

        console.log(`Email sent to ${user.email}:`, emailResponse);
        emailsSent++;

        // Rate limiting: wait 500ms between emails (max 2/second for Resend)
        await delay(500);
      } catch (emailError) {
        console.error(`Failed to send email to ${user.email}:`, emailError);
        emailsFailed++;

        // Still add delay even on failure to maintain rate limit
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

// Handle shutdown gracefully
addEventListener('beforeunload', (ev) => {
  console.log('Function shutdown:', (ev as any).detail?.reason);
});

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body to check for test email
    const body = await req.text();
    const { testEmail } = body ? JSON.parse(body) : {};

    // Rate limit check before auth verification
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    if (isRateLimited(ip)) {
      console.error(`Rate limited weekly reminder attempt from IP: ${ip}`);
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // Verify cron secret
    const cronSecret = Deno.env.get("CRON_SECRET");
    const providedSecret = req.headers.get("x-cron-secret");

    if (!providedSecret || cronSecret !== providedSecret) {
      recordFailedAttempt(ip);
      console.error(`Unauthorized weekly reminder attempt from IP: ${ip} (attempt ${failedAttempts.get(ip)?.count}/${MAX_FAILED_ATTEMPTS})`);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // Start processing in background - this continues after response is sent
    EdgeRuntime.waitUntil(processReminders(req, testEmail, cronSecret, providedSecret));

    // Return immediately to avoid pg_net timeout
    return new Response(
      JSON.stringify({
        success: true,
        message: "Reminder processing started in background",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-weekly-lunch-reminder function:", error);
    return new Response(
      JSON.stringify({
        error: "An internal error occurred",
        success: false,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
};

serve(handler);
