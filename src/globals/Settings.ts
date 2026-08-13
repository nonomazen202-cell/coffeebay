import type { GlobalConfig } from 'payload';
import { isAdmin, isAdminOrStaff } from '../collections/access';

export const Settings: GlobalConfig = {
  slug: 'settings',
  access: {
    read: isAdminOrStaff,
    update: isAdmin,
  },
  admin: {
    group: 'System Settings',
  },
  fields: [
    {
      name: 'whatsapp_admin_phone',
      type: 'text',
      label: 'WhatsApp Admin Phone',
      admin: {
        description: 'The phone number where system alerts and winner notifications will be sent. If left empty, it falls back to the WHATSAPP_ADMIN_PHONE environment variable.',
      },
    },
  ],
};
