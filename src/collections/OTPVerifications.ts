import type { CollectionConfig } from 'payload';
import { isAdmin } from './access';

export const OTPVerifications: CollectionConfig = {
  slug: 'otp-verifications',
  timestamps: true,
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
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
