export interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds?: number;
}

export class RateLimiter {
  private cache = new Map<string, number[]>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodically purge stale entries to prevent unbounded memory growth
    // under high-traffic conditions with many unique IPs
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);

    // Allow the Node.js process to exit even if the timer is still active
    if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  async checkRateLimit(
    key: string,
    options?: { windowSeconds?: number; maxRequests?: number }
  ): Promise<RateLimitResult> {
    if (process.env.DISABLE_RATE_LIMIT === 'true') {
      return { limited: false };
    }
    const now = Date.now();
    const windowMs = (options?.windowSeconds || Number(process.env.RATE_LIMIT_WINDOW_SECONDS) || 60) * 1000;
    const maxRequests = options?.maxRequests || Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 5;

    let timestamps = this.cache.get(key) || [];

    // Filter out timestamps older than the sliding window
    timestamps = timestamps.filter((time) => now - time < windowMs);

    if (timestamps.length >= maxRequests) {
      const oldestValid = timestamps[0];
      const timePassed = now - oldestValid;
      const retryAfterSeconds = Math.ceil((windowMs - timePassed) / 1000);
      return {
        limited: true,
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
      };
    }

    timestamps.push(now);
    this.cache.set(key, timestamps);

    return {
      limited: false,
    };
  }

  /**
   * Purges stale entries whose timestamps have all expired outside the sliding window.
   * Prevents unbounded memory growth from accumulating unique IP addresses.
   */
  private cleanup(): void {
    const now = Date.now();
    const windowMs = (Number(process.env.RATE_LIMIT_WINDOW_SECONDS) || 60) * 1000;

    for (const [ip, timestamps] of this.cache) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        this.cache.delete(ip);
      } else {
        this.cache.set(ip, valid);
      }
    }
  }

  /**
   * Resets the cache (primarily used in automated tests).
   */
  reset(): void {
    this.cache.clear();
  }

  /**
   * Stops the cleanup timer (useful for graceful shutdown or tests).
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

export const rateLimiter = new RateLimiter();
