import type { CollectionConfig } from 'payload';
import { isAdmin, isAdminOrStaff } from './access';

export const Prizes: CollectionConfig = {
  slug: 'prizes',
  timestamps: true,
  access: {
    read: isAdminOrStaff,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'quantity', 'active'],
    components: {
      views: {
        list: {
          Component: '@/components/admin/views/CustomListPrizes#CustomListPrizes',
        },
      },
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'quantity',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'image',
      type: 'relationship',
      relationTo: 'media',
    },
    {
      name: 'active',
      type: 'checkbox',
      required: true,
      defaultValue: true,
    },
  ],
};
