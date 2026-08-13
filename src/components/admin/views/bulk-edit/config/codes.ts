import type { CollectionBulkEditConfig } from '../types';

export const codesBulkConfig: CollectionBulkEditConfig = {
  collection: 'codes',
  maxLimit: 100,
  allowedFields: {
    is_winner: {
      type: 'checkbox',
      label: 'Is Winner / هل هو كود فائز؟',
      validate: (val) => typeof val === 'boolean',
    },
    claimed: {
      type: 'checkbox',
      label: 'Claimed / هل تم استخدامه؟',
      validate: (val) => typeof val === 'boolean',
    },
    prize_id: {
      type: 'relationship',
      label: 'Assigned Prize / الجائزة المحددة',
      relationTo: 'prizes',
      validate: (val) => val === null || typeof val === 'number' || typeof val === 'string',
    },
  },
};
