import { build } from 'esbuild';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  absWorkingDir: root, entryPoints: ['supabase/functions/process-email-queue/index.ts'],
  bundle: true, platform: 'neutral', format: 'iife', write: false,
  plugins: [{ name: 'mock-mail-services', setup(build) {
    build.onResolve({ filter: /^npm:/ }, args => ({ path: args.path, namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path.includes('email-js')
      ? 'export const sendLovableEmail = (...args) => globalThis.sendEmail(...args);'
      : 'export const createClient = () => globalThis.database;' }));
  } }],
});

test('retired login emails are quarantined while a normal invitation is sent', async () => {
  const sent = [], operations = [];
  const message = (label, id) => ({ msg_id: id, read_ct: 1, enqueued_at: new Date().toISOString(),
    message: { message_id: String(id), label, to: 'test@example.com', subject: label, html: 'test' } });
  const database = {
    from(table) {
      const q = {
        select: () => q, in: () => q, eq: () => q,
        single: async () => ({ data: table === 'email_send_state' ? { send_delay_ms: 0 } : null }),
        maybeSingle: async () => ({ data: null }),
        insert: async () => ({ error: null }),
        then: resolve => Promise.resolve(resolve({ data: [], error: null })),
      };
      return q;
    },
    async rpc(name, args) {
      operations.push({ name, ...args });
      if (name === 'read_email_batch') return { data: [args.queue_name === 'auth_emails'
        ? message('magiclink', 1) : message('invitation', 2)], error: null };
      return { error: null };
    },
  };
  let handler;
  runInNewContext(result.outputFiles[0].text, {
    database, sendEmail: async email => sent.push(email), console, Response, Request, atob, setTimeout,
    Deno: { env: { get: () => 'test-only' }, serve: callback => { handler = callback; } },
  });
  const token = `test.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.test`;
  const response = await handler(new Request('https://example.com', { headers: { Authorization: `Bearer ${token}` } }));
  assert.equal(response.status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].label, 'invitation');
  assert.ok(operations.some(op => op.name === 'move_to_dlq' && op.source_queue === 'auth_emails' && op.message_id === 1));
  assert.ok(operations.some(op => op.name === 'delete_email' && op.queue_name === 'transactional_emails' && op.message_id === 2));
});
