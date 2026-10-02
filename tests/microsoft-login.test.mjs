import { build } from 'esbuild';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Exercise the real component and Lovable-to-Supabase adapter without contacting
// Microsoft, Lovable or the production database.
const root = fileURLToPath(new URL('../', import.meta.url));
const built = await build({
  stdin: { contents: `export { AuthForm } from './src/components/auth/AuthForm';
    export { lovable } from './src/integrations/lovable';
    export { renderToStaticMarkup } from 'react-dom/server';
    export { createElement } from 'react';`, resolveDir: root },
  absWorkingDir: root, bundle: true, platform: 'node', format: 'cjs', write: false,
  jsx: 'automatic',
  plugins: [{ name: 'mock-auth-services', setup(build) {
    build.onResolve({ filter: /@lovable\.dev\/cloud-auth-js|supabase\/client$/ }, args => ({ path: args.path, namespace: 'auth-mock' }));
    build.onLoad({ filter: /.*/, namespace: 'auth-mock' }, args => ({ contents:
      args.path.includes('cloud-auth-js')
        ? 'export const createLovableAuth = () => ({ signInWithOAuth: (...args) => globalThis.__loginTest.signIn(...args) });'
        : 'export const supabase = { auth: { setSession: (...args) => globalThis.__loginTest.setSession(...args) } };'
    }));
  } }],
});
const temp = await mkdtemp(join(tmpdir(), 'frokost-login-test-'));
const bundle = join(temp, 'login.cjs');
await writeFile(bundle, built.outputFiles[0].text);
const { AuthForm, lovable, renderToStaticMarkup, createElement } = createRequire(import.meta.url)(bundle);
after(async () => { delete globalThis.__loginTest; await rm(bundle); await rmdir(temp); });

test('login page renders exactly one Microsoft login button and no email/password/OTP inputs', () => {
  const html = renderToStaticMarkup(createElement(AuthForm));
  assert.equal((html.match(/<button\b/g) || []).length, 1);
  assert.match(html, /Log ind med Microsoft/);
  assert.doesNotMatch(html, /<input\b|Send login-kode|Send ny kode|Glemt adgangskode/);
});

test('Microsoft redirect does not try to establish an email session', async () => {
  const calls = [];
  globalThis.__loginTest = {
    signIn: async (...args) => { calls.push(args); return { redirected: true }; },
    setSession: async () => { assert.fail('redirect must not set a session locally'); },
  };
  assert.equal((await lovable.auth.signInWithOAuth('microsoft', { redirect_uri: 'https://example.com' })).redirected, true);
  assert.equal(calls[0][0], 'microsoft');
  assert.equal(calls[0][1].redirect_uri, 'https://example.com');
});

test('successful Microsoft token exchange sets the existing Supabase session', async () => {
  const tokens = { access_token: 'test-only', refresh_token: 'test-only' };
  globalThis.__loginTest = {
    signIn: async () => ({ tokens }),
    setSession: async value => { assert.deepEqual(value, tokens); return { error: null }; },
  };
  assert.equal((await lovable.auth.signInWithOAuth('microsoft')).error, undefined);
});

test('returned session errors propagate instead of being reported as successful login', async () => {
  const error = new Error('invalid session');
  globalThis.__loginTest = { signIn: async () => ({ tokens: {} }), setSession: async () => ({ error }) };
  assert.equal((await lovable.auth.signInWithOAuth('microsoft')).error, error);
});

test('provider failures do not establish a session', async () => {
  const error = new Error('Microsoft denied login');
  globalThis.__loginTest = { signIn: async () => ({ error }), setSession: async () => assert.fail('must not set session') };
  assert.equal((await lovable.auth.signInWithOAuth('microsoft')).error, error);
});
