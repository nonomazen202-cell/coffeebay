import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access';
import { revalidateBranchesCache } from '../../lib/cache/drink-rewards-cache';

export const Branches: CollectionConfig = {
  slug: 'branches',
  timestamps: true,
  admin: {
    group: 'Drink Rewards',
    useAsTitle: 'name',
    defaultColumns: ['name', 'code', 'address', 'active', 'updatedAt'],
    description: 'Physical Coffee Bay branch locations where complimentary drinks can be redeemed.',
  },
  access: {
    read: () => true, // Publicly readable for branch lists
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeDelete: [
      async ({ req, id }) => {
        // Prevent deleting branch if referenced in redemptions or staff assignments
        const entitlementsUsingBranch = await req.payload.find({
          collection: 'drink-entitlements',
          where: { branch: { equals: id } },
          limit: 1,
        });

        if (entitlementsUsingBranch.totalDocs > 0) {
          throw new Error(
            'Cannot delete this branch because it has past drink redemption records. Please toggle "Active" off instead.'
          );
        }
      },
    ],
    afterChange: [
      ({ req }) => {
        revalidateBranchesCache(req?.transactionID);
      },
    ],
    afterDelete: [
      ({ req }) => {
        revalidateBranchesCache(req?.transactionID);
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      index: true,
      label: 'Branch Name',
      admin: {
        placeholder: 'e.g. فرع المعادي - شارع 9 / Maadi Branch',
      },
    },
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Branch Code',
      admin: {
        placeholder: 'e.g. MAADI-01, ZAMALEK-01',
        description: 'Unique internal code representing this branch.',
      },
    },
    {
      name: 'address',
      type: 'text',
      label: 'Address / Location',
      admin: {
        placeholder: 'e.g. 15 Street 9, Maadi, Cairo',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      index: true,
      label: 'Branch Active',
      admin: {
        description: 'When disabled, staff cannot redeem vouchers at this branch.',
      },
    },
  ],
};
