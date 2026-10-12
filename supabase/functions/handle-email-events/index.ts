import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.3.1'
import { createClient } from 'npm:@supabase/supabase-js@2'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

type Reason = 'bounce' | 'complaint' | 'unsubscribe'
const STATUS: Record<Reason, string> = { bounce: 'bounced', complaint: 'complained', unsubscribe: 'suppressed' }
const MESSAGE: Record<Reason, string> = {
  bounce: 'Permanent bounce — email address is invalid or rejected',
  complaint: 'Spam complaint — recipient marked email as spam',
  unsubscribe: 'Recipient unsubscribed',
}

// Notification-only mirror of the delivery outcome; never gates sending.
async function record(eventId: string, recipient: string, reason: Reason) {
  const email = recipient.toLowerCase()
  const { error: sErr } = await db
    .from('suppressed_emails')
    .upsert({ email, reason, metadata: null }, { onConflict: 'email' })
  if (sErr) {
    console.error('suppressed_emails upsert failed', { code: sErr.code, message: sErr.message, event_id: eventId })
    throw new Error('suppression write failed')
  }
  const { error: lErr } = await db.from('email_send_log').insert({
    message_id: null,
    template_name: 'system',
    recipient_email: email,
    status: STATUS[reason],
    error_message: MESSAGE[reason],
    metadata: null,
  })
  if (lErr) {
    console.error('email_send_log insert failed', { code: lErr.code, message: lErr.message, event_id: eventId })
    throw new Error('log write failed')
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': (event) => record(event.event_id, event.data.recipient, 'bounce'),
    'email.complaint': (event) => record(event.event_id, event.data.recipient, 'complaint'),
    'email.unsubscribed': (event) => record(event.event_id, event.data.recipient, 'unsubscribe'),
  },
})

Deno.serve((req) => handler(req))
