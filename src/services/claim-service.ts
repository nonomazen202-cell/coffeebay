import { type PayloadRequest } from 'payload';
import { getPayloadClient } from '../lib/payload';
import type { PrizeClaim } from '@/payload-types';

export interface ClaimDetails {
  claimId: string;
  verificationCode: string;
  status: 'PENDING' | 'DELIVERED' | 'CANCELLED';
  prizeName: string;
  participantName: string;
  participantPhone: string;
  claimedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface DeliveryRequest {
  verificationCode: string;
  staffUserId: string;
}

export interface ClaimServiceResult {
  success: boolean;
  message?: string;
  claim?: ClaimDetails;
}

export class ClaimService {
  /**
   * Safely maps the Payload document graph into a structured ClaimDetails object.
   */
  private mapToDetails(claimDoc: PrizeClaim): ClaimDetails | null {
    if (!claimDoc) return null;

    const entry = claimDoc.entry;
    if (!entry || typeof entry !== 'object') return null;

    const participant = entry.participant;
    if (!participant || typeof participant !== 'object') return null;

    const code = entry.code;
    if (!code || typeof code !== 'object') return null;

    const prize = code.prize_id;
    if (!prize || typeof prize !== 'object') return null;

    return {
      claimId: String(claimDoc.id),
      verificationCode: claimDoc.verification_code,
      status: claimDoc.status,
      prizeName: prize.name,
      participantName: participant.name,
      participantPhone: participant.phone,
      claimedAt: entry.createdAt || claimDoc.createdAt,
      verifiedAt: claimDoc.verified_at || undefined,
      verifiedBy: claimDoc.verified_by && typeof claimDoc.verified_by === 'object' && 'id' in claimDoc.verified_by ? String(claimDoc.verified_by.id) : (claimDoc.verified_by ? String(claimDoc.verified_by) : undefined),
    };
  }

  /**
   * Searches for a prize claim using its verification code.
   */
  async getClaimDetails(verificationCode: string): Promise<ClaimDetails | null> {
    if (!verificationCode) return null;

    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: 'prize-claims',
      where: { verification_code: { equals: verificationCode.toUpperCase() } },
      depth: 3, // Ensures entry -> code -> prize is fully populated
    });

    if (result.docs.length === 0) {
      return null;
    }

    return this.mapToDetails(result.docs[0]);
  }

  /**
   * Executes the verification transaction, updating status to DELIVERED.
   */
  async deliverPrize(request: DeliveryRequest): Promise<ClaimServiceResult> {
    const { verificationCode, staffUserId } = request;

    if (!verificationCode) {
      return { success: false, message: 'Verification code is required' };
    }
    if (!staffUserId) {
      return { success: false, message: 'Staff user ID is required' };
    }

    const uppercaseCode = verificationCode.toUpperCase();
    const payload = await getPayloadClient();

    // Begin transaction
    const transactionID = await payload.db.beginTransaction();

    try {
      const claimResult = await payload.find({
        collection: 'prize-claims',
        where: { verification_code: { equals: uppercaseCode } },
        depth: 3,
        req: { transactionID } as unknown as PayloadRequest,
      });

      if (claimResult.docs.length === 0) {
        await payload.db.rollbackTransaction(transactionID!);
        return { success: false, message: 'Claim verification code not found' };
      }

      const claimDoc = claimResult.docs[0];

      if (claimDoc.status !== 'PENDING') {
        await payload.db.rollbackTransaction(transactionID!);
        return {
          success: false,
          message: `This claim has already been processed with status: ${claimDoc.status}`,
        };
      }

      // Update claim status to DELIVERED
      const updatedClaim = await payload.update({
        collection: 'prize-claims',
        id: claimDoc.id,
        data: {
          status: 'DELIVERED',
          verified: true,
          verified_by: Number(staffUserId),
          verified_at: new Date().toISOString(),
        },
        depth: 3,
        req: { transactionID } as unknown as PayloadRequest,
      });

      // Commit transaction
      await payload.db.commitTransaction(transactionID!);

      const mappedDetails = this.mapToDetails(updatedClaim);

      return {
        success: true,
        message: 'Prize delivered successfully!',
        claim: mappedDetails || undefined,
      };
    } catch (error: unknown) {
      await payload.db.rollbackTransaction(transactionID!);
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to deliver prize: ${errMsg}`,
      };
    }
  }

  /**
   * Cancels a pending claim, updating status to CANCELLED.
   */
  async cancelClaim(verificationCode: string, staffUserId: string): Promise<ClaimServiceResult> {
    if (!verificationCode) {
      return { success: false, message: 'Verification code is required' };
    }
    if (!staffUserId) {
      return { success: false, message: 'Staff user ID is required' };
    }

    const uppercaseCode = verificationCode.toUpperCase();
    const payload = await getPayloadClient();

    // Begin transaction
    const transactionID = await payload.db.beginTransaction();

    try {
      const claimResult = await payload.find({
        collection: 'prize-claims',
        where: { verification_code: { equals: uppercaseCode } },
        depth: 3,
        req: { transactionID } as unknown as PayloadRequest,
      });

      if (claimResult.docs.length === 0) {
        await payload.db.rollbackTransaction(transactionID!);
        return { success: false, message: 'Claim verification code not found' };
      }

      const claimDoc = claimResult.docs[0];

      if (claimDoc.status !== 'PENDING') {
        await payload.db.rollbackTransaction(transactionID!);
        return {
          success: false,
          message: `Only PENDING claims can be cancelled. Current status: ${claimDoc.status}`,
        };
      }

      // Update claim status to CANCELLED
      const updatedClaim = await payload.update({
        collection: 'prize-claims',
        id: claimDoc.id,
        data: {
          status: 'CANCELLED',
          verified: false,
          verified_by: Number(staffUserId),
          verified_at: new Date().toISOString(),
        },
        depth: 3,
        req: { transactionID } as unknown as PayloadRequest,
      });

      // Commit transaction
      await payload.db.commitTransaction(transactionID!);

      const mappedDetails = this.mapToDetails(updatedClaim);

      return {
        success: true,
        message: 'Claim cancelled successfully!',
        claim: mappedDetails || undefined,
      };
    } catch (error: unknown) {
      await payload.db.rollbackTransaction(transactionID!);
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to cancel claim: ${errMsg}`,
      };
    }
  }
}

export const claimService = new ClaimService();
