/**
 * Shared email utilities: color conversion, invitation email template, and helpers.
 */

export const DEFAULT_COLORS = {
  primary: "25 95% 37%",
  secondary: "35 40% 90%",
  accent: "20 90% 48%",
};

/** Convert an HSL string (e.g. "25 95% 37%") to hex for email compatibility. */
export const hslToHex = (hsl: string): string => {
  const parts = hsl.split(" ");
  if (parts.length !== 3) return "#b45309"; // Fallback amber color

  const h = parseFloat(parts[0]) / 360;
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/** Helper function for rate limiting between emails. */
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Generate invitation email HTML with dynamic colors. */
export const generateInvitationEmail = (
  inviteLink: string,
  adminName: string,
  primaryColor: string,
  accentColor: string
): string => {
  const primaryHex = hslToHex(primaryColor);
  const accentHex = hslToHex(accentColor);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation til Plusfrokost</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${primaryHex}; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🍽️ Plusfrokost</h1>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0;">Du er inviteret!</h2>
    
    <p>Hej!</p>
    
    <p>${adminName} har inviteret dig til at bruge <strong>Plusfrokost</strong> - vores frokost tilmeldingssystem.</p>
    
    <p>Klik på knappen nedenfor for at acceptere invitationen og oprette din adgangskode:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${inviteLink}" style="background: ${accentHex}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Acceptér invitation
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">
      <strong>Bemærk:</strong> Dette link udløber om 7 dage. Hvis linket er udløbet, kan du kontakte en administrator for at få tilsendt et nyt.
    </p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      Hvis knappen ikke virker, kan du kopiere dette link og indsætte det i din browser:<br>
      <a href="${inviteLink}" style="color: ${primaryHex}; word-break: break-all;">${inviteLink}</a>
    </p>
  </div>
  
  <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 20px;">
    Denne email blev sendt automatisk fra Plusfrokost-systemet.
  </p>
</body>
</html>
`;
};
