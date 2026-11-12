import type { CollectionConfig } from 'payload';
import { isLuckyCupAdminAccess } from './access';
import { hasLuckyCupAdminAccess } from '../lib/security/roles';

export const Prizes: CollectionConfig = {
  slug: 'prizes',
  timestamps: true,
  access: {
    read: isLuckyCupAdminAccess,
    create: isLuckyCupAdminAccess,
    update: isLuckyCupAdminAccess,
    delete: isLuckyCupAdminAccess,
  },
  admin: {
    group: 'Lucky Cup / مسابقة أكواب الحظ',
    hidden: ({ user }) => !hasLuckyCupAdminAccess(user),
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
