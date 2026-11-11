import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access';
import { revalidateDrinkCampaignCache } from '../../lib/cache/drink-rewards-cache';

export const DrinkCampaigns: CollectionConfig = {
  slug: 'drink-campaigns',
  timestamps: true,
  admin: {
    hidden: ({ user }) => user?.role !== 'ADMIN',
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
      async ({ doc, req, previousDoc }) => {
        if (doc?.slug) {
          revalidateDrinkCampaignCache(doc.slug, req?.transactionID, previousDoc?.slug);
        }

        // If campaign end_date was extended, cascade ONLY to active vouchers that have NOT expired yet
        if (
          doc?.id &&
          doc?.end_date &&
          previousDoc?.end_date &&
          new Date(doc.end_date).getTime() > new Date(previousDoc.end_date).getTime()
        ) {
          try {
            const { sql } = await import('drizzle-orm');
            const newExpiryIso = new Date(doc.end_date).toISOString();
            // STRICT AUDIT & SAFETY:
            // 1. Only status = 'ISSUED' (never REDEEMED, never CANCELLED, never EXPIRED)
            // 2. Only vouchers that have NOT expired yet (expires_at >= NOW())
            // It is strictly impossible for any expired voucher to be revived or touched!
            await req.payload.db.drizzle.execute(sql`
              UPDATE drink_entitlements
              SET expires_at = ${newExpiryIso}, updated_at = NOW()
              WHERE campaign_id = ${doc.id}
                AND status = 'ISSUED'
                AND expires_at >= NOW()
            `);
            req.payload.logger.info(`[DrinkCampaigns] Safely synchronized expiry date to ${newExpiryIso} for unexpired active vouchers in campaign ${doc.id}`);
          } catch (err) {
            req.payload.logger.error(`[DrinkCampaigns] Failed to cascade expiry update to entitlements: ${err}`);
          }
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
      name: 'max_claims_per_phone',
      type: 'number',
      min: 1,
      defaultValue: 1,
      label: 'Max Vouchers Per Phone (أقصى عدد كوبونات لكل رقم)',
      admin: {
        description: 'Number of vouchers a customer can claim with the same phone number in this campaign (Default: 1).',
      },
    },
    {
      name: 'allow_repeat_mode',
      type: 'select',
      defaultValue: 'NEVER',
      label: 'Repeat Claim Eligibility (شرط تكرار الطلب)',
      options: [
        { label: 'Once Per Phone (Default / الافتراضي - مرة واحدة فقط)', value: 'NEVER' },
        { label: 'Only After Previous Voucher is Redeemed (بعد صرف الكوبون السابق بالفرع)', value: 'AFTER_REDEMPTION' },
        { label: 'Anytime Up to Limit (في أي وقت حتى الحد الأقصى)', value: 'ANYTIME' },
      ],
      admin: {
        description: 'Determines when a customer is allowed to claim another beverage with the same phone number.',
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
        description: 'Atomic counter of all vouchers claimed by customers. Can be adjusted by Admin.',
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
