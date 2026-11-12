import type { GlobalConfig } from 'payload';
import { isSuperAdminAccess } from '../collections/access';
import { isSuperAdmin } from '../lib/security/roles';

export const Settings: GlobalConfig = {
  slug: 'settings',
  access: {
    read: isSuperAdminAccess,
    update: isSuperAdminAccess,
  },
  admin: {
    group: 'System Administration / إدارة المنظومة',
    hidden: ({ user }) => !isSuperAdmin(user),
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
    {
      name: 'enable_email_alerts',
      type: 'checkbox',
      label: 'Enable Email Alerts',
      defaultValue: true,
      admin: {
        description: 'Toggle to enable or disable winner and developer SMTP email alerts to the administrator.',
      },
    },
  ],
};
