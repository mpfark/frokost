import { corsHeaders } from "./cors.ts";

/** Deployment tombstone: old public endpoints must never mint email sessions. */
export function retiredEmailLogin(req: Request): Response {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return Response.json({ success: false, error: "microsoft_login_required", message: "Log ind med Microsoft på forsiden." },
    { status: 410, headers: corsHeaders });
}

/** Reject the old Auth email hook; transactional invitation/reminder mail is separate. */
export function rejectAuthEmail(req: Request): Response {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return Response.json({ error: { http_code: 403, message: "Email authentication is disabled. Use Microsoft sign-in." } },
    { status: 403, headers: corsHeaders });
}
