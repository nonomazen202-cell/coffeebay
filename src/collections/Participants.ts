import type { CollectionConfig } from 'payload';
import { isAdmin } from './access';

export const Participants: CollectionConfig = {
  slug: 'participants',
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
    defaultColumns: ['name', 'phone'],
    components: {
      beforeListTable: [
        '@/components/admin/ExportButton#ExportButton',
      ],
      views: {
        list: {
          Component: '@/components/admin/views/CustomListParticipants#CustomListParticipants',
        },
      },
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
      unique: true, // Automatically registers unique index
      index: true,
    },
    {
      name: 'verified',
      type: 'checkbox',
      defaultValue: false,
      index: true,
    },
    {
      name: 'verifiedAt',
      type: 'date',
    },
    {
      name: 'verificationMethod',
      type: 'select',
      options: [
        { label: 'WhatsApp OTP', value: 'otp_whatsapp' },
        { label: 'SMS', value: 'sms' },
        { label: 'Manual/Admin Override', value: 'manual' },
      ],
    },
    {
      name: 'blocked',
      type: 'checkbox',
      defaultValue: false,
      index: true,
    },
    {
      name: 'blockedReason',
      type: 'text',
    },
  ],
};
