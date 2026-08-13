import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getPayloadClient } from '../../../../lib/payload';
import { validateAndNormalizePhone } from '../../../../lib/validators/phone-validator';
import { type PayloadRequest } from 'payload';

const maskPhone = (p: string) => {
  if (p.length <= 6) return p;
  return p.substring(0, 6) + '*'.repeat(p.length - 8) + p.substring(p.length - 2);
};

export async function POST(req: NextRequest) {
  try {
    const { phone: rawPhone, otp, name } = await req.json();

    if (!otp || otp.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Verification code is required.' },
        { status: 400 }
      );
    }

    // 1. Validate phone
    const phoneResult = validateAndNormalizePhone(rawPhone || '');
    if (!phoneResult.valid) {
      return NextResponse.json(
        { success: false, error: phoneResult.error || 'Invalid phone format' },
        { status: 400 }
      );
    }
    const phone = phoneResult.normalized;

    const payload = await getPayloadClient();

    // 2. Begin Transaction
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
      session = ((sessions as Record<string, DrizzleTxSession>)[String(transactionID)]) || null;
    }

    if (!session?.db) {
      await payload.db.rollbackTransaction(transactionID!);
      throw new Error('Cannot access transaction database context');
    }
    const tx = session.db;

    try {
      // 3. Atomic conditional update to claim OTP and prevent race conditions
      const updateResult = await tx.execute(sql`
        UPDATE otp_verifications
        SET used = true, used_at = NOW()
        WHERE phone = ${phone}
          AND code = ${otp.trim()}
          AND used = false
          AND expires_at > NOW()
      `);

      if ((updateResult.rowCount ?? 0) === 0) {
        // Race condition lost, or OTP code is invalid/expired.
        // Increment attempts on the active OTP as defense against brute force
        const findActive = await tx.execute(sql`
          SELECT id, attempts FROM otp_verifications
          WHERE phone = ${phone} AND used = false
          FOR UPDATE
        `);

        let attemptsMessage = 'Invalid or expired verification code.';

        if (findActive.rows.length > 0) {
          const activeRow = findActive.rows[0] as { id: number; attempts: number };
          const newAttempts = (activeRow.attempts || 0) + 1;

          if (newAttempts >= 5) {
            await tx.execute(sql`
              UPDATE otp_verifications
              SET attempts = ${newAttempts}, used = true, used_at = NOW()
              WHERE id = ${activeRow.id}
            `);
            attemptsMessage = 'Too many failed attempts. This verification code has been invalidated.';
          } else {
            await tx.execute(sql`
              UPDATE otp_verifications
              SET attempts = ${newAttempts}
              WHERE id = ${activeRow.id}
            `);
          }
        }

        await payload.db.commitTransaction(transactionID!);
        return NextResponse.json(
          { success: false, error: attemptsMessage },
          { status: 400 }
        );
      }

      // 4. OTP successfully claimed! Create or update verified Participant
      let participantId: number;
      const participantResult = await payload.find({
        collection: 'participants',
        where: { phone: { equals: phone } },
        req: { transactionID } as unknown as PayloadRequest,
      });

      const participantName = name && name.trim().length > 0 ? name.trim() : 'Participant';

      if (participantResult.docs.length > 0) {
        const existingParticipant = participantResult.docs[0];
        participantId = existingParticipant.id;

        // Update verification status and update name if it changed
        await payload.update({
          collection: 'participants',
          id: participantId,
          data: {
            name: existingParticipant.name !== participantName ? participantName : existingParticipant.name,
            verified: true,
            verifiedAt: new Date().toISOString(),
            verificationMethod: 'otp_whatsapp',
          },
          req: { transactionID } as unknown as PayloadRequest,
        });
      } else {
        // Create new verified Participant
        const newParticipant = await payload.create({
          collection: 'participants',
          data: {
            name: participantName,
            phone,
            verified: true,
            verifiedAt: new Date().toISOString(),
            verificationMethod: 'otp_whatsapp',
          },
          req: { transactionID } as unknown as PayloadRequest,
        });
        participantId = newParticipant.id;
      }

      await payload.db.commitTransaction(transactionID!);

      console.log(`[Verification] Successfully verified phone ${maskPhone(phone)} for participant ID ${participantId}`);
      return NextResponse.json({
        success: true,
        message: 'Phone number verified successfully.',
      });
    } catch (innerErr) {
      await payload.db.rollbackTransaction(transactionID!);
      throw innerErr;
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[VerificationAPI] Exception in confirm handler:', err);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
