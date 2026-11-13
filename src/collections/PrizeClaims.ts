import type { CollectionConfig, CollectionAfterReadHook } from 'payload';
import { sql } from 'drizzle-orm';
import { isLuckyCupAdminAccess, isLuckyCupStaffOrAdminAccess, isFieldAdmin } from './access';
import { hasLuckyCupAccess } from '../lib/security/roles';

const populateClaimDetails: CollectionAfterReadHook = async ({ doc, req, findMany }) => {
  if (!doc.entry) return doc;

  // When Payload's internal renderListView executes its unused depth=0 list query
  // (before CustomListClaims runs its own depth=3 query), skip per-row N+1 queries!
  if (findMany && typeof doc.entry !== 'object' && !req?.url?.includes('/api/')) {
    return doc;
  }

  try {
    const entryDoc = doc.entry;

    if (typeof entryDoc === 'object' && entryDoc !== null) {
      const participantDoc = entryDoc.participant;
      if (participantDoc && typeof participantDoc === 'object') {
        doc.participant_name = participantDoc.name;
        doc.participant_phone = participantDoc.phone;
      }
      const codeDoc = entryDoc.code;
      if (codeDoc && typeof codeDoc === 'object') {
        doc.serial_code = codeDoc.serial_code;
      }
      if (doc.participant_name || doc.serial_code) {
        return doc;
      }
    }

    // Single SQL JOIN fallback instead of 3 sequential Payload ORM findByID round-trips
    const entryId = typeof entryDoc === 'object' ? entryDoc?.id : entryDoc;
    if (entryId && req?.payload?.db?.drizzle) {
      const res = await req.payload.db.drizzle.execute(sql`
        SELECT
          p.name AS participant_name,
          p.phone AS participant_phone,
          c.serial_code AS serial_code
        FROM entries e
        LEFT JOIN participants p ON e.participant_id = p.id
        LEFT JOIN codes c ON e.code_id = c.id
        WHERE e.id = ${Number(entryId)}
        LIMIT 1;
      `);
      const rows = Array.isArray(res)
        ? res
        : (res as { rows?: unknown[] }).rows || [];
      if (rows.length > 0) {
        const row = rows[0] as {
          participant_name?: string;
          participant_phone?: string;
          serial_code?: string;
        };
        if (row.participant_name) doc.participant_name = row.participant_name;
        if (row.participant_phone) doc.participant_phone = row.participant_phone;
        if (row.serial_code) doc.serial_code = row.serial_code;
      }
    }
  } catch (err) {
    req.payload.logger.error(`Error populating claim details for claim ${doc.id}: ${err}`);
  }

  return doc;
};

export const PrizeClaims: CollectionConfig = {
  slug: 'prize-claims',
  timestamps: true,
  hooks: {
    afterRead: [populateClaimDetails],
  },
  access: {
    read: isLuckyCupStaffOrAdminAccess,
    create: isLuckyCupAdminAccess,
    update: isLuckyCupStaffOrAdminAccess,
    delete: isLuckyCupAdminAccess,
  },
  admin: {
    group: 'Lucky Cup / مسابقة أكواب الحظ',
    hidden: ({ user }) => !hasLuckyCupAccess(user),
    useAsTitle: 'verification_code',
    defaultColumns: ['verification_code', 'participant_name', 'participant_phone', 'status', 'verified', 'verified_at'],
    components: {
      views: {
        list: {
          Component: '@/components/admin/views/CustomListClaims#CustomListClaims',
        },
      },
    },
  },
  fields: [
    {
      name: 'entry',
      type: 'relationship',
      relationTo: 'entries',
      required: true,
      unique: true, // Ensuring One-to-One entry-to-claim mapping
      access: {
        update: isFieldAdmin, // STAFF cannot change the associated entry
      },
    },
    {
      name: 'participant_name',
      type: 'text',
      virtual: true,
      label: 'Participant Name',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'participant_phone',
      type: 'text',
      virtual: true,
      label: 'Participant Phone',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'serial_code',
      type: 'text',
      virtual: true,
      label: 'Serial Code',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'verification_code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      access: {
        update: isFieldAdmin, // STAFF cannot change the verification code
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'PENDING',
      options: [
        { label: 'Pending', value: 'PENDING' },
        { label: 'Delivered', value: 'DELIVERED' },
        { label: 'Cancelled', value: 'CANCELLED' },
      ],
    },
    {
      name: 'verified',
      type: 'checkbox',
      required: true,
      index: true,
      defaultValue: false,
    },
    {
      name: 'verified_by',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'verified_at',
      type: 'date',
    },
  ],
};
