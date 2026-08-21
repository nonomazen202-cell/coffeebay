import { type PayloadRequest } from 'payload';
import { sql } from 'drizzle-orm';
import { getPayloadClient } from '../lib/payload';
import { verificationService } from './verification-service';
import { notificationService } from './notification-service';
import { validateAndNormalizePhone } from '../lib/validators/phone-validator';
import { alertEmailService } from './alert-email-service';

export interface RedeemRequest {
  name: string;
  phone: string;
  serialCode: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  timer?: import('../lib/telemetry').RequestTimer;
}

export type RedeemResultStatus = 'WIN' | 'LOSE' | 'INVALID' | 'ALREADY_USED';

export interface RedeemResponse {
  success: boolean;
  result: RedeemResultStatus;
  participantId?: string | number;
  entryId?: string | number;
  prizeName?: string;
  prizeImageUrl?: string;
  verificationCode?: string;
  message?: string;
}

// Internal types for raw SQL query results
interface CodeRow {
  id: number;
  serial_code: string;
  is_winner: boolean;
  prize_id_id: number | null; // Payload relationship column naming: fieldName + _id
  claimed: boolean;
  claimed_at: string | null;
}

interface PrizeRow {
  id: number;
  name: string;
  quantity: number;
  image_id: number | null;
}

interface MediaRow {
  url: string | null;
}

// Helper type for Drizzle raw SQL query result
interface DrizzleQueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
}

