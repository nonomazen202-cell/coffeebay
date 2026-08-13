import { getPayloadClient } from '../lib/payload';

let cachedAdminPhone: string | null = null;
let lastFetchedTime = 0;
const CACHE_TTL_MS = 8 * 60 * 1000; // 8 minutes
let activeFetchPromise: Promise<string | null> | null = null;

export async function getCachedAdminPhone(): Promise<string | null> {
  const now = Date.now();

  // If cache is fresh, return it instantly
  if (cachedAdminPhone !== null && (now - lastFetchedTime) < CACHE_TTL_MS) {
    return cachedAdminPhone || null;
  }

  // If there is an active database query running, reuse the same promise
  if (activeFetchPromise) {
    return activeFetchPromise;
  }

  activeFetchPromise = (async () => {
    try {
      const payload = await getPayloadClient();
      const settings = await payload.findGlobal({
        slug: 'settings',
      });

      cachedAdminPhone = settings?.whatsapp_admin_phone || '';
      lastFetchedTime = Date.now();
      return cachedAdminPhone || null;
    } catch (err) {
      console.error('[SettingsCache] Failed to fetch settings global, using stale cache if available:', err);
      return cachedAdminPhone || null;
    } finally {
      activeFetchPromise = null;
    }
  })();

  return activeFetchPromise;
}
