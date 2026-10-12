import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendTemplateEmail } from './transactional-email-templates/send-email.ts'

export interface LoggedSend {
  templateName: string
  recipientEmail: string
  idempotencyKey: string
  templateData?: Record<string, any>
  triggeredBy?: string
}

/** Sends a registered template and records the outcome in email_send_log. */
export async function sendLoggedEmail(p: LoggedSend): Promise<{ error: Error | null; suppressed?: boolean }> {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const base = {
    message_id: null,
    template_name: p.templateName,
    recipient_email: p.recipientEmail,
    metadata: { triggered_by: p.triggeredBy ?? 'system' },
  }
  const log = async (row: Record<string, unknown>) => {
    const { error } = await db.from('email_send_log').insert({ ...base, ...row })
    if (error) console.error('email_send_log insert failed', { code: error.code, message: error.message })
  }
  try {
    const result = await sendTemplateEmail(p.templateName, p.recipientEmail, {
      templateData: p.templateData,
      idempotencyKey: p.idempotencyKey,
    })
    if (result.sent) {
      await log({ status: 'sent' })
      return { error: null }
    }
    await log({ status: 'suppressed' })
    return { error: null, suppressed: true }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    await log({ status: 'failed', error_message: err.message.slice(0, 1000) })
    return { error: err }
  }
}
