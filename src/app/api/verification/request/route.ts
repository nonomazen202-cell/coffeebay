import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql } from 'drizzle-orm';
import { getPayloadClient } from '../../../../lib/payload';
import { validateAndNormalizePhone } from '../../../../lib/validators/phone-validator';
import { verificationService } from '../../../../services/verification-service';
import { notificationService } from '../../../../services/notification-service';
import { rateLimiter } from '../../../../lib/security/rate-limiter';

const maskPhone = (p: string) => {
  if (p.length <= 6) return p;
  return p.substring(0, 6) + '*'.repeat(p.length - 8) + p.substring(p.length - 2);
};

export async function POST(req: NextRequest) {
  try {
    const { phone: rawPhone, serialCode } = await req.json();

    // 1. IP rate limit check
    let ip =
      (req as { ip?: string }).ip ||
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    if (ip.includes(',')) {
      ip = ip.split(',')[0].trim();
    }

    const ipWindow = Number(process.env.OTP_IP_LIMIT_WINDOW_SECONDS) || 600;
    const ipMax = Number(process.env.OTP_IP_LIMIT_MAX_REQUESTS) || 5;
    const ipLimitResult = await rateLimiter.checkRateLimit(`otp-ip-${ip}`, {
      windowSeconds: ipWindow,
      maxRequests: ipMax,
    });

    if (ipLimitResult.limited) {
      return NextResponse.json(
        { success: false, error: 'Too many verification requests from this IP. Please try again later.' },
        { status: 429 }
      );
    }

    // 2. Validate phone format
    const phoneResult = validateAndNormalizePhone(rawPhone || '');
    if (!phoneResult.valid) {
      return NextResponse.json(
        { success: false, error: phoneResult.error || 'Invalid phone format' },
        { status: 400 }
      );
    }
    const phone = phoneResult.normalized;

    // 3. Phone rate limit check
    const phoneWindow = Number(process.env.OTP_PHONE_LIMIT_WINDOW_SECONDS) || 600;
    const phoneMax = Number(process.env.OTP_PHONE_LIMIT_MAX_REQUESTS) || 3;
    const phoneLimitResult = await rateLimiter.checkRateLimit(`otp-phone-${phone}`, {
      windowSeconds: phoneWindow,
      maxRequests: phoneMax,
    });

    if (phoneLimitResult.limited) {
      return NextResponse.json(
        { success: false, error: 'Too many verification codes requested for this phone number. Please wait before trying again.' },
        { status: 429 }
      );
    }

    const payload = await getPayloadClient();

    // 2. Validate serial code first (cost optimization check)
    if (serialCode) {
      const uppercaseSerial = serialCode.toUpperCase();
      if (!verificationService.isValidSerialCode(uppercaseSerial)) {
        return NextResponse.json(
          { success: false, result: 'INVALID', error: 'Invalid serial code format' },
          { status: 400 }
        );
      }

      // Check existence and claimed status
      const codeCheck = await payload.db.drizzle.execute(sql`
        SELECT claimed FROM codes WHERE serial_code = ${uppercaseSerial}
      `);

      if (codeCheck.rows.length === 0) {
        return NextResponse.json(
          { success: false, result: 'INVALID', error: 'The serial code does not exist.' },
          { status: 400 }
        );
      }

      if (Boolean((codeCheck.rows[0] as { claimed: boolean }).claimed)) {
        return NextResponse.json(
          { success: false, result: 'ALREADY_USED', error: 'This serial code has already been claimed.' },
          { status: 400 }
        );
      }
    }

    // 3. Begin Transaction with write lock to prevent race conditions
    const transactionID = await payload.db.beginTransaction();
    
    // Safe extraction of the Drizzle transaction adapter supporting Map or Object types
    const dbAdapter = payload.db as unknown as { sessions?: unknown };
    const sessions = dbAdapter.sessions;
    
    interface DrizzleTxSession {
      db?: {
        execute: (query: unknown) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
      };
    }
    
    let session: DrizzleTxSession | null = null;
    
    if (sessions instanceof Map) {
      session = (sessions.get(transactionID) as DrizzleTxSession) || null;
    } else if (sessions && typeof sessions === 'object') {
      session = ((sessions as Record<string, DrizzleTxSession>)[transactionID!]) || null;
    }

    if (!session?.db) {
      await payload.db.rollbackTransaction(transactionID!);
      throw new Error('Cannot access transaction database context');
    }
    const tx = session.db;

    try {
      // Locking the active OTP records for this phone number to block concurrent calls
      const activeResult = await tx.execute(sql`
        SELECT id, code, last_sent_at, expires_at FROM otp_verifications
        WHERE phone = ${phone} AND used = false
        FOR UPDATE
      `);

      if (activeResult.rows.length > 0) {
        const activeOtp = activeResult.rows[0] as { id: number; code: string; last_sent_at: string; expires_at: string };
        const elapsed = Date.now() - new Date(activeOtp.last_sent_at).getTime();

        // Enforce 60 seconds cooldown limit
        if (elapsed < 60_000) {
          const retryAfterSeconds = Math.ceil((60_000 - elapsed) / 1000);
          await payload.db.rollbackTransaction(transactionID!);
          return NextResponse.json(
            {
              success: false,
              result: 'COOLDOWN',
              retryAfterSeconds,
              error: `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
            },
            { status: 429 }
          );
        }

        // Check if the code is still valid (not expired)
        if (new Date(activeOtp.expires_at).getTime() > Date.now()) {
          // Resend same OTP code and update the lastSentAt timestamp
          const nowStr = new Date().toISOString();
          const attemptId = `${Date.now()}-${crypto.randomUUID()}`;
          await tx.execute(sql`
            UPDATE otp_verifications
            SET last_sent_at = ${nowStr}
            WHERE id = ${activeOtp.id}
          `);

          // Queue WhatsApp verification alert
          await notificationService.queueVerification(phone, activeOtp.code, String(transactionID), attemptId);

          await payload.db.commitTransaction(transactionID!);

          console.log(`[Verification] Resending existing OTP to ${maskPhone(phone)}`);
          return NextResponse.json({
            success: true,
            result: 'OTP_SENT',
            message: 'Verification code resent.',
          });
        }

        // If active OTP expired, mark it as used/inactive so we can spawn a new one
        await tx.execute(sql`
          UPDATE otp_verifications
          SET used = true, used_at = NOW()
          WHERE id = ${activeOtp.id}
        `);
      }

      // 4. Generate new 6-digit numeric OTP
      const newOtp = crypto.randomInt(100000, 999999).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes
      const nowStr = new Date().toISOString();
      const attemptId = `${Date.now()}-${crypto.randomUUID()}`;

      // Create new OTP record
      await tx.execute(sql`
        INSERT INTO otp_verifications (phone, code, expires_at, last_sent_at, used, attempts, created_at, updated_at)
        VALUES (${phone}, ${newOtp}, ${expiresAt}, ${nowStr}, false, 0, NOW(), NOW())
      `);

      // Queue WhatsApp verification alert
      await notificationService.queueVerification(phone, newOtp, String(transactionID), attemptId);

      await payload.db.commitTransaction(transactionID!);

      console.log(`[Verification] Created new OTP for ${maskPhone(phone)}`);
      return NextResponse.json({
        success: true,
        result: 'OTP_SENT',
        message: 'Verification code sent via SMS.',
      });
    } catch (innerErr) {
      await payload.db.rollbackTransaction(transactionID!);
      throw innerErr;
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[VerificationAPI] Exception in request handler:', err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
