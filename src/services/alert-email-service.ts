import nodemailer from "nodemailer";
import { isEmailAlertsEnabled } from "./settings-cache";

export interface WinnerAlertParams {
  participantName: string;
  participantPhone: string;
  prizeName: string;
  serialCode: string;
  occurredAt: Date;
}

export interface DeveloperAlertParams {
  severity: "CRITICAL" | "ERROR" | "WARNING";
  title: string;
  message: string;
  component: string;
  operation: string;
  requestId?: string;
  occurredAt: Date;
  environment: string;
  details?: Record<string, unknown>;
  stack?: string;
}

class AlertEmailService {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 465;
    let user = process.env.SMTP_USER || "";
    let pass = process.env.SMTP_PASS || "";

    // Strip outer quotes in case the environment parser left them literally
    if ((user.startsWith('"') && user.endsWith('"')) || (user.startsWith("'") && user.endsWith("'"))) {
      user = user.substring(1, user.length - 1);
    }
    if ((pass.startsWith('"') && pass.endsWith('"')) || (pass.startsWith("'") && pass.endsWith("'"))) {
      pass = pass.substring(1, pass.length - 1);
    }

    if (!host || !user || !pass) {
      console.warn(
        "[AlertEmailService] SMTP credentials are not fully configured. Email alerts will be mocked/logged.",
      );
    }

    this.transporter = nodemailer.createTransport({
      host: host || "localhost",
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    return this.transporter;
  }

  private sanitizeDetails(
    details?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!details) return undefined;

    const sensitiveKeys = [
      "password",
      "passwd",
      "token",
      "secret",
      "authorization",
      "cookie",
      "apikey",
      "api_key",
      "accesstoken",
      "refreshtoken",
      "privatekey",
      "smtppass",
      "databaseurl",
    ];

    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(details)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }

