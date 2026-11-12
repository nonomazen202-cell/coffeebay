import type { CollectionConfig } from 'payload';
import { isPromotionsAdminAccess } from '../access';
import { hasPromotionsAdminAccess } from '../../lib/security/roles';

export const DrinkOtpChallenges: CollectionConfig = {
  slug: 'drink-otp-challenges',
  timestamps: true,
  admin: {
    hidden: ({ user }) => !hasPromotionsAdminAccess(user),
    group: 'Promotions / الحملات والعروض الترويجية',
    useAsTitle: 'phone',
    defaultColumns: ['phone', 'code', 'campaign', 'attempts', 'expires_at', 'used_at', 'verified_at'],
    description: 'Phone verification challenges and OTP codes for promotional drink reward claiming.',
  },
  access: {
    read: isPromotionsAdminAccess,
    create: isPromotionsAdminAccess,
    update: isPromotionsAdminAccess,
    delete: isPromotionsAdminAccess,
  },
  fields: [
    {
      name: 'phone',
      type: 'text',
      required: true,
      index: true,
      label: 'Normalized Phone (E.164)',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'campaign',
      type: 'relationship',
      relationTo: 'drink-campaigns',
      required: true,
      index: true,
      label: 'Target Campaign',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'code',
      type: 'text',
      required: true,
      label: 'Verification Code (OTP)',
      admin: {
        description: '6-digit OTP code sent to the customer.',
        readOnly: true,
      },
    },
    {
      name: 'expires_at',
      type: 'date',
      required: true,
      index: true,
      label: 'Expires At (5 min window)',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'last_sent_at',
      type: 'date',
      required: true,
      label: 'Last Sent Timestamp',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'attempts',
      type: 'number',
      required: true,
      defaultValue: 0,
      label: 'Failed Verification Attempts',
      admin: {
        description: 'Auto-incremented on incorrect OTP entry. Challenge invalidates upon reaching 3 attempts.',
      },
    },
    {
      name: 'verified_at',
      type: 'date',
      label: 'Verified Timestamp',
      admin: {
        description: 'Set when the customer successfully inputs the correct code.',
      },
    },
    {
      name: 'used_at',
      type: 'date',
      label: 'Used / Consumed Timestamp',
      admin: {
        description: 'Set when the verified challenge is consumed during entitlement voucher issuance (one-time use).',
      },
    },
  ],
};
