import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { isEmailAlertsEnabled } from "./settings-cache";

export interface WinnerAlertParams {
  participantName: string;
  participantPhone: string;
  prizeName: string;
  serialCode: string;
  occurredAt: Date;
}

export interface DrinkRewardAlertParams {
  customerName: string;
  customerPhone: string;
  drinkName: string;
  voucherCode: string;
  campaignTitle: string;
  branchName?: string | null;
  expiresAt?: string;
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

const BRAND_CID = {
  whiteLogo: "coffeebay-white-logo@coffeebay",
  darkLogo: "coffeebay-dark-logo@coffeebay",
  icon: "coffeebay-icon@coffeebay",
  waveDivider: "coffeebay-wave-divider@coffeebay",
} as const;

class AlertEmailService {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 465;
    let user = process.env.SMTP_USER || "";
    let pass = process.env.SMTP_PASS || "";

    // Strip outer quotes in case the environment parser left them literally
    if (
      (user.startsWith('"') && user.endsWith('"')) ||
      (user.startsWith("'") && user.endsWith("'"))
    ) {
      user = user.substring(1, user.length - 1);
    }
    if (
      (pass.startsWith('"') && pass.endsWith('"')) ||
      (pass.startsWith("'") && pass.endsWith("'"))
    ) {
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

  private escapeHtml(value: unknown): string {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * Resolves inline CID attachments from `public/drink-rewards/` so official Coffee Bay
   * logos and the 3D Cobalt & Silver wave pattern render reliably in Gmail, Outlook,
   * Apple Mail, and mobile clients (even when triggered from localhost).
   */
  private getBrandInlineAttachments(includeWaveDivider = true): Mail.Attachment[] {
    const publicDir = path.join(process.cwd(), "public", "drink-rewards");
    const candidates: Array<{ filename: string; cid: string; required: boolean }> = [
      {
        filename: "coffeebay-icon.png",
        cid: BRAND_CID.icon,
        required: true,
      },
      {
        filename: "coffeebay-white-logo.png",
        cid: BRAND_CID.whiteLogo,
        required: true,
      },
      {
        filename: "email-wave-divider.png",
        cid: BRAND_CID.waveDivider,
        required: includeWaveDivider,
      },
    ];

    const attachments: Mail.Attachment[] = [];
    for (const item of candidates) {
      if (!item.required) continue;
      const fullPath = path.join(publicDir, item.filename);
      if (fs.existsSync(fullPath)) {
        attachments.push({
          filename: item.filename,
          path: fullPath,
          cid: item.cid,
          contentDisposition: "inline",
        });
      }
    }
    return attachments;
  }

  /**
   * Shared Coffee Bay Rebrand Email Shell:
   * - Header & Footer ONLY in Deep Blue (#150958)
   * - Main Body in Pure White (#FFFFFF)
   * - Original 3D Wave Pattern (`paterrn1.png`) with transparent top so it blends in both Light & Dark Mode
   * - Wide layout (minimal horizontal padding) & Dark-Mode safe solid colors (no light CSS linear-gradients that break Gmail Dark Mode)
   */
  public buildBrandedEmailShell(options: {
    documentTitle: string;
    systemBadge: string;
    systemSubtitleAr?: string;
    bodyHtml: string;
    footerNote: string;
    includeWaveDivider?: boolean;
  }): string {
    const {
      documentTitle,
      systemBadge,
      systemSubtitleAr,
      bodyHtml,
      footerNote,
      includeWaveDivider = true,
    } = options;

    return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${this.escapeHtml(documentTitle)}</title>
  <style type="text/css">
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    body, table, td, p, a, span {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    @media only screen and (min-width: 560px) {
      .cb-outer-wrap {
        padding: 0 !important;
      }
      .cb-header-cell {
        padding: 20px 14px 16px 14px !important;
      }
      .cb-body-cell {
        padding: 14px 10px 12px 10px !important;
      }
    }
    @media (prefers-color-scheme: dark) {
      .cb-outer-wrap {
        background-color: #0B0F19 !important;
      }
      .cb-main-card, .cb-body-cell, .cb-wave-cell, .cb-row-even {
        background-color: #161B26 !important;
        color: #F8FAFC !important;
      }
      .cb-hero-box, .cb-row-odd {
        background-color: #1F2637 !important;
        border-color: #475569 !important;
      }
      .cb-table-wrap {
        border-color: #475569 !important;
      }
      .cb-text-title {
        color: #FFFFFF !important;
      }
      .cb-text-sub, .cb-lbl {
        color: #CBD5E1 !important;
      }
      .cb-val {
        color: #F8FAFC !important;
      }
    }
  </style>
</head>
<body bgcolor="#FFFFFF" style="margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #FFFFFF; color: #111827; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div class="cb-outer-wrap" style="width: 100%; box-sizing: border-box; margin: 0; padding: 0; background-color: #FFFFFF;">
    <table class="cb-main-card" align="center" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#FFFFFF" style="width: 100%; max-width: 100%; margin: 0; background-color: #FFFFFF; border-collapse: separate; border-spacing: 0; border-radius: 12px; overflow: hidden; border: 1px solid #C0C0C0;">
      
      <!-- Top Metallic Silver Accent Strip (#C0C0C0) -->
      <tr>
        <td bgcolor="#C0C0C0" style="height: 4px; font-size: 0; line-height: 0; background-color: #C0C0C0;">&nbsp;</td>
      </tr>

      <!-- Brand Header ONLY in Deep Blue (#150958) -->
      <tr>
        <td class="cb-header-cell" bgcolor="#150958" style="padding: 16px 8px 14px 8px; background-color: #150958; text-align: center; border-bottom: 1px solid #C0C0C0;">
          <div style="margin-bottom: 6px;">
            <img src="cid:${BRAND_CID.icon}" alt="Coffee Bay Icon" width="38" style="display: inline-block; width: 38px; height: auto; border: 0; outline: none; text-decoration: none; vertical-align: middle;" />
          </div>
          <div style="margin-bottom: 10px;">
            <img src="cid:${BRAND_CID.whiteLogo}" alt="COFFEE BAY" width="168" style="display: inline-block; width: 168px; max-width: 78%; height: auto; border: 0; outline: none; text-decoration: none;" />
          </div>
          <div>
            <span style="display: inline-block; padding: 5px 14px; border-radius: 999px; background-color: #1F1072; border: 1px solid #C0C0C0; color: #FFFFFF; font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;">
              ${this.escapeHtml(systemBadge)}
            </span>
          </div>
          ${
            systemSubtitleAr
              ? `<div style="margin-top: 6px; font-size: 13.5px; color: #C0C0C0; font-weight: 700; direction: rtl;">${this.escapeHtml(systemSubtitleAr)}</div>`
              : ""
          }
        </td>
      </tr>

      <!-- Main Body Content in Pure White (#FFFFFF) with Ultra-Low Side Padding -->
      <tr>
        <td class="cb-body-cell" bgcolor="#FFFFFF" style="padding: 10px 6px 10px 6px; background-color: #FFFFFF; color: #111827;">
          ${bodyHtml}
        </td>
      </tr>

      <!-- Original 3D Wave Ribbon from paterrn1.png (Transparent top so it adapts to both White Light Mode & Mobile Dark Mode) -->
      ${
        includeWaveDivider
          ? `<tr>
        <td class="cb-wave-cell" bgcolor="#FFFFFF" style="padding: 0; margin: 0; background-color: #FFFFFF; line-height: 0; font-size: 0;">
          <img src="cid:${BRAND_CID.waveDivider}" alt="" width="100%" style="display: block; width: 100%; height: auto; border: 0; margin: 0; padding: 0;" />
        </td>
      </tr>`
          : ""
      }

      <!-- Brand Footer ONLY in Deep Blue (#150958) -->
      <tr>
        <td bgcolor="#150958" style="padding: 14px 10px 18px 10px; background-color: #150958; text-align: center; border-top: 1px solid rgba(192, 192, 192, 0.35);">
          <div style="font-size: 11.5px; font-weight: 800; letter-spacing: 0.16em; color: #C0C0C0; text-transform: uppercase; margin-bottom: 6px;">
            MORE THAN A COFFEE, IT&rsquo;S A GOOD TIME.
          </div>
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #E2E8F0; line-height: 1.45;">
            ${this.escapeHtml(footerNote)}
          </p>
          <p style="margin: 0; font-size: 12px; color: #C0C0C0;">
            &copy; ${new Date().getFullYear()} Coffee Bay &bull; Cairo, Egypt.
          </p>
        </td>
      </tr>

    </table>
  </div>
</body>
</html>`;
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

    const emailSubject = `🏆 [Coffee Bay Lucky Cup] ${prizeName} — ${serialCode}`;

    // Plain Text representation (fallback)
    const textContent = `
🔔 Coffee Bay Operations Alert: New Lucky Cup Winner!

A new winning cup has been successfully claimed on the system.

Winner Details:
----------------------------------------
• Winner Name: ${participantName}
• Phone Number: ${participantPhone}
• Serial Code: ${serialCode}
• Prize Won: ${prizeName}
• Time of Claim: ${dateStr} at ${timeStr} (Cairo Time)
----------------------------------------
Coffee Bay • More than a coffee, it's a good time.
`;

    const safeParticipantName = this.escapeHtml(participantName);
    const safeParticipantPhone = this.escapeHtml(participantPhone);
    const safePrizeName = this.escapeHtml(prizeName);
    const safeSerialCode = this.escapeHtml(serialCode);

    const bodyHtml = `
      <!-- Compact Hero Banner on White Body (Solid #F8FAFC without CSS linear-gradient so Dark Mode never breaks text contrast) -->
      <table class="cb-hero-box" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F8FAFC" style="width: 100%; background-color: #F8FAFC; border: 1px solid #C0C0C0; border-radius: 10px; margin-bottom: 10px; border-collapse: separate; border-spacing: 0;">
        <tr>
          <td style="padding: 14px 10px; text-align: center;">
            <div class="cb-text-sub" style="font-size: 12px; font-weight: 800; letter-spacing: 0.14em; color: #475569; text-transform: uppercase; margin-bottom: 5px;">
              LUCKY CUP REWARD &bull; جائزة الكوب الرابح
            </div>
            <div class="cb-text-title" style="font-size: 22px; font-weight: 900; color: #111827; line-height: 1.25; margin-bottom: 10px;">
              ${safePrizeName}
            </div>
            <div style="display: inline-block; background-color: #150958; border: 1px solid #C0C0C0; border-radius: 8px; padding: 7px 16px;">
              <span style="font-size: 11.5px; font-weight: 700; color: #C0C0C0; letter-spacing: 0.12em; margin-right: 8px; text-transform: uppercase;">CODE:</span>
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 19px; font-weight: 900; color: #FFFFFF; letter-spacing: 0.12em;">
                ${safeSerialCode}
              </span>
            </div>
          </td>
        </tr>
      </table>

      <!-- Full-Width Wide Details Table on White Body -->
      <table class="cb-table-wrap" width="100%" cellpadding="0" cellspacing="0" bgcolor="#FFFFFF" style="width: 100%; border-collapse: collapse; background-color: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 10px; overflow: hidden;">
        <tr bgcolor="#150958" style="background-color: #150958;">
          <td colspan="2" style="padding: 11px 12px; color: #FFFFFF; font-size: 13px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;">
            WINNER RECORD &bull; بيانات الفائز
          </td>
        </tr>
        <tr class="cb-row-even" bgcolor="#FFFFFF" style="background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0;">
          <td class="cb-lbl" style="padding: 12px 10px; color: #334155; font-weight: 700; font-size: 15px; width: 34%; white-space: nowrap;">Guest / الفائز</td>
          <td class="cb-val" style="padding: 12px 10px; color: #111827; font-weight: 800; font-size: 16px; text-align: right;">${safeParticipantName}</td>
        </tr>
        <tr class="cb-row-odd" bgcolor="#F8FAFC" style="background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
          <td class="cb-lbl" style="padding: 12px 10px; color: #334155; font-weight: 700; font-size: 15px; white-space: nowrap;">Phone / الهاتف</td>
          <td class="cb-val" style="padding: 12px 10px; color: #111827; font-weight: 800; font-size: 16px; text-align: right; font-family: 'Courier New', Courier, monospace; direction: ltr;">${safeParticipantPhone}</td>
        </tr>
        <tr class="cb-row-even" bgcolor="#FFFFFF" style="background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0;">
          <td class="cb-lbl" style="padding: 12px 10px; color: #334155; font-weight: 700; font-size: 15px; white-space: nowrap;">Prize / الجائزة</td>
          <td class="cb-val" style="padding: 12px 10px; color: #111827; font-weight: 800; font-size: 16px; text-align: right;">${safePrizeName}</td>
        </tr>
        <tr class="cb-row-odd" bgcolor="#F8FAFC" style="background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
          <td class="cb-lbl" style="padding: 12px 10px; color: #334155; font-weight: 700; font-size: 15px; white-space: nowrap;">Code / الكود</td>
          <td style="padding: 12px 10px; text-align: right;">
            <span style="background-color: #150958; color: #FFFFFF; border: 1px solid #C0C0C0; padding: 4px 10px; border-radius: 6px; font-family: 'Courier New', Courier, monospace; font-size: 15.5px; font-weight: 800; letter-spacing: 0.08em;">
              ${safeSerialCode}
            </span>
          </td>
        </tr>
        <tr class="cb-row-even" bgcolor="#FFFFFF" style="background-color: #FFFFFF;">
          <td class="cb-lbl" style="padding: 12px 10px; color: #334155; font-weight: 700; font-size: 15px; white-space: nowrap;">Time / الوقت</td>
          <td class="cb-val" style="padding: 12px 10px; color: #111827; font-size: 15px; font-weight: 700; text-align: right;">
            ${dateStr} &bull; ${timeStr}
          </td>
        </tr>
      </table>
    `;

    const htmlContent = this.buildBrandedEmailShell({
      documentTitle: "Coffee Bay Lucky Cup Winner Alert",
      systemBadge: "LUCKY CUP SYSTEM • NEW WINNER",
      systemSubtitleAr: "نظام الأكواب الترويجية — إشعار فائز جديد",
      bodyHtml,
      footerNote: "Automated operational notification from Coffee Bay Lucky Cup System.",
      includeWaveDivider: true,
    });

    // Clean and split multiple recipient addresses safely
    const recipients = adminEmail
      .split(",")
      .map((e) => e.replace(/['"]/g, "").trim())
      .filter((e) => e.length > 0 && e.includes("@"));

    try {
      const transporter = this.getTransporter();
      const info = await transporter.sendMail({
        from: `"Coffee Bay Lucky Cup" <${fromAddress}>`,
        to: recipients,
        subject: emailSubject,
        text: textContent,
        html: htmlContent,
        attachments: this.getBrandInlineAttachments(true),
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

  async sendDrinkRewardAlert(
    params: DrinkRewardAlertParams,
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    const enabled = await isEmailAlertsEnabled();
    if (!enabled) {
      console.log("[AlertEmailService] SMTP email alerts are disabled in Settings. Skipping drink reward alert.");
      return { success: false, error: "Email alerts disabled in Settings" };
    }

    const adminEmail = process.env.ADMIN_ALERT_EMAIL;
    const fromAddress = process.env.SMTP_FROM || "no-reply@coffeebay.com";

    if (!adminEmail) {
      console.warn("[AlertEmailService] ADMIN_ALERT_EMAIL is not defined in environment variables.");
      return { success: false, error: "ADMIN_ALERT_EMAIL not configured" };
    }

    const {
      customerName,
      customerPhone,
      drinkName,
      voucherCode,
      campaignTitle,
      branchName,
      expiresAt,
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

    const formattedExpiry = expiresAt
      ? new Date(expiresAt).toLocaleDateString("en-US", {
          timeZone: "Africa/Cairo",
          year: "numeric",
          month: "short",
          day: "2-digit",
        })
      : null;

    const emailSubject = `☕ [Coffee Bay Drink Reward] ${drinkName} — ${voucherCode}`;

    const textContent = `
🔔 Coffee Bay Operations Alert: New Complimentary Drink Voucher Issued!

A customer has claimed their complimentary drink voucher under campaign: "${campaignTitle}".

Voucher Details:
----------------------------------------
• Customer Name: ${customerName}
• Phone Number: ${customerPhone}
• Selected Drink: ${drinkName}
• Voucher Code: ${voucherCode}
• Campaign: ${campaignTitle}
${branchName ? `• Selected Branch: ${branchName}\n` : ""}• Issued At: ${dateStr} at ${timeStr} (Cairo Time)
${formattedExpiry ? `• Valid Until: ${formattedExpiry}\n` : ""}----------------------------------------
Coffee Bay • More than a coffee, it's a good time.
`;

    const safeCustomerName = this.escapeHtml(customerName);
    const safeCustomerPhone = this.escapeHtml(customerPhone);
    const safeDrinkName = this.escapeHtml(drinkName);
    const safeVoucherCode = this.escapeHtml(voucherCode);
    const safeCampaignTitle = this.escapeHtml(campaignTitle);
    const safeBranchName = branchName ? this.escapeHtml(branchName) : null;
    const safeExpiry = formattedExpiry ? this.escapeHtml(formattedExpiry) : null;

    const bodyHtml = `
      <!-- Compact Hero Banner on White Body (Solid #F8FAFC without CSS linear-gradient so Dark Mode never breaks text contrast) -->
      <table class="cb-hero-box" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F8FAFC" style="width: 100%; background-color: #F8FAFC; border: 1px solid #C0C0C0; border-radius: 10px; margin-bottom: 10px; border-collapse: separate; border-spacing: 0;">
        <tr>
          <td style="padding: 14px 10px; text-align: center;">
            <div class="cb-text-sub" style="font-size: 12px; font-weight: 800; letter-spacing: 0.14em; color: #475569; text-transform: uppercase; margin-bottom: 5px;">
              1ST DRINK FREE &bull; قسيمة مشروب مجاني
            </div>
            <div class="cb-text-title" style="font-size: 22px; font-weight: 900; color: #111827; line-height: 1.25; margin-bottom: 10px;">
              ${safeDrinkName}
            </div>
            <div style="display: inline-block; background-color: #150958; border: 1px solid #C0C0C0; border-radius: 8px; padding: 7px 16px;">
              <span style="font-size: 11.5px; font-weight: 700; color: #C0C0C0; letter-spacing: 0.12em; margin-right: 8px; text-transform: uppercase;">VOUCHER:</span>
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 19px; font-weight: 900; color: #FFFFFF; letter-spacing: 0.12em;">
                ${safeVoucherCode}
              </span>
            </div>
          </td>
        </tr>
      </table>

      <!-- Full-Width Wide Details Table on White Body -->
      <table class="cb-table-wrap" width="100%" cellpadding="0" cellspacing="0" bgcolor="#FFFFFF" style="width: 100%; border-collapse: collapse; background-color: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 10px; overflow: hidden;">
        <tr bgcolor="#150958" style="background-color: #150958;">
          <td colspan="2" style="padding: 11px 12px; color: #FFFFFF; font-size: 13px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;">
            VOUCHER DETAILS &bull; بيانات القسيمة والعميل
          </td>
        </tr>
        <tr class="cb-row-even" bgcolor="#FFFFFF" style="background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0;">
          <td class="cb-lbl" style="padding: 12px 10px; color: #334155; font-weight: 700; font-size: 15px; width: 34%; white-space: nowrap;">Guest / العميل</td>
          <td class="cb-val" style="padding: 12px 10px; color: #111827; font-weight: 800; font-size: 16px; text-align: right;">${safeCustomerName}</td>
        </tr>
        <tr class="cb-row-odd" bgcolor="#F8FAFC" style="background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
          <td class="cb-lbl" style="padding: 12px 10px; color: #334155; font-weight: 700; font-size: 15px; white-space: nowrap;">Phone / الهاتف</td>
          <td class="cb-val" style="padding: 12px 10px; color: #111827; font-weight: 800; font-size: 16px; text-align: right; font-family: 'Courier New', Courier, monospace; direction: ltr;">${safeCustomerPhone}</td>
        </tr>
        <tr class="cb-row-even" bgcolor="#FFFFFF" style="background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0;">
          <td class="cb-lbl" style="padding: 12px 10px; color: #334155; font-weight: 700; font-size: 15px; white-space: nowrap;">Drink / المشروب</td>
          <td class="cb-val" style="padding: 12px 10px; color: #111827; font-weight: 800; font-size: 16px; text-align: right;">${safeDrinkName}</td>
        </tr>
        <tr class="cb-row-odd" bgcolor="#F8FAFC" style="background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
          <td class="cb-lbl" style="padding: 12px 10px; color: #334155; font-weight: 700; font-size: 15px; white-space: nowrap;">Code / الكود</td>
          <td style="padding: 12px 10px; text-align: right;">
            <span style="background-color: #150958; color: #FFFFFF; border: 1px solid #C0C0C0; padding: 4px 10px; border-radius: 6px; font-family: 'Courier New', Courier, monospace; font-size: 15.5px; font-weight: 800; letter-spacing: 0.08em;">
              ${safeVoucherCode}
            </span>
          </td>
        </tr>
        <tr class="cb-row-even" bgcolor="#FFFFFF" style="background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0;">
          <td class="cb-lbl" style="padding: 12px 10px; color: #334155; font-weight: 700; font-size: 15px; white-space: nowrap;">Campaign / الحملة</td>
          <td class="cb-val" style="padding: 12px 10px; color: #111827; font-weight: 700; font-size: 15px; text-align: right;">${safeCampaignTitle}</td>
        </tr>
        ${
          safeBranchName
            ? `<tr class="cb-row-odd" bgcolor="#F8FAFC" style="background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
          <td class="cb-lbl" style="padding: 12px 10px; color: #334155; font-weight: 700; font-size: 15px; white-space: nowrap;">Branch / الفرع</td>
          <td class="cb-val" style="padding: 12px 10px; color: #111827; font-weight: 800; font-size: 15px; text-align: right;">${safeBranchName}</td>
        </tr>`
            : ""
        }
        <tr class="cb-row-even" bgcolor="#FFFFFF" style="background-color: #FFFFFF; ${safeExpiry ? "border-bottom: 1px solid #E2E8F0;" : ""}">
          <td class="cb-lbl" style="padding: 12px 10px; color: #334155; font-weight: 700; font-size: 15px; white-space: nowrap;">Issued / الإصدار</td>
          <td class="cb-val" style="padding: 12px 10px; color: #111827; font-size: 15px; font-weight: 700; text-align: right;">
            ${dateStr} &bull; ${timeStr}
          </td>
        </tr>
        ${
          safeExpiry
            ? `<tr class="cb-row-odd" bgcolor="#F8FAFC" style="background-color: #F8FAFC;">
          <td class="cb-lbl" style="padding: 12px 10px; color: #334155; font-weight: 700; font-size: 15px; white-space: nowrap;">Expires / الصلاحية</td>
          <td class="cb-val" style="padding: 12px 10px; color: #111827; font-size: 15px; font-weight: 800; text-align: right;">${safeExpiry}</td>
        </tr>`
            : ""
        }
      </table>
    `;

    const htmlContent = this.buildBrandedEmailShell({
      documentTitle: "Coffee Bay Drink Reward Voucher Alert",
      systemBadge: "DRINK REWARDS SYSTEM • VOUCHER ISSUED",
      systemSubtitleAr: "نظام مكافآت المشروبات المجانية — إشعار إصدار قسيمة",
      bodyHtml,
      footerNote: "Automated operational notification from Coffee Bay Drink Rewards System.",
      includeWaveDivider: true,
    });

    const recipients = adminEmail
      .split(",")
      .map((e) => e.replace(/['"]/g, "").trim())
      .filter((e) => e.length > 0 && e.includes("@"));

    try {
      const transporter = this.getTransporter();
      const info = await transporter.sendMail({
        from: `"Coffee Bay Drink Rewards" <${fromAddress}>`,
        to: recipients,
        subject: emailSubject,
        text: textContent,
        html: htmlContent,
        attachments: this.getBrandInlineAttachments(true),
      });

      console.log("[AlertEmailService] Drink reward alert email sent successfully. Details:", {
        messageId: info.messageId,
        accepted: info.accepted,
      });
      return { success: true, messageId: info.messageId };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[AlertEmailService] Failed to send drink reward alert email:", err);
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

    const emailSubject = `🚨 [Coffee Bay ${severity}] ${title}`;

    // Sanitize details
    const cleanDetails = this.sanitizeDetails(details);
    const detailsText = cleanDetails
      ? JSON.stringify(cleanDetails, null, 2)
      : "None";

    // Plain Text fallback
    const textContent = `
🚨 Coffee Bay System Alert: [${severity}]

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

    const severityBadgeColor =
      severity === "CRITICAL"
        ? "#DC2626"
        : severity === "ERROR"
          ? "#B91C1C"
          : "#D97706";

    const bodyHtml = `
      <!-- Severity & Alert Title Banner -->
      <div class="cb-hero-box" style="background-color: #F8FAFC; border: 1px solid #C0C0C0; border-left: 4px solid ${severityBadgeColor}; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;">
        <div style="margin-bottom: 5px;">
          <span style="display: inline-block; background-color: ${severityBadgeColor}; color: #FFFFFF; font-size: 10px; font-weight: 900; padding: 2px 9px; border-radius: 999px; letter-spacing: 0.12em;">
            ${this.escapeHtml(severity)}
          </span>
          <span class="cb-text-sub" style="font-size: 11px; color: #475569; font-weight: 700; margin-left: 8px; font-family: 'Courier New', Courier, monospace;">
            ${this.escapeHtml(environment.toUpperCase())} &bull; ${this.escapeHtml(appInstance)}
          </span>
        </div>
        <div class="cb-text-title" style="font-size: 15.5px; font-weight: 900; color: #111827; line-height: 1.35;">
          ${this.escapeHtml(title)}
        </div>
      </div>

      <!-- Meta Grid -->
      <table class="cb-table-wrap" width="100%" cellpadding="0" cellspacing="0" bgcolor="#FFFFFF" style="width: 100%; margin-bottom: 14px; font-size: 12.5px; border-collapse: collapse; background-color: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 10px; overflow: hidden;">
        <tr class="cb-row-even" bgcolor="#FFFFFF" style="border-bottom: 1px solid #E2E8F0; background-color: #FFFFFF;">
          <td class="cb-lbl" style="padding: 9px 12px; color: #334155; width: 32%; font-weight: 700; white-space: nowrap;">Component</td>
          <td class="cb-val" style="padding: 9px 12px; color: #111827; font-family: 'Courier New', Courier, monospace; font-weight: 700;">${this.escapeHtml(component)}</td>
        </tr>
        <tr class="cb-row-odd" bgcolor="#F8FAFC" style="border-bottom: 1px solid #E2E8F0; background-color: #F8FAFC;">
          <td class="cb-lbl" style="padding: 9px 12px; color: #334155; font-weight: 700; white-space: nowrap;">Operation</td>
          <td class="cb-val" style="padding: 9px 12px; color: #111827; font-family: 'Courier New', Courier, monospace; font-weight: 700;">${this.escapeHtml(operation)}</td>
        </tr>
        <tr class="cb-row-even" bgcolor="#FFFFFF" style="border-bottom: 1px solid #E2E8F0; background-color: #FFFFFF;">
          <td class="cb-lbl" style="padding: 9px 12px; color: #334155; font-weight: 700; white-space: nowrap;">Request ID</td>
          <td class="cb-val" style="padding: 9px 12px; color: #111827; font-family: 'Courier New', Courier, monospace; font-weight: 800;">${this.escapeHtml(requestId || "N/A")}</td>
        </tr>
        <tr class="cb-row-odd" bgcolor="#F8FAFC" style="background-color: #F8FAFC;">
          <td class="cb-lbl" style="padding: 9px 12px; color: #334155; font-weight: 700; white-space: nowrap;">Occurred At</td>
          <td class="cb-val" style="padding: 9px 12px; color: #111827; font-weight: 700;">${dateStr} &bull; ${timeStr}</td>
        </tr>
      </table>

      <!-- Main Exception Message -->
      <div class="cb-lbl" style="font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #334155; margin: 0 0 6px 0;">
        Exception Message
      </div>
      <div style="background-color: #0E0540; border: 1px solid #C0C0C0; border-radius: 10px; padding: 12px; font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #FFFFFF; margin-bottom: 14px; white-space: pre-wrap; line-height: 1.45;">${this.escapeHtml(message)}</div>

      <!-- Diagnostic Details JSON -->
      ${
        cleanDetails
          ? `
        <div class="cb-lbl" style="font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #334155; margin: 0 0 6px 0;">
          Diagnostic Payload
        </div>
        <pre class="cb-hero-box cb-val" style="background-color: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 10px; padding: 12px; font-family: 'Courier New', Courier, monospace; font-size: 11.5px; color: #111827; overflow-x: auto; margin: 0 0 14px 0;">${this.escapeHtml(detailsText)}</pre>
      `
          : ""
      }

      <!-- Stack Trace -->
      ${
        stack
          ? `
        <div class="cb-lbl" style="font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #334155; margin: 0 0 6px 0;">
          Stack Trace
        </div>
        <pre style="background-color: #0E0540; border: 1px solid #C0C0C0; border-radius: 10px; padding: 12px; font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #E2E8F0; overflow-x: auto; margin: 0; line-height: 1.4; max-height: 240px; overflow-y: auto;">${this.escapeHtml(stack)}</pre>
      `
          : ""
      }
    `;

    const htmlContent = this.buildBrandedEmailShell({
      documentTitle: `Coffee Bay System Alert [${severity}]`,
      systemBadge: `SYSTEM MONITOR • ${severity}`,
      systemSubtitleAr: "تنبيه تقني لنظام كوفي باي",
      bodyHtml,
      footerNote: "Automated engineering & operations system alert from Coffee Bay.",
      includeWaveDivider: true,
    });

    try {
      const transporter = this.getTransporter();
      const info = await transporter.sendMail({
        from: `"Coffee Bay System Monitor" <${fromAddress}>`,
        to: devEmail,
        subject: emailSubject,
        text: textContent,
        html: htmlContent,
        attachments: this.getBrandInlineAttachments(true),
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
