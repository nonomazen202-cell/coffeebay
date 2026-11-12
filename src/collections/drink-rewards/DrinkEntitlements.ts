import type { CollectionConfig } from 'payload';
import { isPromotionsAdminAccess } from '../access';
import { hasPromotionsAdminAccess } from '../../lib/security/roles';

export const DrinkEntitlements: CollectionConfig = {
  slug: 'drink-entitlements',
  timestamps: true,
  admin: {
    hidden: ({ user }) => !hasPromotionsAdminAccess(user),
    group: 'Promotions / الحملات والعروض الترويجية',
    useAsTitle: 'voucher_code',
    defaultColumns: ['voucher_code', 'customer_name', 'phone', 'selected_drink', 'status', 'branch', 'redeemed_at'],
    description: 'Vouchers and redemption records for complimentary drinks claimed by customers.',
    components: {
      views: {
        list: {
          Component: '@/components/admin/views/CustomListDrinkVouchers#CustomListDrinkVouchers',
        },
      },
    },
  },
  access: {
    read: isPromotionsAdminAccess,
    create: isPromotionsAdminAccess,
    update: isPromotionsAdminAccess,
    delete: isPromotionsAdminAccess,
  },
  fields: [
    {
      name: 'voucher_code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Voucher Code',
      admin: {
        description: 'Unique cryptographically secure redemption code (e.g. CB-XXXXXX).',
      },
    },
    {
      name: 'campaign',
      type: 'relationship',
      relationTo: 'drink-campaigns',
      required: true,
      index: true,
      label: 'Campaign',
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
      index: true,
      label: 'Customer Phone (E.164)',
    },
    {
      name: 'customer_name',
      type: 'text',
      required: false,
      label: 'Customer Full Name',
    },
    {
      name: 'selected_drink',
      type: 'relationship',
      relationTo: 'drinks',
      required: true,
      index: true,
      label: 'Customer Selected Beverage',
      admin: {
        description: 'The beverage selected by the customer on the website at time of claiming.',
      },
    },
    {
      name: 'redeemed_drink',
      type: 'relationship',
      relationTo: 'drinks',
      index: true,
      label: 'Actually Served Beverage',
      admin: {
        description: 'The beverage actually prepared and handed over by the barista at the branch.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'ISSUED',
      index: true,
      options: [
        { label: 'Issued (Ready to Redeem)', value: 'ISSUED' },
        { label: 'Redeemed (Served at Branch)', value: 'REDEEMED' },
        { label: 'Expired (Past Campaign End)', value: 'EXPIRED' },
        { label: 'Cancelled (Administrative)', value: 'CANCELLED' },
      ],
      label: 'Voucher Status',
    },
    {
      name: 'reclaim_allowed',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      label: 'Allow Extra Claim (منح مطالبة إضافية لهذا العميل)',
      admin: {
        description: 'When enabled, grants this customer permission to claim another drink regardless of campaign limits.',
      },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      index: true,
      label: 'Redemption Branch',
      admin: {
        description: 'Physical branch where this voucher was processed and served.',
      },
    },
    {
      name: 'cashier',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      label: 'Staff Member / Cashier',
      admin: {
        description: 'Staff member who authenticated and processed the redemption.',
      },
    },
    {
      name: 'change_reason',
      type: 'text',
      label: 'Substitution Reason',
      admin: {
        description: 'Mandatory explanation if the actually served drink differs from customer preferred choice.',
      },
    },
    {
      name: 'allowed_drinks_snapshot',
      type: 'json',
      label: 'Allowed Drinks Snapshot at Issuance',
      admin: {
        description: 'Historical snapshot of drink IDs eligible at the exact time this voucher was issued, protecting customer rights against subsequent campaign edits.',
      },
    },
    {
      name: 'issued_at',
      type: 'date',
      required: true,
      label: 'Issued At',
    },
    {
      name: 'redeemed_at',
      type: 'date',
      label: 'Redeemed At',
    },
    {
      name: 'expires_at',
      type: 'date',
      required: true,
      index: true,
      label: 'Expires At',
    },
  ],
};
