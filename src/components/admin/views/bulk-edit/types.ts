export type BulkEditFieldType = 'checkbox' | 'text' | 'select' | 'relationship';

export interface FieldSchema {
  type: BulkEditFieldType;
  label: string;
  relationTo?: string; // required if type === 'relationship'
  options?: { label: string; value: string | number }[]; // required if type === 'select'
  validate: (val: unknown) => boolean | Promise<boolean>;
}

export interface CollectionBulkEditConfig {
  collection: string;
  maxLimit?: number; // custom limits per collection, defaults to 100
  allowedFields: Record<string, FieldSchema>;
}

export type BulkEditRegistry = Record<string, CollectionBulkEditConfig>;
