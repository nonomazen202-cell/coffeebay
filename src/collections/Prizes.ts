import type { CollectionConfig } from 'payload';
import { isAdmin } from './access';

export const Prizes: CollectionConfig = {
  slug: 'prizes',
  timestamps: true,
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    hidden: ({ user }) => user?.role !== 'ADMIN',
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
    {
      name: 'winner_notification_enabled',
      type: 'checkbox',
      label: 'Winner Notification Enabled',
      required: true,
      defaultValue: true,
      admin: {
        description: 'Toggle whether to send winner SMS/WhatsApp notification when this prize is won. Default is true.',
      },
    },
  ],
};
