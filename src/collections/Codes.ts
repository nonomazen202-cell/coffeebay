import type { CollectionConfig } from 'payload';
import { isAdmin, isAdminOrStaff } from './access';

export const Codes: CollectionConfig = {
  slug: 'codes',
  timestamps: true,
  access: {
    read: isAdminOrStaff,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
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
