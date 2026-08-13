import type { CollectionConfig } from 'payload';
import { isAdmin } from './access';

export const NotificationAudit: CollectionConfig = {
  slug: 'notification-audit',
  timestamps: true,
  access: {
    read: isAdmin,
    create: () => false,
    update: () => false,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'eventType',
    defaultColumns: ['eventType', 'notification', 'fromStatus', 'toStatus', 'actor', 'createdAt'],
  },
  fields: [
    {
      name: 'eventType',
      type: 'select',
      required: true,
      defaultValue: 'notification_transition',
      options: [
        { label: 'Notification Transition', value: 'notification_transition' },
        { label: 'Recovery Bulk', value: 'recovery_bulk' },
        { label: 'Worker Startup', value: 'worker_startup' },
      ],
      index: true,
    },
    {
      name: 'notification',
      type: 'relationship',
      relationTo: 'notifications',
      index: true,
      validate: (val: unknown, { data }: { data?: Record<string, unknown> }) => {
        if (data?.eventType === 'notification_transition' && !val) {
          return 'Notification relationship is required for state transitions';
        }
        return true;
      },
    },
    {
      name: 'fromStatus',
      type: 'text',
      validate: (val: unknown, { data }: { data?: Record<string, unknown> }) => {
        if ((data?.eventType === 'notification_transition' || data?.eventType === 'recovery_bulk') && !val) {
          return 'fromStatus is required for this event type';
        }
        return true;
      },
    },
    {
      name: 'toStatus',
      type: 'text',
      validate: (val: unknown, { data }: { data?: Record<string, unknown> }) => {
        if ((data?.eventType === 'notification_transition' || data?.eventType === 'recovery_bulk') && !val) {
          return 'toStatus is required for this event type';
        }
        return true;
      },
    },
    {
      name: 'actor',
      type: 'text',
      required: true,
    },
    {
      name: 'error',
      type: 'text',
    },
    {
      name: 'metadata',
      type: 'json',
      validate: (val: unknown, { data }: { data?: Record<string, unknown> }) => {
        if (data?.eventType === 'recovery_bulk' && !val) {
          return 'Metadata is required for bulk recovery events';
        }
        return true;
      },
    },
    {
      name: 'providerResponse',
      type: 'json',
    },
    {
      name: 'durationMs',
      type: 'number',
    },
  ],
};
