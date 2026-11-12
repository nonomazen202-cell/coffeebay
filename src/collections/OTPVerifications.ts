import type { CollectionConfig } from 'payload';
import { isLuckyCupAdminAccess } from './access';
import { hasLuckyCupAdminAccess } from '../lib/security/roles';

export const OTPVerifications: CollectionConfig = {
  slug: 'otp-verifications',
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
    useAsTitle: 'phone',
    defaultColumns: ['phone', 'code', 'used', 'expiresAt', 'lastSentAt', 'createdAt'],
  },
  fields: [
    {
      name: 'phone',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'code',
      type: 'text',
      required: true,
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
      index: true,
    },
    {
      name: 'used',
      type: 'checkbox',
      defaultValue: false,
      index: true,
    },
    {
      name: 'usedAt',
      type: 'date',
    },
    {
      name: 'lastSentAt',
      type: 'date',
      required: true,
    },
    {
      name: 'attempts',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'ip',
      type: 'text',
    },
  ],
};
