'use server';

import { getPayload, type Payload } from 'payload';
import config from '@payload-config';
import { validateBulkEdit } from '../validation/validate';

export interface BulkUpdateResponse {
  success: boolean;
  count?: number;
  error?: string;
}

/**
 * Reusable Server Action to perform authenticated bulk edits.
 * Runs through validation whitelists and relationship constraints.
 * Leverages Payload's Local API to ensure collection hooks (beforeChange/afterChange) execute correctly.
 */
export async function bulkUpdateAction(
  collection: string,
  ids: (string | number)[],
  patch: Record<string, unknown>
): Promise<BulkUpdateResponse> {
  console.log(`[bulkUpdateAction] Starting bulk update for collection "${collection}" on ${ids.length} records...`);

  try {
    const payload = await getPayload({ config });

    // 1. Execute Multi-Layer Validation Pipeline (passing shared payload instance)
    const validation = await validateBulkEdit(payload, collection, ids, patch);
    
    if (!validation.valid || !validation.sanitizedIds || !validation.sanitizedData) {
      console.warn(`[bulkUpdateAction] Validation failed for collection "${collection}":`, validation.error);
      return {
        success: false,
        error: validation.error || 'Validation failed.',
      };
    }

    const { sanitizedIds, sanitizedData, user } = validation;
    
    console.log(`[bulkUpdateAction] Validation passed. Updating IDs:`, sanitizedIds, `with data:`, sanitizedData);

    // 2. Perform Bulk Update using Local API
    // Runs inside the user's role-based access context (no overrideAccess: true bypass)
    const result = await payload.update({
      collection: collection as keyof Payload['collections'],
      where: {
        id: {
          in: sanitizedIds,
        },
      },
      data: sanitizedData,
      user: user, // Pass the authenticated user to evaluate collection access controls naturally
    });

    const updatedCount = result?.docs?.length ?? 0;
    console.log(`[bulkUpdateAction] Successfully updated ${updatedCount} records in collection "${collection}".`);

    // 3. Return summary counts (avoid serializing large document payloads back to client)
    return {
      success: true,
      count: updatedCount,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'An unexpected database error occurred.';
    console.error(`[bulkUpdateAction] Failed executing bulk update in "${collection}":`, err);
    return {
      success: false,
      error: errorMsg,
    };
  }
}