export class RedeemService {
  async redeemCode(request: RedeemRequest): Promise<RedeemResponse> {
    const { name, phone: rawPhone, serialCode, ip, userAgent, requestId, timer } = request;

    // 1. Basic validation
    if (!name || name.trim().length === 0) {
      return { success: false, result: 'INVALID', message: 'Name is required' };
    }
    if (!rawPhone || rawPhone.trim().length < 5) {
      return { success: false, result: 'INVALID', message: 'A valid phone number is required' };
    }
    if (!serialCode || !verificationService.isValidSerialCode(serialCode.toUpperCase())) {
      return { success: false, result: 'INVALID', message: 'Invalid serial code format' };
    }

    const phoneResult = validateAndNormalizePhone(rawPhone);
    const phone = phoneResult.valid ? phoneResult.normalized : rawPhone;

    const uppercaseSerial = serialCode.toUpperCase();
    
    timer?.startStep('db_payload_client');
    const payload = await getPayloadClient();
    timer?.endStep('db_payload_client');
    console.log(`[${requestId}] STEP 1 -> Payload Ready`);

    // 2. Begin Transaction
    timer?.startStep('db_begin_transaction');
    const transactionID = await payload.db.beginTransaction();
    timer?.endStep('db_begin_transaction');
    console.log(`[${requestId}] STEP 2 -> Transaction Started`);

    try {
      // ─── Access the Drizzle transaction from the Payload session ───────────────
      const dbAdapter = payload.db as unknown as { sessions?: unknown };
      const sessions = dbAdapter.sessions;

      interface DrizzleTxSession {
        db?: {
          execute: (query: unknown) => Promise<DrizzleQueryResult>;
        };
      }

      let session: DrizzleTxSession | null = null;

      if (sessions instanceof Map) {
        session = (sessions.get(transactionID) as DrizzleTxSession) || null;
      } else if (sessions && typeof sessions === 'object') {
        session = ((sessions as Record<string, DrizzleTxSession>)[String(transactionID)]) || null;
      }

      if (!session?.db) {
        throw new Error('Cannot access Payload transaction session for atomic operations');
      }

      const tx = session.db;

      // ─── Find or create participant ────────────────────────────────────────────
      timer?.startStep('db_find_create_participant');
      let participantId: number;
      const participantResult = await payload.find({
        collection: 'participants',
        where: { phone: { equals: phone } },
        req: { transactionID } as unknown as PayloadRequest,
      });

      if (participantResult.docs.length > 0) {
        participantId = participantResult.docs[0].id;
      } else {
        const newParticipant = await payload.create({
          collection: 'participants',
          data: { name, phone },
          req: { transactionID } as unknown as PayloadRequest,
        });
        participantId = newParticipant.id;
      }
      timer?.endStep('db_find_create_participant');
      console.log(`[${requestId}] STEP 3 -> Participant Ready`);

      // ─── Lock and read the code (SELECT ... FOR UPDATE) ────────────────────────
      timer?.startStep('db_select_for_update_code');
      const codeResult = await tx.execute(sql`
        SELECT id, serial_code, is_winner, prize_id_id, claimed, claimed_at 
        FROM codes 
        WHERE serial_code = ${uppercaseSerial} 
        FOR UPDATE
      `);
      timer?.endStep('db_select_for_update_code');
      console.log(`[${requestId}] STEP 4 -> Code Locked`);

      if (codeResult.rows.length === 0) {
        // Code doesn't exist — log as INVALID
        timer?.startStep('db_create_entry');
        const entry = await payload.create({
          collection: 'entries',
          data: {
            participant: participantId,
            result: 'INVALID',
            ip,
            user_agent: userAgent,
            request_id: requestId,
          },
          req: { transactionID } as unknown as PayloadRequest,
        });
        timer?.endStep('db_create_entry');

        timer?.startStep('db_commit_transaction');
        await payload.db.commitTransaction(transactionID!);
        timer?.endStep('db_commit_transaction');

        return {
          success: true,
          result: 'INVALID',
          participantId,
          entryId: entry.id,
          message: 'The serial code does not exist in our database.',
        };
      }

      const codeRow = codeResult.rows[0] as unknown as CodeRow;

      // ─── Check if already claimed ──────────────────────────────────────────────
      if (codeRow.claimed) {
        timer?.startStep('db_create_entry');
        const entry = await payload.create({
          collection: 'entries',
          data: {
            participant: participantId,
            code: codeRow.id,
            result: 'ALREADY_USED',
            ip,
            user_agent: userAgent,
            request_id: requestId,
          },
          req: { transactionID } as unknown as PayloadRequest,
        });
        timer?.endStep('db_create_entry');

        timer?.startStep('db_commit_transaction');
        await payload.db.commitTransaction(transactionID!);
        timer?.endStep('db_commit_transaction');

        return {
          success: true,
          result: 'ALREADY_USED',
          participantId,
          entryId: entry.id,
          message: 'This serial code has already been redeemed.',
        };
      }

      // ─── Atomically claim the code ─────────────────────────────────────────────
      timer?.startStep('db_update_code_claim');
      const claimResult = await tx.execute(sql`
        UPDATE codes 
        SET claimed = true, claimed_at = NOW(), updated_at = NOW()
        WHERE id = ${codeRow.id} AND claimed = false
      `);
      timer?.endStep('db_update_code_claim');
      console.log(`[${requestId}] STEP 5 -> Code Updated`);

      if (claimResult.rowCount === 0) {
        timer?.startStep('db_create_entry');
        const entry = await payload.create({
          collection: 'entries',
          data: {
            participant: participantId,
            code: codeRow.id,
            result: 'ALREADY_USED',
            ip,
            user_agent: userAgent,
            request_id: requestId,
          },
          req: { transactionID } as unknown as PayloadRequest,
        });
        timer?.endStep('db_create_entry');

        timer?.startStep('db_commit_transaction');
        await payload.db.commitTransaction(transactionID!);
        timer?.endStep('db_commit_transaction');

        return {
          success: true,
          result: 'ALREADY_USED',
          participantId,
          entryId: entry.id,
          message: 'This serial code has already been redeemed.',
        };
      }

      // ─── Determine result ──────────────────────────────────────────────────────
      const isWinner = Boolean(codeRow.is_winner);
      let resultStatus: RedeemResultStatus = isWinner ? 'WIN' : 'LOSE';

      let prizeName = '';
      let prizeImageUrl = '';
      let verificationCode = '';

      // ─── Handle winner logic ───────────────────────────────────────────────────
      if (isWinner && codeRow.prize_id_id) {
        const prizeId = codeRow.prize_id_id;

        timer?.startStep('db_update_prize_decrement');
        const prizeResult = await tx.execute(sql`
          UPDATE prizes 
          SET quantity = quantity - 1, updated_at = NOW()
          WHERE id = ${prizeId} AND quantity > 0
          RETURNING id, name, quantity, image_id
        `);
        timer?.endStep('db_update_prize_decrement');

        if (prizeResult.rows.length === 0) {
          console.warn(
            `[REDEEM WARNING] Prize ${prizeId} exhausted. Code ${uppercaseSerial} downgraded to LOSE. RequestID: ${requestId}`
          );
          resultStatus = 'LOSE';
        } else {
          const prizeRow = prizeResult.rows[0] as unknown as PrizeRow;
          prizeName = prizeRow.name;

          // Get prize image URL if available
          if (prizeRow.image_id) {
            timer?.startStep('db_select_media');
            const imageResult = await tx.execute(sql`
              SELECT url FROM media WHERE id = ${prizeRow.image_id}
            `);
            timer?.endStep('db_select_media');
            if (imageResult.rows.length > 0) {
              const mediaRow = imageResult.rows[0] as unknown as MediaRow;
              prizeImageUrl = mediaRow.url || '';
            }
          }

          // Generate cryptographically secure verification code
          verificationCode = verificationService.generateVerificationCode();
        }
      }

      // ─── Create main entry record ──────────────────────────────────────────────
      timer?.startStep('db_create_entry');
      const entry = await payload.create({
        collection: 'entries',
        data: {
          participant: participantId,
          code: codeRow.id,
          result: resultStatus,
          ip,
          user_agent: userAgent,
          request_id: requestId,
        },
        req: { transactionID } as unknown as PayloadRequest,
      });
      timer?.endStep('db_create_entry');
      console.log(`[${requestId}] STEP 6 -> Entry Saved`);

      // ─── Create prize claim and queue WhatsApp notifications (winners only) ────────────────────
      timer?.startStep('db_create_claim_and_notifications');
      if (resultStatus === 'WIN' && verificationCode) {
        // Create prize claim record
        await payload.create({
          collection: 'prize-claims',
          data: {
            entry: entry.id,
            verification_code: verificationCode,
            status: 'PENDING',
            verified: false,
          },
          req: { transactionID } as unknown as PayloadRequest,
        });

        // Queue WhatsApp / SMS Notifications inside the same transaction
        // We skip SMS for "Spin The Wheel at the branch" to conserve SMS quota
        const isSpinTheWheel = codeRow.prize_id_id === 4 || prizeName.toLowerCase().includes('spin the wheel');

        if (process.env.DISABLE_NOTIFICATION_QUEUE !== 'true') {
          if (!isSpinTheWheel) {
            await notificationService.queueWinnerNotification({
              phone,
              participantName: name,
              serialCode: uppercaseSerial,
              prizeName,
              verificationCode,
              prizeImageUrl,
            }, transactionID as string);

            await notificationService.queueAdminAlert({
              participantName: name,
              participantPhone: phone,
              prizeName,
              serialCode: uppercaseSerial,
            }, transactionID as string);
          }
        }
      }
      timer?.endStep('db_create_claim_and_notifications');
      console.log(`[${requestId}] STEP 7 -> Claim Saved`);

      // ─── Commit transaction ────────────────────────────────────────────────────
      timer?.startStep('db_commit_transaction');
      await payload.db.commitTransaction(transactionID!);
      timer?.endStep('db_commit_transaction');
      console.log(`[${requestId}] STEP 8 -> Commit`);

      // ─── Send Admin Alert Email (Non-blocking, best-effort after commit) ──────
      if (resultStatus === 'WIN') {
        void alertEmailService.sendWinnerAlert({
          participantName: name,
          participantPhone: phone,
          prizeName,
          serialCode: uppercaseSerial,
          occurredAt: new Date(), // Using current timestamp when the win was finalized in database
        });
      }

      return {
        success: true,
        result: resultStatus,
        participantId,
        entryId: entry.id,
        prizeName: resultStatus === 'WIN' ? prizeName : undefined,
        prizeImageUrl: resultStatus === 'WIN' ? (prizeImageUrl || undefined) : undefined,
        verificationCode: resultStatus === 'WIN' ? verificationCode : undefined,
        message: resultStatus === 'WIN' ? 'Congratulations! You won a prize!' : 'Good luck next time!',
      };
    } catch (error: unknown) {
      // Rollback database writes
      timer?.startStep('db_rollback_transaction');
      await payload.db.rollbackTransaction(transactionID!);
      timer?.endStep('db_rollback_transaction');
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : '';
      console.log(`[${requestId}] REDEEM ERROR - Stage: Transaction - Error: ${errMsg}\nStack: ${errStack}`);
      return {
        success: false,
        result: 'INVALID',
        message: `An error occurred during code redemption: ${errMsg}`,
      };
    }
  }
}

export const redeemService = new RedeemService();
