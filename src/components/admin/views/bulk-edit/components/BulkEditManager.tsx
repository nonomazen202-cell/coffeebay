'use client';

import React, { useState } from 'react';
import { bulkUpdateAction } from '../server/actions';
import { SearchableRelationshipInput } from './SearchableRelationshipInput';
import type { BulkEditFieldType } from '../types';

export interface BulkEditFieldConfig {
  name: string;
  label: string;
  type: BulkEditFieldType;
  options?: { label: string; value: string | number }[];
  relationTo?: string;
}

interface BulkEditManagerProps {
  collectionSlug: string;
  selectedIds: (string | number)[];
  selectedDocs: Record<string, unknown>[]; // Complete selected document objects
  fields: BulkEditFieldConfig[];
  onSuccess: (updatedFields: Record<string, unknown>) => void;
  onClose: () => void;
}

export function BulkEditManager({
  collectionSlug,
  selectedIds,
  selectedDocs,
  fields,
  onSuccess,
  onClose,
}: BulkEditManagerProps) {
  // Helper to map snake_case database field names to camelCase Payload document keys
  const getDocValue = (doc: Record<string, unknown>, fieldName: string) => {
    if (fieldName === 'is_winner') return doc['isWinner'];
    if (fieldName === 'claimed') return doc['claimed'];
    if (fieldName === 'prize_id') {
      const p = doc['prizeId'];
      if (p && typeof p === 'object' && 'id' in p) {
        return (p as { id: string | number })['id'];
      }
      return p;
    }
    return doc[fieldName];
  };

  // Derive the current state of each field across all selected documents
  const derivedStates = fields.reduce((acc, field) => {
    const values = selectedDocs.map((doc) => getDocValue(doc, field.name));
    
    // Check if all values are identical
    const uniqueValues = Array.from(new Set(values.map(v => v === undefined ? null : v)));
    const isMixed = uniqueValues.length > 1;
    const sharedValue = isMixed ? null : uniqueValues[0];

    // Determine status text to display when field is inactive
    let statusLabel = '';
    if (isMixed) {
      statusLabel = 'Mixed / قيم مختلفة ⚠️';
    } else if (sharedValue === null || sharedValue === undefined) {
      statusLabel = field.type === 'relationship' ? 'No Prize / بدون جائزة' : 'Not Set / غير محدد';
    } else if (field.type === 'checkbox') {
      statusLabel = sharedValue ? 'Yes / نعم' : 'No / لا';
    } else if (field.type === 'relationship') {
      // Find the name of the prize from the object in selectedDocs
      const docWithPrize = selectedDocs.find(doc => {
        const p = doc['prizeId'];
        return p && typeof p === 'object';
      });
      const prizeObj = docWithPrize ? (docWithPrize['prizeId'] as { name?: string }) : null;
      statusLabel = prizeObj?.name || `ID: ${sharedValue}`;
    } else {
      statusLabel = String(sharedValue);
    }

    acc[field.name] = {
      isMixed,
      sharedValue,
      statusLabel,
    };
    return acc;
  }, {} as Record<string, { isMixed: boolean; sharedValue: unknown; statusLabel: string }>);

  // Track which fields are toggled "on" for editing
  const [activeFields, setActiveFields] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    fields.forEach((f) => (initial[f.name] = false));
    return initial;
  });

  // Track the actual input values for each field, default to sharedValue if not mixed
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    fields.forEach((f) => {
      const state = derivedStates[f.name];
      if (state.isMixed) {
        initial[f.name] = f.type === 'checkbox' ? false : null;
      } else {
        initial[f.name] = state.sharedValue === undefined ? null : state.sharedValue;
      }
    });
    return initial;
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleToggleFieldActive = (fieldName: string) => {
    setActiveFields((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }));
  };

  const handleValueChange = (fieldName: string, value: unknown) => {
    setFieldValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Build the patch payload containing ONLY fields that are explicitly activated/toggled
    const patch: Record<string, unknown> = {};
    let hasActiveFields = false;

    fields.forEach((f) => {
      if (activeFields[f.name]) {
        patch[f.name] = fieldValues[f.name];
        hasActiveFields = true;
      }
    });

    if (!hasActiveFields) {
      setErrorMsg('Please select at least one field to edit by ticking its checkbox on the left.');
      return;
    }

    setSaving(true);
    try {
      const res = await bulkUpdateAction(collectionSlug, selectedIds, patch);
      if (res.success) {
        onSuccess(patch);
      } else {
        setErrorMsg(res.error || 'Failed to apply bulk modifications.');
      }
    } catch (err) {
      console.error('[BulkEditManager] Client call failed:', err);
      setErrorMsg('A network error occurred while submitting changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(13, 5, 59, 0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '1rem',
          boxShadow: '0 24px 60px rgba(21, 9, 88, 0.22)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#150958',
          }}
        >
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#FFFFFF', margin: 0 }}>
            ✏️ Bulk Edit Selected / تعديل جماعي للبيانات
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: '#C0C0C0',
              fontSize: '1.25rem',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#C0C0C0')}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ padding: '1.5rem', overflowY: 'auto', maxHeight: '450px' }}>
            {/* Info Message */}
            <div
              style={{
                fontSize: '0.85rem',
                color: '#1E293B',
                backgroundColor: '#EEF2FF',
                border: '1px dashed #C7D2FE',
                borderRadius: '0.75rem',
                padding: '0.85rem 1rem',
                marginBottom: '1.5rem',
                lineHeight: 1.5,
              }}
            >
              You are updating <strong style={{ color: '#150958' }}>{selectedIds.length} records</strong>. Only checked fields will be overwritten.
              <br />
              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                سيتم تعديل الحقول التي تقوم بتحديد المربع بجانبها فقط، وباقي البيانات ستبقى دون تغيير.
              </span>
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div
                style={{
                  padding: '0.85rem 1rem',
                  backgroundColor: '#FEF2F2',
                  color: '#B91C1C',
                  borderRadius: '0.625rem',
                  fontSize: '0.85rem',
                  marginBottom: '1.25rem',
                  border: '1px solid #FECACA',
                  whiteSpace: 'pre-wrap',
                }}
              >
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Fields Editor list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {fields.map((field) => {
                const isActive = activeFields[field.name];
                const value = fieldValues[field.name];
                const state = derivedStates[field.name];

                return (
                  <div
                    key={field.name}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      padding: '0.85rem 1rem',
                      borderRadius: '0.75rem',
                      backgroundColor: isActive ? '#F8FAFC' : 'transparent',
                      border: '1px solid',
                      borderColor: isActive ? '#CBD5E1' : '#EEF2F6',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Checkbox activation header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => handleToggleFieldActive(field.name)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#150958' }}
                        />
                        <label
                          onClick={() => handleToggleFieldActive(field.name)}
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: isActive ? '700' : '600',
                            color: isActive ? '#150958' : '#475569',
                            cursor: 'pointer',
                            userSelect: 'none',
                          }}
                        >
                          {field.label}
                        </label>
                      </div>

                      {/* Display current state status if field is not active */}
                      {!isActive && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            color: state.isMixed ? '#92400E' : '#150958',
                            backgroundColor: state.isMixed ? '#FEF3C7' : '#EEF2FF',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '9999px',
                            border: '1px solid',
                            borderColor: state.isMixed ? '#FDE68A' : '#C7D2FE',
                          }}
                        >
                          {state.statusLabel}
                        </span>
                      )}
                    </div>

                    {/* Input control (active state only) */}
                    {isActive && (
                      <div style={{ paddingLeft: '2rem', animation: 'fadeIn 0.15s ease' }}>
                        {/* Checkbox Inputs */}
                        {field.type === 'checkbox' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                              type="checkbox"
                              checked={Boolean(value)}
                              onChange={(e) => handleValueChange(field.name, e.target.checked)}
                              style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: '#150958' }}
                            />
                            <span style={{ fontSize: '0.85rem', color: '#1E293B', fontWeight: '600' }}>
                              {Boolean(value) ? 'True / تفعيل' : 'False / تعطيل'}
                            </span>
                          </div>
                        )}

                        {/* Select Input */}
                        {field.type === 'select' && (
                          <select
                            value={(value as string | number) || ''}
                            onChange={(e) => handleValueChange(field.name, e.target.value)}
                            style={{
                              width: '100%',
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #CBD5E1',
                              borderRadius: '0.5rem',
                              padding: '0.55rem 0.75rem',
                              color: '#1E293B',
                              outline: 'none',
                            }}
                          >
                            <option value="" disabled>
                              Select an option...
                            </option>
                            {field.options?.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        )}

                        {/* Relationship Input (searchable) */}
                        {field.type === 'relationship' && field.relationTo && (
                          <SearchableRelationshipInput
                            relationTo={field.relationTo}
                            value={value as string | number | null}
                            onChange={(val) => handleValueChange(field.name, val)}
                          />
                        )}

                        {/* Text Input */}
                        {field.type === 'text' && (
                          <input
                            type="text"
                            value={(value as string) || ''}
                            onChange={(e) => handleValueChange(field.name, e.target.value)}
                            style={{
                              width: '100%',
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #CBD5E1',
                              borderRadius: '0.5rem',
                              padding: '0.55rem 0.75rem',
                              color: '#1E293B',
                              outline: 'none',
                            }}
                            placeholder="Type value..."
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer actions */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderTop: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
            }}
          >
            <button
              onClick={onClose}
              disabled={saving}
              type="button"
              style={{
                padding: '0.625rem 1.25rem',
                backgroundColor: '#FFFFFF',
                color: '#150958',
                border: '1px solid #CBD5E1',
                borderRadius: '9999px',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#EEF2FF')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
            >
              Cancel / إلغاء
            </button>

            <button
              disabled={saving}
              type="submit"
              style={{
                padding: '0.625rem 1.5rem',
                backgroundColor: '#150958',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '9999px',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(21, 9, 88, 0.18)',
              }}
              onMouseEnter={(e) => {
                if (!saving) e.currentTarget.style.backgroundColor = '#1E117A';
              }}
              onMouseLeave={(e) => {
                if (!saving) e.currentTarget.style.backgroundColor = '#150958';
              }}
            >
              {saving ? 'Saving changes...' : 'Update Selected / تحديث البيانات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

