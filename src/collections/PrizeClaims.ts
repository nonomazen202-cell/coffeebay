import type { CollectionConfig, CollectionAfterReadHook } from 'payload';
import { isAdmin, isAdminOrStaff, isFieldAdmin } from './access';

const populateClaimDetails: CollectionAfterReadHook = async ({ doc, req }) => {
  if (!doc.entry) return doc;

  try {
    let entryDoc = doc.entry;

    // If entry is not populated (it's just an ID)
    if (typeof entryDoc !== 'object') {
      entryDoc = await req.payload.findByID({
        collection: 'entries',
        id: entryDoc,
        depth: 2,
        req,
      });
    }

    if (entryDoc && typeof entryDoc === 'object') {
      // 1. Participant Details
      let participantDoc = entryDoc.participant;
      if (participantDoc) {
        if (typeof participantDoc !== 'object') {
          participantDoc = await req.payload.findByID({
            collection: 'participants',
            id: participantDoc,
            req,
          });
        }
        if (participantDoc && typeof participantDoc === 'object') {
          doc.participant_name = participantDoc.name;
          doc.participant_phone = participantDoc.phone;
        }
      }

      // 2. Serial Code Details
      let codeDoc = entryDoc.code;
      if (codeDoc) {
        if (typeof codeDoc !== 'object') {
          codeDoc = await req.payload.findByID({
            collection: 'codes',
            id: codeDoc,
            req,
          });
        }
        if (codeDoc && typeof codeDoc === 'object') {
          doc.serial_code = codeDoc.serial_code;
        }
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
    read: isAdminOrStaff,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
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
