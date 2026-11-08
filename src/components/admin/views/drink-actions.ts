'use server';

import { getPayload } from 'payload';
import config from '@payload-config';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

/**
 * Toggles a beverage's active status directly from the Drinks Menu Grid.
 */
export async function toggleDrinkActive(drinkId: number, active: boolean) {
  try {
    const payload = await getPayload({ config });

    // Authenticate user
    const authResult = await payload.auth({
      headers: await headers(),
    });

    const user = authResult?.user;
    if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
      return { success: false, error: 'غير مصرح: يجب تسجيل الدخول لتعديل حالة المشروبات.' };
    }

    const updated = await payload.update({
      collection: 'drinks',
      id: drinkId,
      data: {
        active,
      },
      overrideAccess: true,
    });

    revalidatePath('/admin/collections/drinks');
    return { success: true, active: Boolean(updated.active) };
  } catch (err) {
    console.error('[toggleDrinkActive] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'فشل تحديث حالة المشروب.',
    };
  }
}

/**
 * Toggles whether a specific customer/voucher is granted permission to claim another beverage.
 */
export async function toggleVoucherReclaimAllowed(voucherId: number, allowed: boolean) {
  try {
    const payload = await getPayload({ config });

    const authResult = await payload.auth({
      headers: await headers(),
    });

    const user = authResult?.user;
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'غير مصرح: يجب أن تكون مديراً لتعديل أذونات المطالبة الإضافية.' };
    }

    const updated = await payload.update({
      collection: 'drink-entitlements',
      id: voucherId,
      data: {
        reclaim_allowed: allowed,
      },
      overrideAccess: true,
    });

    revalidatePath('/admin/collections/drink-entitlements');
    return { success: true, reclaimAllowed: Boolean(updated.reclaim_allowed) };
  } catch (err) {
    console.error('[toggleVoucherReclaimAllowed] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'فشل تحديث إذن المطالبة الإضافية.',
    };
  }
}

/**
 * Grants or revokes extra claim permission for multiple selected vouchers simultaneously.
 */
export async function bulkToggleReclaimAllowed(voucherIds: (number | string)[], allowed: boolean) {
  try {
    const payload = await getPayload({ config });

    const authResult = await payload.auth({
      headers: await headers(),
    });

    const user = authResult?.user;
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'غير مصرح: يجب أن تكون مديراً للتعديل الجماعي.' };
    }

    const numericIds = voucherIds.map(Number).filter((n) => !isNaN(n));
    if (numericIds.length === 0) {
      return { success: false, error: 'لم يتم تحديد أي كوبونات.' };
    }

    await payload.update({
      collection: 'drink-entitlements',
      where: {
        id: {
          in: numericIds,
        },
      },
      data: {
        reclaim_allowed: allowed,
      },
      overrideAccess: true,
    });

    revalidatePath('/admin/collections/drink-entitlements');
    return { success: true, count: numericIds.length };
  } catch (err) {
    console.error('[bulkToggleReclaimAllowed] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'فشل تعديل الإذن للكوبونات المحددة.',
    };
  }
}

