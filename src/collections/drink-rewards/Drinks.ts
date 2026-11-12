import type { CollectionConfig } from 'payload';
import { isPromotionsAdminAccess, isPromotionsStaffOrAdminAccess } from '../access';
import { hasPromotionsAccess } from '../../lib/security/roles';
import { revalidateDrinkItemCache } from '../../lib/cache/drink-rewards-cache';

export const Drinks: CollectionConfig = {
  slug: 'drinks',
  timestamps: true,
  admin: {
    hidden: ({ user }) => !hasPromotionsAccess(user),
    group: 'Promotions / الحملات والعروض الترويجية',
    useAsTitle: 'name',
    defaultColumns: ['name', 'category', 'active', 'updatedAt'],
    description: 'Beverages that can be offered in promotional reward campaigns.',
    components: {
      views: {
        list: {
          Component: '@/components/admin/views/CustomListDrinks#CustomListDrinks',
        },
      },
    },
  },
  access: {
    read: () => true, // Publicly readable for menu carousel
    create: isPromotionsAdminAccess,
    update: isPromotionsStaffOrAdminAccess,
    delete: isPromotionsAdminAccess,
  },
  hooks: {
    beforeDelete: [
      async ({ req, id }) => {
        // Prevent accidental deletion of drinks referenced in historical entitlements
        const entitlementsUsingDrink = await req.payload.find({
          collection: 'drink-entitlements',
          where: {
            or: [
              { selected_drink: { equals: id } },
              { redeemed_drink: { equals: id } },
            ],
          },
          limit: 1,
        });

        if (entitlementsUsingDrink.totalDocs > 0) {
          throw new Error(
            'Cannot delete this drink because it is linked to customer redemption history. Please toggle "Active" off instead.'
          );
        }
      },
    ],
    afterChange: [
      ({ doc, req, previousDoc }) => {
        if (doc?.id) {
          const categoryId = typeof doc.category === 'object' && doc.category !== null ? doc.category.id : doc.category;
          const previousCategoryId = typeof previousDoc?.category === 'object' && previousDoc?.category !== null ? previousDoc.category.id : previousDoc?.category;
          revalidateDrinkItemCache(doc.id, categoryId, req?.transactionID, previousCategoryId);
        }
      },
    ],
    afterDelete: [
      ({ doc, req }) => {
        if (doc?.id) {
          const categoryId = typeof doc.category === 'object' && doc.category !== null ? doc.category.id : doc.category;
          revalidateDrinkItemCache(doc.id, categoryId, req?.transactionID);
        }
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      index: true,
      label: 'Beverage Name',
      admin: {
        placeholder: 'e.g. Spanish Latte, Cappuccino, Iced Caramel Macchiato',
      },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'drink-categories',
      required: true,
      index: true,
      label: 'Beverage Category',
    },
    {
      name: 'image',
      type: 'relationship',
      relationTo: 'media',
      required: true,
      label: 'Beverage Image',
      admin: {
        description: 'High quality photo displayed in the customer reward slider.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description & Flavor Profile',
      admin: {
        placeholder: 'e.g. Rich espresso combined with sweet condensed milk and velvety steamed froth.',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      index: true,
      label: 'Available for Selection',
      admin: {
        description: 'Toggle off if temporarily out of stock or seasonal.',
      },
    },
  ],
};
