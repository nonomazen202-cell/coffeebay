import type { CollectionConfig } from 'payload';
import { isAdmin, isAdminOrStaff } from '../access';

export const DrinkCashierAssignments: CollectionConfig = {
  slug: 'drink-cashier-assignments',
  timestamps: true,
  admin: {
    group: 'Drink Rewards',
    useAsTitle: 'id',
    defaultColumns: ['user', 'branch', 'active', 'createdAt'],
    description: 'Binds staff members to specific Coffee Bay physical branches for server-verified redemptions.',
  },
  access: {
    read: isAdminOrStaff,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        // Enforce that a user only has ONE active branch assignment at a time
        if (data.active && data.user) {
          const userId = typeof data.user === 'object' && data.user !== null ? data.user.id : data.user;
          
          // Deactivate any existing active assignments for this user
          const existingAssignments = await req.payload.find({
            collection: 'drink-cashier-assignments',
            where: {
              and: [
                { user: { equals: userId } },
                { active: { equals: true } },
              ],
            },
            limit: 50,
          });

          for (const assignment of existingAssignments.docs) {
            // If updating, skip self
            if (operation === 'update' && req.routeParams?.id && String(assignment.id) === String(req.routeParams.id)) {
              continue;
            }
            await req.payload.update({
              collection: 'drink-cashier-assignments',
              id: assignment.id,
              data: { active: false },
            });
          }
        }
        return data;
      },
    ],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      label: 'Staff Member / User',
      admin: {
        description: 'The authenticated user (typically with STAFF or ADMIN role).',
      },
    },
    {
      name: 'branch',
      type: 'relationship',
      relationTo: 'branches',
      required: true,
      index: true,
      label: 'Assigned Physical Branch',
      admin: {
        description: 'The branch where this staff member is authorized to process drink redemptions.',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      index: true,
      label: 'Assignment Currently Active',
      admin: {
        description: 'Only active assignments permit redemptions at this branch.',
      },
    },
    {
      name: 'assigned_at',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
      label: 'Assigned At',
      admin: {
        readOnly: true,
      },
    },
  ],
};
