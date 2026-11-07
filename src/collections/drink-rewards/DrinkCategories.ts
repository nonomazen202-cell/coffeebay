import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access';
import { revalidateDrinkCategoryCache } from '../../lib/cache/drink-rewards-cache';

export const DrinkCategories: CollectionConfig = {
  slug: 'drink-categories',
  timestamps: true,
  admin: {
    group: 'Drink Rewards',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'active', 'updatedAt'],
    description: 'Categories of beverages eligible for promotional rewards (e.g. Hot Drinks, Cold Drinks, Frappes).',
  },
  access: {
    read: () => true, // Publicly readable for menu catalog
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    afterChange: [
      ({ doc, req }) => {
        if (doc?.id) {
          revalidateDrinkCategoryCache(doc.id, doc.slug, req?.transactionID);
        }
      },
    ],
    afterDelete: [
      ({ doc, req }) => {
        if (doc?.id) {
          revalidateDrinkCategoryCache(doc.id, doc.slug, req?.transactionID);
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
      label: 'Category Name',
      admin: {
        placeholder: 'e.g. Hot Drinks',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Slug Identifier',
      admin: {
        placeholder: 'e.g. hot-drinks',
        description: 'URL-safe identifier used for system references.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description',
    },
    {
      name: 'active',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      index: true,
      label: 'Category Active',
      admin: {
        description: 'When disabled, drinks in this category are excluded from active campaigns.',
      },
    },
  ],
};
