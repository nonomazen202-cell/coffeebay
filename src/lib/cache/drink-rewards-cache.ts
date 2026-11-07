import fs from 'fs';
import path from 'path';
import { revalidateTag, revalidatePath } from 'next/cache';

/**
 * Drink Rewards Cache Tags & Commit-Safe Invalidation Engine
 *
 * Implements fine-grained cache tags, in-memory single-flight campaign caching,
 * and cross-worker monotonic cache versioning for public menu, categories, drinks,
 * branches, media, and campaigns.
 *
 * STRICTLY EVENT-DRIVEN INVALIDATION:
 * - Zero TTL (`revalidate: <seconds>` is never used).
 * - Zero redundant DB queries when nothing has changed.
 * - Dual-phase invalidation (Immediate Synchronous in hook + Post-Commit after PostgreSQL COMMIT)
 *   so both Next.js RSC route caches and in-memory campaign caches update immediately on normal
 *   reload or step navigation without ever requiring a hard browser reload.
 */

export const DRINK_CACHE_TAGS = {
  // Global catalog tags
  categories: 'drink-rewards:categories',
  category: (id: string | number) => `drink-rewards:category:${id}`,
  drinks: 'drink-rewards:drinks',
  drink: (id: string | number) => `drink-rewards:drink:${id}`,
  branches: 'drink-rewards:branches',
  campaigns: 'drink-rewards:campaigns',

  // Campaign-specific menu tags
  campaign: (slug: string) => `drink-rewards:campaign:${slug}`,
  menu: (slug: string) => `drink-rewards:menu:${slug}`,
} as const;

export type TransactionID = string | number | Promise<string | number>;

interface CachedCampaignEntry<T = unknown> {
  version: number;
  data: T;
}

interface GlobalDrinkRewardsCacheState {
  version: number;
  campaignCache: Map<string, CachedCampaignEntry>;
  inFlightCampaignLoads: Map<string, Promise<unknown>>;
  knownCampaignSlugs: Set<string>;
  pendingInvalidations: Map<string | number, Set<() => void>>;
  fallbackTimers: Map<string | number, ReturnType<typeof setTimeout>>;
}

const GLOBAL_CACHE_KEY = '__coffeebayDrinkRewardsCacheState_v2';
const VERSION_STAMP_FILE = path.join(
  process.cwd(),
  '.next',
  'cache',
  'drink-rewards-version.stamp',
);

