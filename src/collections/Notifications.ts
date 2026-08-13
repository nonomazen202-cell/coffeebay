import type { CollectionConfig } from 'payload';
import { isAdmin, isAdminOrStaff } from './access';

export const Notifications: CollectionConfig = {
  slug: 'notifications',
  timestamps: true,
  access: {
    read: isAdminOrStaff,
    create: () => false,
    update: () => false,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'phone',
    defaultColumns: ['phone', 'template', 'status', 'priority', 'attempts', 'providerName', 'createdAt'],
    components: {
      views: {
        list: {
          Component: '@/components/admin/views/CustomListNotifications#CustomListNotifications',
        },
      },
    },
  },
  fields: [
    {
      name: 'phone',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'template',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Verification', value: 'verification' },
        { label: 'Winner Notification', value: 'winner-notification' },
        { label: 'Admin Alert', value: 'admin-alert' },
      ],
    },
    {
      name: 'payload',
      type: 'json',
      required: true,
    },
    {
      name: 'message',
      type: 'textarea',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'queued',
      index: true,
      options: [
        { label: 'Created', value: 'created' },
        { label: 'Queued', value: 'queued' },
        { label: 'Locked', value: 'locked' },
        { label: 'Sending', value: 'sending' },
        { label: 'Provider Accepted', value: 'provider-accepted' },
        { label: 'Sent', value: 'sent' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Read', value: 'read' },
        { label: 'Retry Scheduled', value: 'retry-scheduled' },
        { label: 'Failed', value: 'failed' },
        { label: 'Dead Letter', value: 'dead-letter' },
      ],
    },
    {
      name: 'priority',
      type: 'number',
      required: true,
      defaultValue: 80,
      index: true,
    },
    {
      name: 'attempts',
      type: 'number',
      required: true,
      defaultValue: 0,
    },
    {
      name: 'maxAttempts',
      type: 'number',
      required: true,
      defaultValue: 5,
    },
    {
      name: 'nextAttemptAt',
      type: 'date',
      index: true,
    },
    {
      name: 'expiresAt',
      type: 'date',
      index: true,
    },
    {
      name: 'lockedAt',
      type: 'date',
    },
    {
      name: 'lockedBy',
      type: 'text',
    },
    {
      name: 'leaseExpiresAt',
      type: 'date',
      index: true,
    },
    {
      name: 'lastError',
      type: 'text',
    },
    {
      name: 'sentAt',
      type: 'date',
    },
    {
      name: 'deliveredAt',
      type: 'date',
    },
    {
      name: 'readAt',
      type: 'date',
    },
    {
      name: 'providerMessageId',
      type: 'text',
      index: true,
    },
    {
      name: 'providerName',
      type: 'text',
    },
    {
      name: 'idempotencyKey',
      type: 'text',
      unique: true,
      index: true,
    },
    {
      name: 'sendDurationMs',
      type: 'number',
    },
    {
      name: 'deliveryPayload',
      type: 'json',
    },
  ],
};
