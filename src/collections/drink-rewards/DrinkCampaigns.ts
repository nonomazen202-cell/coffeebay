import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access';
import { revalidateDrinkCampaignCache } from '../../lib/cache/drink-rewards-cache';

export const DrinkCampaigns: CollectionConfig = {
  slug: 'drink-campaigns',
  timestamps: true,
  admin: {
    group: 'Drink Rewards',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'active', 'start_date', 'end_date', 'total_claimed'],
    description: 'Promotional campaigns offering free drinks with multiple allowed beverage categories.',
  },
  access: {
    read: () => true, // Publicly readable for campaign landing pages
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    afterChange: [
      ({ doc, req, previousDoc }) => {
        if (doc?.slug) {
          revalidateDrinkCampaignCache(doc.slug, req?.transactionID, previousDoc?.slug);
        }
      },
    ],
    afterDelete: [
      ({ doc, req }) => {
        if (doc?.slug) {
          revalidateDrinkCampaignCache(doc.slug, req?.transactionID);
        }
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Campaign Title',
      admin: {
        placeholder: 'e.g. Free Hot Drink Launch Campaign',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Campaign URL Slug',
      admin: {
        placeholder: 'e.g. free-hot-drink, autumn-rewards',
        description: 'Used in the customer promotional URL: /drink-rewards/[slug]',
      },
    },
    {
      name: 'allowed_categories',
      type: 'relationship',
      relationTo: 'drink-categories',
      hasMany: true,
      required: true,
      label: 'Eligible Beverage Categories',
      admin: {
        description: 'Select one or multiple categories (e.g. Hot Drinks + Frappes). All active drinks in these categories will appear in the customer selection carousel.',
      },
    },
    {
      name: 'start_date',
      type: 'date',
      required: true,
      index: true,
      label: 'Campaign Start Date & Time',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'end_date',
      type: 'date',
      required: true,
      index: true,
      label: 'Campaign End Date & Time (Voucher Expiration)',
      admin: {
        description: 'Vouchers issued under this campaign expire automatically at this exact time.',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'allowed_branches',
      type: 'relationship',
      relationTo: 'branches',
      hasMany: true,
      label: 'Participating Branches',
      admin: {
        description: 'Leave empty to allow all active Coffee Bay branches.',
      },
    },
    {
      name: 'max_claims',
      type: 'number',
      min: 0,
      label: 'Maximum Total Vouchers (Cap)',
      admin: {
        placeholder: 'e.g. 500 (leave blank for unlimited)',
        description: 'Optional budget ceiling. If set, no new vouchers will be issued once total claimed reaches this number.',
      },
    },
    {
      name: 'total_claimed',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      label: 'Total Vouchers Issued',
      admin: {
        readOnly: true,
        description: 'Automatically managed atomic counter of all vouchers claimed by customers.',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      index: true,
      label: 'Campaign Live / Active',
      admin: {
        description: 'When disabled, customers attempting to register will see an inactive campaign notice.',
      },
    },
    {
      name: 'banner_image',
      type: 'relationship',
      relationTo: 'media',
      label: 'Campaign Hero Banner Image',
      admin: {
        description: 'Optional visual banner displayed at the top of the campaign landing page.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Promotional Terms & Welcome Message',
      admin: {
        placeholder: 'e.g. Enjoy your favorite handcrafted coffee on us! One complimentary drink per customer at any Coffee Bay branch.',
      },
    },
  ],
};
