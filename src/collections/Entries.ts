import type { CollectionConfig, PayloadRequest, Where } from 'payload';
import { isAdmin, isAdminOrStaff } from './access';

async function transformWhere(where: Where | undefined, req: PayloadRequest): Promise<Where | undefined> {
  if (!where || typeof where !== 'object') {
    return where;
  }

  // Handle arrays (e.g., inside 'or' or 'and' arrays)
  if (Array.isArray(where)) {
    const transformed = await Promise.all(
      where.map((item) => transformWhere(item as Where, req))
    );
    return transformed as unknown as Where;
  }

  const result: Record<string, unknown> = {};

  for (const key of Object.keys(where)) {
    const value = (where as Record<string, unknown>)[key];

    // Check if the current key is 'participant'
    if (key === 'participant' && value && typeof value === 'object') {
      // It is queried via an object, e.g., { equals: '...' } or { like: '...' }
      // We look for any string search value
      const operators = Object.keys(value);
      let searchString: string | null = null;

      for (const op of operators) {
        const opValue = (value as Record<string, unknown>)[op];
        if (typeof opValue === 'string') {
          // If the search query is NOT a number, it means they typed a name/email/phone
          const parsed = Number(opValue);
          if (isNaN(parsed)) {
            searchString = opValue;
            break;
          }
        }
      }

      if (searchString !== null) {
        try {
          // Look up matching participants by name, email, or phone
          const matchingParticipants = await req.payload.find({
            collection: 'participants',
            where: {
              or: [
                { name: { like: searchString } },
                { phone: { like: searchString } },
              ],
            },
            limit: 100,
            req,
          });

          const matchingIds = matchingParticipants.docs.map((doc) => doc.id);

          if (matchingIds.length > 0) {
            // Replace with 'in' operator to match any of the found participant IDs
            result[key] = { in: matchingIds };
          } else {
            // If no matching participants, we must ensure zero results are returned.
            // Using { in: [-1] } guarantees no match since IDs in Payload/PostgreSQL are positive integers.
            result[key] = { in: [-1] };
          }
        } catch (error) {
          req.payload.logger.error(`Error filtering participants by search string in beforeOperation hook: ${error}`);
          result[key] = value;
        }
      } else {
        result[key] = value;
      }
    } else if (key === 'and' || key === 'or') {
      result[key] = await transformWhere(value as Where, req);
    } else if (value && typeof value === 'object') {
      result[key] = await transformWhere(value as Where, req);
    } else {
      result[key] = value;
    }
  }

  return result as Where;
}

export const Entries: CollectionConfig = {
  slug: 'entries',
  timestamps: true,
  hooks: {
    beforeOperation: [
      async ({ args, operation, req }) => {
        if ((operation === 'read' || operation === 'find') && args) {
          const typedArgs = args as { where?: Where };
          if (typedArgs.where) {
            typedArgs.where = await transformWhere(typedArgs.where, req);
          }
        }
        return args;
      },
    ],
  },
  access: {
    read: isAdminOrStaff,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['participant', 'code', 'result', 'createdAt'],
    listSearchableFields: ['participant', 'ip', 'request_id'],
    components: {
      views: {
        list: {
          Component: '@/components/admin/views/CustomListEntries#CustomListEntries',
        },
      },
    },
  },
  fields: [
    {
      name: 'participant',
      type: 'relationship',
      relationTo: 'participants',
      required: true,
      index: true,
    },
    {
      name: 'code',
      type: 'relationship',
      relationTo: 'codes',
      index: true,
    },
    {
      name: 'result',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Win', value: 'WIN' },
        { label: 'Lose', value: 'LOSE' },
        { label: 'Invalid Code', value: 'INVALID' },
        { label: 'Already Used', value: 'ALREADY_USED' },
      ],
    },
    {
      name: 'ip',
      type: 'text',
    },
    {
      name: 'user_agent',
      type: 'text',
    },
    {
      name: 'request_id',
      type: 'text',
      index: true,
    },
  ],
};
