import type { CollectionConfig } from 'payload';
import { isAdmin, isAdminOrStaff } from '../access';

export const DrinkEntitlements: CollectionConfig = {
  slug: 'drink-entitlements',
  timestamps: true,
  admin: {
    group: 'Drink Rewards',
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
    read: isAdminOrStaff,
    create: isAdmin,
    update: isAdminOrStaff,
    delete: isAdmin,
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
        readOnly: true,
      },
    },
    {
      name: 'campaign',
      type: 'relationship',
      relationTo: 'drink-campaigns',
      required: true,
      index: true,
      label: 'Campaign',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
      index: true,
      label: 'Customer Phone (E.164)',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'customer_name',
      type: 'text',
      required: true,
      label: 'Customer Full Name',
      admin: {
        readOnly: true,
      },
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
        readOnly: true,
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
        readOnly: true,
        description: 'Historical snapshot of drink IDs eligible at the exact time this voucher was issued, protecting customer rights against subsequent campaign edits.',
      },
    },
    {
      name: 'issued_at',
      type: 'date',
      required: true,
      label: 'Issued At',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'redeemed_at',
      type: 'date',
      label: 'Redeemed At',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'expires_at',
      type: 'date',
      required: true,
      index: true,
      label: 'Expires At',
      admin: {
        readOnly: true,
      },
    },
  ],
};
