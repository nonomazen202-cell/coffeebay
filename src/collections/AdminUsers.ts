import type { CollectionConfig } from 'payload';
import { isAdmin, isAdminOrSelf } from './access';

export const AdminUsers: CollectionConfig = {
  slug: 'users',
  auth: true,
  timestamps: true,
  access: {
    read: isAdminOrSelf,
    create: isAdmin,
    update: isAdminOrSelf,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'STAFF',
      options: [
        {
          label: 'Admin',
          value: 'ADMIN',
        },
        {
          label: 'Staff',
          value: 'STAFF',
        },
      ],
    },
  ],
};
