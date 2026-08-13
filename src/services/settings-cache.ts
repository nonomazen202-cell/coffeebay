import { getPayloadClient } from '../lib/payload';

let cachedAdminPhone: string | null = null;
let cachedEmailAlertsEnabled: boolean | null = null;
let lastFetchedTime = 0;
const CACHE_TTL_MS = 8 * 60 * 1000; // 8 minutes
let activeFetchPromise: Promise<{ phone: string | null; emailEnabled: boolean }> | null = null;

async function fetchSettings(): Promise<{ phone: string | null; emailEnabled: boolean }> {
  const now = Date.now();

  // If cache is fresh, return it instantly
  if (cachedAdminPhone !== null && cachedEmailAlertsEnabled !== null && (now - lastFetchedTime) < CACHE_TTL_MS) {
    return { phone: cachedAdminPhone || null, emailEnabled: cachedEmailAlertsEnabled };
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
      }) as unknown as Record<string, unknown>;

      cachedAdminPhone = (settings?.whatsapp_admin_phone as string) || '';
      cachedEmailAlertsEnabled = settings?.enable_email_alerts !== false;
      lastFetchedTime = Date.now();
      return { phone: cachedAdminPhone || null, emailEnabled: cachedEmailAlertsEnabled };
    } catch (err) {
      console.error('[SettingsCache] Failed to fetch settings global, using stale cache if available:', err);
      return {
        phone: cachedAdminPhone || null,
        emailEnabled: cachedEmailAlertsEnabled ?? true,
      };
    } finally {
      activeFetchPromise = null;
    }
  })();

  return activeFetchPromise;
}

export async function getCachedAdminPhone(): Promise<string | null> {
  const res = await fetchSettings();
  return res.phone;
}

export async function isEmailAlertsEnabled(): Promise<boolean> {
  const res = await fetchSettings();
  return res.emailEnabled;
}