function readCrossWorkerVersionStamp(): number {
  try {
    if (!fs.existsSync(VERSION_STAMP_FILE)) {
      return 0;
    }
    const raw = fs.readFileSync(VERSION_STAMP_FILE, 'utf8').trim();
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeCrossWorkerVersionStamp(version: number): void {
  try {
    const dir = path.dirname(VERSION_STAMP_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(VERSION_STAMP_FILE, String(version), 'utf8');
  } catch {
    // Non-fatal in read-only or test environments without .next directory
  }
}

function getGlobalCacheState(): GlobalDrinkRewardsCacheState {
  const g = globalThis as unknown as Record<
    string,
    GlobalDrinkRewardsCacheState | undefined
  >;
  if (!g[GLOBAL_CACHE_KEY]) {
    const initialStamp = readCrossWorkerVersionStamp();
    g[GLOBAL_CACHE_KEY] = {
      version: initialStamp > 0 ? initialStamp : Date.now(),
      campaignCache: new Map<string, CachedCampaignEntry>(),
      inFlightCampaignLoads: new Map<string, Promise<unknown>>(),
      knownCampaignSlugs: new Set<string>(['cairo-opening']),
      pendingInvalidations: new Map<string | number, Set<() => void>>(),
      fallbackTimers: new Map<string | number, ReturnType<typeof setTimeout>>(),
    };
  }
  return g[GLOBAL_CACHE_KEY];
}

/**
 * Returns the current monotonic cache version across the Node.js process and workers.
 * Automatically reconciles with the cross-worker version stamp if another route bundle
 * or CLI seeder invalidated the cache.
 */
export function getDrinkRewardsCacheVersion(): number {
  const state = getGlobalCacheState();
  const sharedVersion = readCrossWorkerVersionStamp();
  if (sharedVersion > state.version) {
    state.version = sharedVersion;
    state.campaignCache.clear();
    state.inFlightCampaignLoads.clear();
  }
  return state.version;
}

/**
 * Increments the global monotonic cache version and purges in-memory campaign snapshots
 * so normal page reloads and step transitions immediately reflect mutations without hard reload.
 */
export function bumpDrinkRewardsCacheVersion(): number {
  const state = getGlobalCacheState();
  const sharedVersion = readCrossWorkerVersionStamp();
  const baseVersion = Math.max(state.version, sharedVersion, Date.now());
  const nextVersion = baseVersion + 1;

  state.version = nextVersion;
  state.campaignCache.clear();
  state.inFlightCampaignLoads.clear();
  writeCrossWorkerVersionStamp(nextVersion);

  return state.version;
}

/**
 * Event-driven, zero-TTL in-memory campaign cache loader with single-flight request deduplication.
 * - Returns cached campaign snapshot in <0.001ms with 0 DB queries when version matches.
 * - Deduplicates concurrent loads for the same slug so cache misses only hit PostgreSQL once.
 * - Protects against pre-commit race conditions by verifying version stability before storing.
 */
export async function getOrLoadCachedCampaign<T>(
  slug: string,
  loader: () => Promise<T>,
  options?: { bypassCache?: boolean },
): Promise<T> {
  const normalizedSlug = slug.trim().toLowerCase();
  const state = getGlobalCacheState();
  const currentVersion = getDrinkRewardsCacheVersion();
  state.knownCampaignSlugs.add(normalizedSlug);

  if (!options?.bypassCache) {
    const cached = state.campaignCache.get(normalizedSlug);
    if (cached && cached.version === currentVersion) {
      return cached.data as T;
    }

    const inFlight = state.inFlightCampaignLoads.get(normalizedSlug);
    if (inFlight) {
      return inFlight as Promise<T>;
    }
  }

  const versionAtStart = getDrinkRewardsCacheVersion();
  let loadPromise: Promise<T> | undefined;
  loadPromise = (async () => {
    try {
      const freshData = await loader();
      const versionAtFinish = getDrinkRewardsCacheVersion();

      if (freshData !== null && freshData !== undefined) {
        if (options?.bypassCache || versionAtFinish === versionAtStart) {
          state.campaignCache.set(normalizedSlug, {
            version: versionAtFinish,
            data: freshData,
          });
        }
      } else {
        state.campaignCache.delete(normalizedSlug);
      }

      return freshData;
    } finally {
      if (state.inFlightCampaignLoads.get(normalizedSlug) === loadPromise) {
        state.inFlightCampaignLoads.delete(normalizedSlug);
      }
    }
  })();

  if (!options?.bypassCache) {
    state.inFlightCampaignLoads.set(normalizedSlug, loadPromise);
  }

  return loadPromise;
}

/**
 * Safe tag revalidation:
 * Isolates individual tag execution so an error on one tag does not abort remaining tags.
 * Safely catches calls made outside Next.js request contexts (e.g. CLI, Worker, post-commit timer).
 */
export function safeRevalidateTag(tag: string): void {
  try {
    revalidateTag(tag);
  } catch {
    // Expected when invoked outside a synchronous Next.js route/action AsyncLocalStorage context
  }
}

/**
 * Safe path revalidation:
 * Purges Next.js full route cache for public campaign URLs.
 */
export function safeRevalidatePath(pathStr: string, type?: 'page' | 'layout'): void {
  try {
    revalidatePath(pathStr, type);
  } catch {
    // Expected when invoked outside a synchronous Next.js route/action AsyncLocalStorage context
  }
}

function revalidateSingleCampaignPaths(slug: string): void {
  safeRevalidatePath(`/drink-rewards/${slug}`, 'layout');
  safeRevalidatePath(`/drink-rewards/${slug}`, 'page');
  safeRevalidatePath(`/drink-rewards/${slug}/verify`, 'page');
  safeRevalidatePath(`/drink-rewards/${slug}/choose-drink`, 'page');
  safeRevalidatePath(`/drink-rewards/${slug}/success`, 'page');
}

/**
 * Purges all public Drink Rewards routes & layouts (both dynamic pattern and all known slugs)
 * so step transitions and normal reloads always render fresh server data.
 */
export function revalidateAllDrinkRewardsRoutes(
  campaignSlug?: string,
  previousSlug?: string,
): void {
  const state = getGlobalCacheState();

  safeRevalidatePath('/drink-rewards', 'layout');
  safeRevalidatePath('/drink-rewards/[slug]', 'layout');
  safeRevalidatePath('/drink-rewards/[slug]', 'page');
  safeRevalidatePath('/drink-rewards/[slug]/verify', 'page');
  safeRevalidatePath('/drink-rewards/[slug]/choose-drink', 'page');
  safeRevalidatePath('/drink-rewards/[slug]/success', 'page');

  if (campaignSlug) {
    const clean = campaignSlug.trim().toLowerCase();
    state.knownCampaignSlugs.add(clean);
    revalidateSingleCampaignPaths(clean);
  }

  if (previousSlug && previousSlug !== campaignSlug) {
    revalidateSingleCampaignPaths(previousSlug.trim().toLowerCase());
  }

  for (const knownSlug of state.knownCampaignSlugs) {
    if (knownSlug !== campaignSlug && knownSlug !== previousSlug) {
      revalidateSingleCampaignPaths(knownSlug);
    }
  }
}

/**
 * Check if a transaction has pending invalidations registered
 */
export function hasPendingInvalidations(transactionID: string | number): boolean {
  const { pendingInvalidations } = getGlobalCacheState();
  const set = pendingInvalidations.get(transactionID);
  return Boolean(set && set.size > 0);
}

function clearFallbackTimer(id: string | number): void {
  const { fallbackTimers } = getGlobalCacheState();
  const timer = fallbackTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    fallbackTimers.delete(id);
  }
}

function registerCallback(id: string | number, fn: () => void): void {
  const { pendingInvalidations, fallbackTimers } = getGlobalCacheState();
  let set = pendingInvalidations.get(id);
  if (!set) {
    set = new Set();
    pendingInvalidations.set(id, set);
  }
  set.add(fn);

  // Fail-safe auto-flush if commitTransaction hook is bypassed by an external caller
  if (!fallbackTimers.has(id)) {
    const timer = setTimeout(() => {
      fallbackTimers.delete(id);
      if (pendingInvalidations.has(id)) {
        executePostCommitInvalidations(id);
      }
    }, 800);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
    fallbackTimers.set(id, timer);
  }
}

/**
 * Dual-Phase Cache Invalidation:
 * 1. Immediate Phase: Bumps version & executes Next.js tag/path revalidation synchronously
 *    while Next.js request AsyncLocalStorage context is active.
 * 2. Post-Commit Phase: Re-bumps version & evicts any pre-commit reads strictly after
 *    PostgreSQL transaction COMMIT completes.
 */
export function queuePostCommitInvalidation(
  transactionID: TransactionID | undefined,
  fn: () => void,
): void {
  const wrappedFn = () => {
    bumpDrinkRewardsCacheVersion();
    fn();
  };

  // Phase 1: Always invalidate synchronously while inside the active request hook
  try {
    wrappedFn();
  } catch (err) {
    console.warn('[Cache] Immediate invalidation error:', err);
  }

  if (!transactionID) {
    return;
  }

  // Phase 2: Also queue post-commit eviction to clear any concurrent pre-commit reads
  if (transactionID instanceof Promise) {
    transactionID
      .then((resolvedId) => {
        if (resolvedId !== undefined && resolvedId !== null) {
          registerCallback(resolvedId, wrappedFn);
        } else {
          wrappedFn();
        }
      })
      .catch(() => {
        try {
          wrappedFn();
        } catch {
          // Ignore fallback error
        }
      });
    return;
  }

  registerCallback(transactionID, wrappedFn);
}

/**
 * Executes all pending invalidations for a committed transaction.
 */
export function executePostCommitInvalidations(transactionID: string | number): void {
  clearFallbackTimer(transactionID);
  const { pendingInvalidations } = getGlobalCacheState();
  const set = pendingInvalidations.get(transactionID);
  if (set) {
    try {
      for (const fn of set) {
        try {
          fn();
        } catch (err) {
          console.warn(`[Cache] Post-commit callback error for tx ${transactionID}:`, err);
        }
      }
    } finally {
      pendingInvalidations.delete(transactionID);
    }
  }
}

/**
 * Discards pending invalidations for a confirmed rolled-back transaction,
 * and bumps version once more so any uncommitted read during the transaction is evicted.
 */
export function discardPostCommitInvalidations(transactionID: string | number): void {
  clearFallbackTimer(transactionID);
  const { pendingInvalidations } = getGlobalCacheState();
  pendingInvalidations.delete(transactionID);
  bumpDrinkRewardsCacheVersion();
}

/**
 * Revalidates cache tags & routes when a Drink Category is created, updated, or deleted.
 */
export function revalidateDrinkCategoryCache(
  categoryId: string | number,
  _categorySlug?: string,
  transactionID?: TransactionID,
): void {
  queuePostCommitInvalidation(transactionID, () => {
    safeRevalidateTag(DRINK_CACHE_TAGS.categories);
    safeRevalidateTag(DRINK_CACHE_TAGS.category(categoryId));
    safeRevalidateTag(DRINK_CACHE_TAGS.campaigns);
    safeRevalidateTag(DRINK_CACHE_TAGS.drinks);
    revalidateAllDrinkRewardsRoutes();
  });
}

/**
 * Revalidates cache tags & routes when a Drink item is created, updated, or deleted.
 */
export function revalidateDrinkItemCache(
  drinkId: string | number,
  categoryId?: string | number,
  transactionID?: TransactionID,
  previousCategoryId?: string | number,
): void {
  queuePostCommitInvalidation(transactionID, () => {
    safeRevalidateTag(DRINK_CACHE_TAGS.drinks);
    safeRevalidateTag(DRINK_CACHE_TAGS.drink(drinkId));
    if (categoryId) {
      safeRevalidateTag(DRINK_CACHE_TAGS.category(categoryId));
    }
    if (previousCategoryId && previousCategoryId !== categoryId) {
      safeRevalidateTag(DRINK_CACHE_TAGS.category(previousCategoryId));
    }
    safeRevalidateTag(DRINK_CACHE_TAGS.campaigns);
    revalidateAllDrinkRewardsRoutes();
  });
}

/**
 * Revalidates cache tags and public route path when a Campaign is updated or toggled.
 */
export function revalidateDrinkCampaignCache(
  campaignSlug: string,
  transactionID?: TransactionID,
  previousSlug?: string,
): void {
  queuePostCommitInvalidation(transactionID, () => {
    safeRevalidateTag(DRINK_CACHE_TAGS.campaigns);
    safeRevalidateTag(DRINK_CACHE_TAGS.campaign(campaignSlug));
    safeRevalidateTag(DRINK_CACHE_TAGS.menu(campaignSlug));

    if (previousSlug && previousSlug !== campaignSlug) {
      safeRevalidateTag(DRINK_CACHE_TAGS.campaign(previousSlug));
      safeRevalidateTag(DRINK_CACHE_TAGS.menu(previousSlug));
    }

    revalidateAllDrinkRewardsRoutes(campaignSlug, previousSlug);
  });
}

/**
 * Revalidates branches list cache & routes when any Branch is created, renamed, toggled, or deleted.
 */
export function revalidateBranchesCache(transactionID?: TransactionID): void {
  queuePostCommitInvalidation(transactionID, () => {
    safeRevalidateTag(DRINK_CACHE_TAGS.branches);
    safeRevalidateTag(DRINK_CACHE_TAGS.campaigns);
    revalidateAllDrinkRewardsRoutes();
  });
}
