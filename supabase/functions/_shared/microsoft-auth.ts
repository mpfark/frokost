/**
 * Shared Microsoft authentication utilities.
 * Handles both delegated (refresh token) and app-level (client credentials) flows.
 */

/** Refresh a user's delegated access token. */
export async function refreshAccessToken(
  refreshToken: string,
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: "offline_access Calendars.Read",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    console.error("Token refresh error:", await res.text());
    return null;
  }

  return await res.json();
}

/**
 * Get a valid delegated access token for a user, refreshing if expired.
 * Updates the stored token in the database when refreshed.
 * Returns null if the token cannot be refreshed.
 */
export async function getValidAccessToken(
  serviceClient: any,
  userId: string,
  tokenData: { access_token: string; refresh_token: string; expires_at: string }
): Promise<string | null> {
  const tenantId = Deno.env.get("AZURE_TENANT_ID")!;
  const clientId = Deno.env.get("AZURE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET")!;

  if (new Date(tokenData.expires_at) <= new Date()) {
    const refreshed = await refreshAccessToken(tokenData.refresh_token, tenantId, clientId, clientSecret);
    if (!refreshed) return null;

    await serviceClient
      .from("microsoft_tokens")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || tokenData.refresh_token,
        expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
      })
      .eq("user_id", userId);

    return refreshed.access_token;
  }
  return tokenData.access_token;
}

/** Get an app-level token using Client Credentials flow (for app-only access). */
export async function getAppToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Token error:", errorText);
    throw new Error("Failed to obtain app token");
  }

  const data = await res.json();
  return data.access_token;
}
