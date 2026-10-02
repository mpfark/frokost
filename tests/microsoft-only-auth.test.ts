import { test } from "node:test";
import assert from "node:assert/strict";
import { retiredEmailLogin, rejectAuthEmail } from "../supabase/functions/_shared/retired-email-auth.ts";

test("old invitation endpoints cannot issue a login link, even with a code or bearer token", async () => {
  for (const body of [{ inviteCode: "previously-valid-code" }, { invitationId: "old-id" }, {}]) {
    const response = retiredEmailLogin(new Request("https://example.com/generate-invite-link", {
      method: "POST", headers: { Authorization: "Bearer previous-session" }, body: JSON.stringify(body),
    }));
    assert.equal(response.status, 410);
    const result = await response.json();
    assert.equal(result.success, false);
    assert.equal(result.error, "microsoft_login_required");
    assert.equal(result.link, undefined);
  }
});

test("authentication email requests are rejected, including the former preview route", async () => {
  for (const path of ["/", "/preview"]) {
    const response = rejectAuthEmail(new Request(`https://example.com${path}`, {
      method: "POST", body: JSON.stringify({ type: "magiclink" }),
    }));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.http_code, 403);
  }
});

test("CORS preflights remain available without creating a session", () => {
  for (const handler of [retiredEmailLogin, rejectAuthEmail]) {
    const response = handler(new Request("https://example.com", { method: "OPTIONS" }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  }
});
