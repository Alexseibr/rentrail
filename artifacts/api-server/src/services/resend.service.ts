import { Resend } from "resend";
import { logger } from "../lib/logger";

const IS_DEV = process.env.NODE_ENV !== "production";

async function getResendClient(): Promise<{
  client: Resend;
  fromEmail: string;
} | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    return null;
  }

  try {
    const res = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
      {
        headers: {
          Accept: "application/json",
          "X-Replit-Token": xReplitToken,
        },
      },
    );
    const data = (await res.json()) as {
      items?: Array<{ settings?: { api_key?: string; from_email?: string } }>;
    };
    const settings = data.items?.[0]?.settings;
    if (!settings?.api_key) return null;
    return {
      client: new Resend(settings.api_key),
      fromEmail: settings.from_email ?? "onboarding@resend.dev",
    };
  } catch {
    return null;
  }
}

export async function sendOtpEmail(
  to: string,
  code: string,
): Promise<{ sent: boolean; devCode?: string }> {
  if (IS_DEV) {
    logger.info({ to, code }, "[DEV] Email OTP");
    return { sent: true, devCode: code };
  }

  const resend = await getResendClient();
  if (!resend) {
    logger.error("Resend not configured — cannot send OTP email");
    throw new Error("Email service not configured");
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f5f5f5;margin:0;padding:32px">
  <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="text-align:center;margin-bottom:32px">
      <div style="display:inline-flex;width:56px;height:56px;border-radius:14px;background:#F5C518;align-items:center;justify-content:center;font-size:28px">🚲</div>
      <h1 style="margin:16px 0 4px;font-size:22px;color:#111">Rentrail</h1>
      <p style="margin:0;color:#888;font-size:14px">Платформа управления арендой</p>
    </div>
    <p style="color:#444;font-size:15px;margin:0 0 24px">Ваш код для входа:</p>
    <div style="text-align:center;background:#f8f8f8;border-radius:12px;padding:24px;margin-bottom:24px">
      <span style="font-size:40px;font-weight:700;letter-spacing:8px;color:#111;font-family:monospace">${code}</span>
    </div>
    <p style="color:#888;font-size:13px;margin:0">Код действителен 10 минут. Не передавайте его никому.</p>
  </div>
</body>
</html>`;

  await resend.client.emails.send({
    from: resend.fromEmail,
    to,
    subject: `${code} — код для входа в Rentrail`,
    html,
  });

  return { sent: true };
}
