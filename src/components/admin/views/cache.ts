interface CachedStats<T> {
  data: T;
  timestamp: number;
}

const statsCache = new Map<string, CachedStats<unknown>>();

export async function getCachedStats<T>(
  key: string,
  ttlMs: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cached = statsCache.get(key);
  const now = Date.now();
  if (cached && now - cached.timestamp < ttlMs) {
    return cached.data as T;
  }
  const data = await fetchFn();
  statsCache.set(key, { data, timestamp: now });
  return data;
}