  async sendWinnerAlert(
    params: WinnerAlertParams,
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    // 1. Check if email alerts are globally enabled in Settings
    const enabled = await isEmailAlertsEnabled();
    if (!enabled) {
      console.log("[AlertEmailService] SMTP email alerts are disabled in Settings. Skipping winner alert.");
      return { success: false, error: "Email alerts disabled in Settings" };
    }

    const adminEmail = process.env.ADMIN_ALERT_EMAIL;
    const fromAddress = process.env.SMTP_FROM || "no-reply@coffeebay.com";

    if (!adminEmail) {
      console.warn(
        "[AlertEmailService] ADMIN_ALERT_EMAIL is not defined in environment variables.",
      );
      return { success: false, error: "ADMIN_ALERT_EMAIL not configured" };
    }

    const {
      participantName,
      participantPhone,
      prizeName,
      serialCode,
      occurredAt,
    } = params;
    const dateStr = occurredAt.toLocaleDateString("en-US", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const timeStr = occurredAt.toLocaleTimeString("en-US", {
      timeZone: "Africa/Cairo",
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
    });

    const emailSubject = `🏆 [CoffeeBay Winner] ${prizeName} - ${serialCode}`;

    // Plain Text representation (fallback)
    const textContent = `
🔔 CoffeeBay Operations Alert: New Winner Detected!

A new winning cup has been successfully claimed on the system.

Winner Details:
----------------------------------------
• Winner Name: ${participantName}
• Phone Number: ${participantPhone}
• Serial Code: ${serialCode}
• Prize Won: ${prizeName}
• Time of Claim: ${dateStr} at ${timeStr} (Cairo Time)
----------------------------------------
`;

    // HTML representation (Clean Light Theme - CoffeeBay Identity)
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Winner Alert</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #F6F4F0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-collapse: collapse; box-shadow: 0 8px 32px rgba(35, 31, 32, 0.05); border-radius: 12px; overflow: hidden; border: 1px solid rgba(35, 31, 32, 0.09);">
          
          <!-- Header Bar (Brand Coffee Brown Accent) -->
          <tr>
            <td style="padding: 24px; background-color: #7B3B1B; text-align: center;">
              <span style="font-size: 1.5rem; font-weight: 800; color: #ffffff; letter-spacing: 0.15em;">
                COFFEE<span style="color: #2BA8E0;">BAY</span>
              </span>
              <div style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.75); font-weight: 600; margin-top: 4px; letter-spacing: 0.05em;">LUCKY CUP SYSTEM</div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <p style="color: #231F20; font-size: 0.95rem; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">
                A new winning cup has been successfully registered and claimed. Below are the winner's details for operational verification:
                <br/>
                <span style="font-size: 0.85rem; color: #615958;">تم رصد وتسجيل عملية فوز جديدة على النظام بنجاح، وتفاصيلها كالتالي:</span>
              </p>

              <!-- Winner Badge (Bright Neon Blue theme matching codes manager) -->
              <div style="background-color: rgba(43, 168, 224, 0.08); border: 1px solid rgba(43, 168, 224, 0.25); border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
                <span style="font-size: 1.25rem; font-weight: 800; color: #2BA8E0; display: block; margin-bottom: 4px;">🏆 NEW WINNER DETECTED</span>
                <span style="font-size: 0.85rem; color: #7b3b1b; font-weight: 700; background-color: rgba(123, 59, 27, 0.1); padding: 4px 10px; border-radius: 9999px; display: inline-block;">
                  Prize: ${prizeName}
                </span>
              </div>

              <!-- Details Table -->
              <table style="width: 100%; border-collapse: collapse;">
                <!-- Winner Name -->
                <tr style="border-bottom: 1px solid rgba(35, 31, 32, 0.09);">
                  <td style="padding: 12px 8px; color: #615958; font-weight: 600; font-size: 0.9rem;">Winner Name / اسم الفائز</td>
                  <td style="padding: 12px 8px; color: #231F20; font-weight: 700; font-size: 0.95rem; text-align: right;">${participantName}</td>
                </tr>
                <!-- Winner Phone -->
                <tr style="border-bottom: 1px solid rgba(35, 31, 32, 0.09);">
                  <td style="padding: 12px 8px; color: #615958; font-weight: 600; font-size: 0.9rem;">Phone Number / رقم الهاتف</td>
                  <td style="padding: 12px 8px; color: #231F20; font-weight: 700; font-size: 0.95rem; text-align: right; direction: ltr;">${participantPhone}</td>
                </tr>
                <!-- Ticket Serial Code -->
                <tr style="border-bottom: 1px solid rgba(35, 31, 32, 0.09);">
                  <td style="padding: 12px 8px; color: #615958; font-weight: 600; font-size: 0.9rem;">Serial Code / كود الكوب</td>
                  <td style="padding: 12px 8px; text-align: right;">
                    <span style="background-color: #F6F4F0; border: 1px solid rgba(35, 31, 32, 0.15); padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 1rem; font-weight: 800; color: #2BA8E0; letter-spacing: 0.05em;">
                      ${serialCode}
                    </span>
                  </td>
                </tr>
                <!-- Claim Timestamp -->
                <tr>
                  <td style="padding: 12px 8px; color: #615958; font-weight: 600; font-size: 0.9rem;">Time of Claim / وقت الفوز</td>
                  <td style="padding: 12px 8px; color: #231F20; font-size: 0.9rem; text-align: right;">
                    <strong>${dateStr}</strong> — ${timeStr} <span style="font-size: 0.8rem; color: #8B8280;">(Cairo Time)</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer (Espresso Dark Theme) -->
          <tr>
            <td style="padding: 20px; background-color: #7B3B1B; text-align: center; font-size: 0.75rem; color: rgba(255, 255, 255, 0.75);">
              <p style="margin: 0 0 6px 0;">This is an automated operational alert generated by CoffeeBay Lucky Cup System.</p>
              <p style="margin: 0;">&copy; 2026 CoffeeBay Co. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </body>
      </html>
    `;

    try {
      const transporter = this.getTransporter();
      const info = await transporter.sendMail({
        from: `"CoffeeBay-Lucky-Cup" <${fromAddress}>`,
        to: adminEmail,
        subject: emailSubject,
        text: textContent,
        html: htmlContent,
      });

      console.log("[AlertEmailService] Winner alert email sent successfully. Details:", {
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
        pending: info.pending,
      });
      return { success: true, messageId: info.messageId };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(
        "[AlertEmailService] Failed to send winner alert email:",
        err,
      );
      return { success: false, error: errorMsg };
    }
  }

  async sendDeveloperAlert(
    params: DeveloperAlertParams,
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    const devEmail = process.env.DEVELOPER_ALERT_EMAIL;
    const fromAddress = process.env.SMTP_FROM || "no-reply@coffeebay.com";
    const appInstance =
      process.env.APP_INSTANCE || process.env.HOSTNAME || "production-main";

    if (!devEmail) {
      console.warn(
        "[AlertEmailService] DEVELOPER_ALERT_EMAIL is not defined in environment variables.",
      );
      return { success: false, error: "DEVELOPER_ALERT_EMAIL not configured" };
    }

    const {
      severity,
      title,
      message,
      component,
      operation,
      requestId,
      occurredAt,
      environment,
      details,
      stack,
    } = params;

    const dateStr = occurredAt.toLocaleDateString("en-US", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const timeStr = occurredAt.toLocaleTimeString("en-US", {
      timeZone: "Africa/Cairo",
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const emailSubject = `🚨 [CoffeeBay-${severity}] ${title}`;

    // Sanitize details
    const cleanDetails = this.sanitizeDetails(details);
    const detailsText = cleanDetails
      ? JSON.stringify(cleanDetails, null, 2)
      : "None";

    // Plain Text fallback
    const textContent = `
🚨 CoffeeBay System Alert: [${severity}]

Title: ${title}
Component: ${component}
Operation: ${operation}
Environment: ${environment}
Host/Instance: ${appInstance}
Occurred At: ${dateStr} at ${timeStr} Cairo Time
Request ID: ${requestId || "N/A"}

Error Message:
${message}

Diagnostic Details:
${detailsText}

Stack Trace:
${stack || "N/A"}
`;

    // HTML representation (Engineering Dashboard Dark/Crimson Theme)
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Developer Alert</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0f0d0e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 650px; margin: 20px auto; background-color: #1a1617; border-collapse: collapse; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5); border-radius: 8px; overflow: hidden; border: 1px solid #2e2628;">
          
          <!-- Header Bar (Critical Crimson/Black Theme) -->
          <tr>
            <td style="padding: 20px 24px; background-color: #110e0f; text-align: left; border-bottom: 3px solid #e53e3e;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size: 1.25rem; font-weight: 800; color: #ffffff; letter-spacing: 0.1em;">
                      🚨 COFFEE<span style="color: #e53e3e;">BAY</span> SYSTEM ALERT
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <span style="background-color: #e53e3e; color: #ffffff; font-size: 0.75rem; font-weight: 900; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.05em;">
                      ${severity}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Alert Details Content -->
          <tr>
            <td style="padding: 24px; color: #e2e8f0;">
              
              <!-- Meta Grid -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px; font-size: 0.85rem; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #a0aec0; width: 140px; font-weight: 600;">Title</td>
                  <td style="padding: 6px 0; color: #ffffff; font-weight: bold;">${title}</td>
                </tr>
                <tr style="border-top: 1px solid #2e2628;">
                  <td style="padding: 6px 0; color: #a0aec0; font-weight: 600;">Component</td>
                  <td style="padding: 6px 0; color: #ffffff; font-family: monospace;">${component}</td>
                </tr>
                <tr style="border-top: 1px solid #2e2628;">
                  <td style="padding: 6px 0; color: #a0aec0; font-weight: 600;">Operation</td>
                  <td style="padding: 6px 0; color: #ffffff; font-family: monospace;">${operation}</td>
                </tr>
                <tr style="border-top: 1px solid #2e2628;">
                  <td style="padding: 6px 0; color: #a0aec0; font-weight: 600;">Environment</td>
                  <td style="padding: 6px 0; color: #ffffff; font-weight: bold;">${environment.toUpperCase()}</td>
                </tr>
                <tr style="border-top: 1px solid #2e2628;">
                  <td style="padding: 6px 0; color: #a0aec0; font-weight: 600;">Host / Instance</td>
                  <td style="padding: 6px 0; color: #ffffff; font-family: monospace;">${appInstance}</td>
                </tr>
                <tr style="border-top: 1px solid #2e2628;">
                  <td style="padding: 6px 0; color: #a0aec0; font-weight: 600;">Request ID</td>
                  <td style="padding: 6px 0; color: #2BA8E0; font-family: monospace; font-weight: bold;">${requestId || "N/A"}</td>
                </tr>
                <tr style="border-top: 1px solid #2e2628;">
                  <td style="padding: 6px 0; color: #a0aec0; font-weight: 600;">Occurred At</td>
                  <td style="padding: 6px 0; color: #e2e8f0;">${dateStr} — ${timeStr} (Cairo Time)</td>
                </tr>
              </table>

              <!-- Main Exception Message -->
              <h4 style="color: #e53e3e; margin: 0 0 8px 0; font-size: 0.95rem; font-weight: bold; border-left: 3px solid #e53e3e; padding-left: 8px;">Error Message</h4>
              <div style="background-color: #110e0f; border: 1px solid #2e2628; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 0.85rem; color: #f7fafc; margin-bottom: 24px; white-space: pre-wrap; line-height: 1.4;">${message}</div>

              <!-- Diagnostic Details JSON -->
              ${
                cleanDetails
                  ? `
                <h4 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 0.95rem; font-weight: bold; padding-left: 8px;">Diagnostic Details</h4>
                <pre style="background-color: #110e0f; border: 1px solid #2e2628; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 0.8rem; color: #a0aec0; overflow-x: auto; margin: 0 0 24px 0;">${detailsText}</pre>
              `
                  : ""
              }

              <!-- Stack Trace -->
              ${
                stack
                  ? `
                <h4 style="color: #e2e8f0; margin: 0 0 8px 0; font-size: 0.95rem; font-weight: bold; padding-left: 8px;">Stack Trace</h4>
                <pre style="background-color: #110e0f; border: 1px solid #e53e3e40; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 0.75rem; color: #f56565; overflow-x: auto; margin: 0; line-height: 1.4; max-height: 250px; overflow-y: auto;">${stack}</pre>
              `
                  : ""
              }

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 24px; background-color: #110e0f; border-top: 1px solid #2e2628; text-align: center; font-size: 0.7rem; color: #71717a;">
              This is an automated developer system notification from CoffeeBay Co.
            </td>
          </tr>

        </table>
      </body>
      </html>
    `;

    try {
      const transporter = this.getTransporter();
      const info = await transporter.sendMail({
        from: `"CoffeeBay-Lucky-Cup" <${fromAddress}>`,
        to: devEmail,
        subject: emailSubject,
        text: textContent,
        html: htmlContent,
      });

      console.log("[AlertEmailService] Developer alert email sent successfully. Details:", {
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
        pending: info.pending,
      });
      return { success: true, messageId: info.messageId };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(
        "[AlertEmailService] Failed to send developer alert email:",
        err,
      );
      return { success: false, error: errorMsg };
    }
  }
}

export const alertEmailService = new AlertEmailService();
