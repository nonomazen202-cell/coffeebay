import { type Payload } from 'payload';
import { headers } from 'next/headers';
import { BULK_EDIT_REGISTRY } from '../config/registry';
import type { User } from '@/payload-types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedIds?: (string | number)[];
  sanitizedData?: Record<string, unknown>;
  user?: User;
}

/**
 * Validates and sanitizes a bulk edit request through a strict multi-layer pipeline:
 * 1. Authentication & Authorization check (Admin role check)
 * 2. Collection whitelist verification
 * 3. Batch size limits check
 * 4. Fields whitelist sanitization
 * 5. Type and domain validation
 * 6. DB relationship existence checks
 */
export async function validateBulkEdit(
  payload: Payload,
  collectionSlug: string,
  ids: (string | number)[],
  patch: Record<string, unknown>
): Promise<ValidationResult> {
  // 1. Authentication & Authorization Check
  const authResult = await payload.auth({
    headers: await headers(),
  });
  
  const user = authResult?.user;
  if (!user || user.role !== 'ADMIN') {
    return {
      valid: false,
      error: 'Unauthorized. Only Administrators can perform bulk modifications.',
    };
  }

  // 2. Collection Whitelist Verification
  const collectionConfig = BULK_EDIT_REGISTRY[collectionSlug];
  if (!collectionConfig) {
    return {
      valid: false,
      error: `Collection "${collectionSlug}" is not registered or allowed for bulk editing.`,
    };
  }

  // 3. Batch Size Limit Guard
  const maxLimit = collectionConfig.maxLimit ?? 100;
  
  // Normalize and deduplicate IDs
  const uniqueIds = Array.from(new Set(ids)).map((id) => {
    if (typeof id === 'string') {
      const parsed = Number(id);
      return isNaN(parsed) ? id : parsed;
    }
    return id;
  });

  if (uniqueIds.length === 0) {
    return {
      valid: false,
      error: 'No target record IDs provided for the bulk update operation.',
    };
  }

  if (uniqueIds.length > maxLimit) {
    return {
      valid: false,
      error: `Batch size limit exceeded. Maximum allowed is ${maxLimit} records. Requested: ${uniqueIds.length} records.`,
    };
  }

  // 4. Fields Whitelist & Sanitization
  const sanitizedData: Record<string, unknown> = {};
  const allowedFields = collectionConfig.allowedFields;
  const inputKeys = Object.keys(patch);

  if (inputKeys.length === 0) {
    return {
      valid: false,
      error: 'No field update payload provided for the bulk edit operation.',
    };
  }

  for (const key of inputKeys) {
    const fieldSchema = allowedFields[key];
    if (!fieldSchema) {
      // Ignore/strip keys that are not whitelisted for bulk edit
      console.warn(`[Bulk Edit Validation] Stripping disallowed field key: "${key}"`);
      continue;
    }

    const rawValue = patch[key];

    // 5. Type and Domain Validation
    const isTypeValid = await fieldSchema.validate(rawValue);
    if (!isTypeValid) {
      return {
        valid: false,
        error: `Invalid value type or validation failure for field "${key}". Value: ${JSON.stringify(rawValue)}`,
      };
    }

    // 6. DB Relationship Existence Checks
    if (fieldSchema.type === 'relationship' && rawValue !== null && rawValue !== undefined) {
      if (!fieldSchema.relationTo) {
        return {
          valid: false,
          error: `Infrastructure Error: Field "${key}" of type relationship is missing relationTo configuration.`,
        };
      }

      try {
        const relatedDoc = await payload.findByID({
          collection: fieldSchema.relationTo as keyof Payload['collections'],
          id: rawValue as string | number,
          depth: 0,
        });

        if (!relatedDoc) {
          return {
            valid: false,
            error: `Relationship integrity validation failed: The referenced record with ID ${rawValue} in collection "${fieldSchema.relationTo}" does not exist.`,
          };
        }
      } catch (err) {
        console.error(`[Bulk Edit Validation] Error looking up relationship ID ${rawValue} in "${fieldSchema.relationTo}":`, err);
        return {
          valid: false,
          error: `Database relationship lookup failed for ID ${rawValue} in collection "${fieldSchema.relationTo}".`,
        };
      }
    }

    sanitizedData[key] = rawValue;
  }

  if (Object.keys(sanitizedData).length === 0) {
    return {
      valid: false,
      error: 'No valid whitelisted fields remained after security sanitization.',
    };
  }

  return {
    valid: true,
    sanitizedIds: uniqueIds,
    sanitizedData,
    user,
  };
}
