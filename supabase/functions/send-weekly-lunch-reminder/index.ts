import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify cron secret to prevent unauthorized access
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = req.headers.get('x-cron-secret');

    if (!providedSecret || cronSecret !== providedSecret) {
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
      console.error(`Unauthorized weekly reminder attempt from IP: ${ip}`);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
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
      }
    );

    // Check if reminders are enabled in company settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("company_settings")
      .select("reminder_enabled")
      .single();

    if (settingsError) {
      console.error("Error fetching company settings:", settingsError);
    }

    if (settings && !settings.reminder_enabled) {
      console.log("Weekly reminders are disabled in company settings");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Reminders disabled",
          remindersEnabled: false,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Calculate the upcoming week (Monday to Friday)
    const now = new Date();
    const currentDay = now.getDay();
    
    // Calculate days until next Monday (if today is Monday, use today)
    const daysUntilMonday = currentDay === 1 ? 0 : (8 - currentDay) % 7;
    
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0);
    
    const nextFriday = new Date(nextMonday);
    nextFriday.setDate(nextMonday.getDate() + 4);
    nextFriday.setHours(23, 59, 59, 999);

    const mondayStr = nextMonday.toISOString().split('T')[0];
    const fridayStr = nextFriday.toISOString().split('T')[0];

    console.log(`Checking signups for week: ${mondayStr} to ${fridayStr}`);

    // Get all active users
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, is_active")
      .eq("is_active", true);

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

    // Get closed dates for the upcoming week
    const { data: closedDates, error: closedError } = await supabaseAdmin
      .from("closed_dates")
      .select("date, reason")
      .gte("date", mondayStr)
      .lte("date", fridayStr);

    if (closedError) {
      console.error("Error fetching closed dates:", closedError);
    }

    const closedDatesSet = new Set((closedDates || []).map(d => d.date));

    // Create a set of user IDs who have already signed up
    const signedUpUserIds = new Set(signups?.map(s => s.user_id) || []);

    // Find users who haven't signed up
    const usersWithoutSignup = profiles?.filter(
      (profile) => !signedUpUserIds.has(profile.id)
    ) || [];

    console.log(`Found ${usersWithoutSignup.length} users without signups`);

    // Calculate ISO week number for the upcoming week
    const weekNumber = getISOWeekNumber(nextMonday);
    console.log(`Week number: ${weekNumber}`);

    // Send reminder emails
    let emailsSent = 0;
    let emailsFailed = 0;

    for (const user of usersWithoutSignup) {
      try {
        const userName = user.full_name || user.email.split('@')[0];

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
          from: "Frokost Tilmelding <onboarding@resend.dev>",
          to: [user.email],
          subject: `Påmindelse: Tilmeld dig frokost (uge ${weekNumber})`,
          html: emailHtml,
        });

        console.log(`Email sent to ${user.email}:`, emailResponse);
        emailsSent++;
      } catch (emailError) {
        console.error(`Failed to send email to ${user.email}:`, emailError);
        emailsFailed++;
      }
    }

    const result = {
      success: true,
      week: `${mondayStr} to ${fridayStr}`,
      totalActiveUsers: profiles?.length || 0,
      usersWithSignups: signedUpUserIds.size,
      usersWithoutSignups: usersWithoutSignup.length,
      emailsSent,
      emailsFailed,
      closedDates: closedDates?.length || 0,
    };

    console.log("Weekly reminder completed:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-weekly-lunch-reminder function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
