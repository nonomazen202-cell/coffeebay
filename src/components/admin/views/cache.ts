interface CachedStats<T> {
  data: T;
  timestamp: number;
}

const MAX_CACHE_ENTRIES = 250;
const statsCache = new Map<string, CachedStats<unknown>>();
const inFlightPromises = new Map<string, Promise<unknown>>();

/**
 * Singleflight-protected in-memory micro-cache for admin KPIs & lookup maps.
 * Coalesces concurrent requests for the same key so 50+ simultaneous admins
 * execute only 1 database query instead of 50 redundant round-trips.
 */
export async function getCachedStats<T>(
  key: string,
  ttlMs: number,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const cached = statsCache.get(key);
  if (cached && now - cached.timestamp < ttlMs) {
    return cached.data as T;
  }

  const existingInFlight = inFlightPromises.get(key);
  if (existingInFlight) {
    return existingInFlight as Promise<T>;
  }

  const fetchPromise = (async () => {
    try {
      const data = await fetchFn();
      if (statsCache.size >= MAX_CACHE_ENTRIES && !statsCache.has(key)) {
        const oldestKey = statsCache.keys().next().value;
        if (oldestKey !== undefined) {
          statsCache.delete(oldestKey);
        }
      }
      statsCache.set(key, { data, timestamp: Date.now() });
      return data;
    } finally {
      inFlightPromises.delete(key);
    }
  })();

  inFlightPromises.set(key, fetchPromise);
  return fetchPromise;
}

/**
 * Immediately invalidates exact or prefix-matched keys from the admin micro-cache.
 */
export function invalidateCachedStats(keyOrPrefix?: string): void {
  if (!keyOrPrefix) {
    statsCache.clear();
    return;
  }
  for (const k of statsCache.keys()) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix)) {
      statsCache.delete(k);
    }
  }
}
