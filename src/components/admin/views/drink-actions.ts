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
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'غير مصرح: يجب أن تكون مديراً لتعديل حالة المشروبات.' };
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

