'use server';

import { getPayload, type Payload } from 'payload';
import config from '@payload-config';
import { headers } from 'next/headers';

/**
 * Checks if the given IDs are referenced by critical fields in other collections.
 */
async function checkReferences(
  payload: Payload,
  collection: keyof Payload['collections'],
  ids: (string | number)[]
) {
  const referencesMap: Record<string | number, string[]> = {};

  for (const id of ids) {
    const reasons: string[] = [];

    if (collection === 'participants') {
      // Check if referenced by entries
      const entries = await payload.find({
        collection: 'entries',
        where: {
          participant: {
            equals: id,
          },
        },
        overrideAccess: true,
        limit: 1,
      });
      if (entries.docs && entries.docs.length > 0) {
        reasons.push(`scan entries / محاولات مشاركة (Total: ${entries.totalDocs})`);
      }
    }

    if (collection === 'prizes') {
      // Check if referenced by codes
      const codes = await payload.find({
        collection: 'codes',
        where: {
          prizeId: {
            equals: id,
          },
        },
        overrideAccess: true,
        limit: 1,
      });
      if (codes.docs && codes.docs.length > 0) {
        reasons.push(`serial codes / أكواد حملة (Total: ${codes.totalDocs})`);
      }
    }

    if (collection === 'codes') {
      // Check if referenced by entries
      const entries = await payload.find({
        collection: 'entries',
        where: {
          code: {
            equals: id,
          },
        },
        overrideAccess: true,
        limit: 1,
      });
      if (entries.docs && entries.docs.length > 0) {
        reasons.push(`scan entries / محاولات مشاركة (Total: ${entries.totalDocs})`);
      }
    }

    if (collection === 'entries') {
      // Check if referenced by prize-claims
      const claims = await payload.find({
        collection: 'prize-claims',
        where: {
          entry: {
            equals: id,
          },
        },
        overrideAccess: true,
        limit: 1,
      });
      if (claims.docs && claims.docs.length > 0) {
        reasons.push(`prize claims / طلبات استلام (Total: ${claims.totalDocs})`);
      }
    }

    if (reasons.length > 0) {
      referencesMap[id] = reasons;
    }
  }

  return referencesMap;
}

export async function bulkDeleteAction(collection: string, ids: (string | number)[]) {
  try {
    const payload = await getPayload({ config });

    // Authenticate user context via request headers
    const authResult = await payload.auth({
      headers: await headers(),
    });

    const payloadUser = authResult?.user;
    if (!payloadUser || payloadUser.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized. Only Admins can perform bulk deletion.' };
    }

    // Safely cast string type parameter to matching collection keys in Payload
    const targetCollection = collection as keyof Payload['collections'];

    // PostgreSQL uses integer primary keys. If IDs are strings, cast them to numbers.
    const normalizedIds = ids.map(id => {
      if (typeof id === 'string') {
        const parsed = Number(id);
        return isNaN(parsed) ? id : parsed;
      }
      return id;
    });

    console.log(`[bulkDeleteAction] Checking references in "${collection}" for IDs:`, normalizedIds);

    // 1. Check database relations to prevent breaking database integrity
    const references = await checkReferences(payload, targetCollection, normalizedIds);
    const hasReferences = Object.keys(references).length > 0;

    if (hasReferences) {
      const details = Object.entries(references)
        .map(([id, reasons]) => `ID ${id} is linked to: ${reasons.join(', ')}`)
        .join('\n');

      return {
        success: false,
        hasReferences: true,
        references,
        error: `Cannot delete items because they are linked to other active records:\n${details}\nPlease delete those linked records first.`
      };
    }

    console.log(`[bulkDeleteAction] No constraints found. Deleting in "${collection}"...`);

    // 2. Perform bulk delete using Local API with overrideAccess since we verified permissions & relationships manually
    const result = await payload.delete({
      collection: targetCollection,
      where: {
        id: {
          in: normalizedIds,
        },
      },
      overrideAccess: true,
    });

    const deletedCount = result?.docs?.length ?? 0;
    console.log(`[bulkDeleteAction] Successfully deleted ${deletedCount} documents from "${collection}".`);

    return { success: true, count: deletedCount };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to delete items.';
    console.error(`Error in bulk delete for collection ${collection}:`, err);
    return { success: false, error: errorMsg };
  }
}
