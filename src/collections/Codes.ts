import type { CollectionConfig } from 'payload';
import { isAdmin } from './access';

export const Codes: CollectionConfig = {
  slug: 'codes',
  timestamps: true,
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    hidden: ({ user }) => user?.role !== 'ADMIN',
    useAsTitle: 'serial_code',
    defaultColumns: ['serial_code', 'is_winner', 'claimed', 'claimed_at'],
    components: {
      views: {
        list: {
          Component: '@/components/admin/views/CustomListCodes#CustomListCodes',
        },
      },
    },
  },
  fields: [
    {
      name: 'serial_code',
      type: 'text',
      required: true,
      unique: true, // Automatically registers unique index
      index: true,
    },
    {
      name: 'is_winner',
      type: 'checkbox',
      required: true,
      defaultValue: false,
      index: true,
    },
    {
      name: 'prize_id',
      type: 'relationship',
      relationTo: 'prizes',
      index: true,
    },
    {
      name: 'claimed',
      type: 'checkbox',
      required: true,
      defaultValue: false,
      index: true,
    },
    {
      name: 'claimed_at',
      type: 'date',
    },
  ],
};
