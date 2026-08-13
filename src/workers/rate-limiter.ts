/**
 * Adaptive Rate Limiter — Intelligent Throttling
 *
 * Prevents robotic traffic patterns by:
 * 1. Randomized delays between messages (2-8 seconds with jitter)
 * 2. Variable batch patterns (1 msg → delay → 2 msgs → delay → 1 msg)
 * 3. Adaptive slowdown when provider returns 429/timeout/busy
 * 4. Gradual recovery back to base rate after sustained success
 * 5. Backpressure when provider latency exceeds threshold
 */

export class AdaptiveRateLimiter {
  private baseRatePerMinute: number;
  private requiresHumanDelay: boolean;
  private effectiveRateMultiplier = 1.0;
  private messagesSentInBurst = 0;
  private burstTarget = 1;
  private recentLatencies: number[] = [];
  private readonly maxLatencySamples = 50;
  private readonly latencyThresholdMs = 5_000;
  private consecutiveSuccesses = 0;
  private readonly recoveryThreshold = 10;

  constructor(options?: { ratePerMinute?: number; requiresHumanDelay?: boolean }) {
    this.baseRatePerMinute = options?.ratePerMinute
      || Number(process.env.NOTIFICATION_RATE_LIMIT_PER_MINUTE) || 20;
    this.requiresHumanDelay = options?.requiresHumanDelay ?? true;
    this.randomizeBurstTarget();
  }

  private nextAllowedSendTime = Date.now();

  /**
   * Acquire a send slot. Blocks with a randomized delay if requiresHumanDelay is true.
   * Must be called before each provider.send() call.
   */
  async acquire(): Promise<void> {
    // If provider does not require human simulation delays (e.g. SMS Misr), bypass artificial delay
    if (!this.requiresHumanDelay) {
      const now = Date.now();
      const scheduledTime = Math.max(now, this.nextAllowedSendTime);
      const effectiveRate = this.getEffectiveRate();
      const delayMs = effectiveRate > 0 ? Math.round(60_000 / effectiveRate) : 0;
      
      this.nextAllowedSendTime = scheduledTime + delayMs;
      const waitTime = scheduledTime - now;
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
      return;
    }

    const now = Date.now();
    const scheduledTime = Math.max(now, this.nextAllowedSendTime);

    this.messagesSentInBurst++;
    let delayMs = 0;

    if (this.messagesSentInBurst >= this.burstTarget) {
      // Burst complete — apply delay with jitter
      const baseDelayMs = this.calculateBaseDelay();
      const jitter = this.randomJitter(0.5, 1.5);
      delayMs = Math.round(baseDelayMs * jitter);

      // Reset burst and pick new random target
      this.messagesSentInBurst = 0;
      this.randomizeBurstTarget();
    } else {
      // Within burst — small inter-message delay with jitter
      delayMs = Math.round(200 + Math.random() * 800);
    }

    // Reserve the slot by advancing the allowed time
    this.nextAllowedSendTime = scheduledTime + delayMs;

    const waitTime = scheduledTime - now;
    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Record provider call latency for backpressure adjustment.
   */
  recordLatency(ms: number): void {
    this.recentLatencies.push(ms);
    if (this.recentLatencies.length > this.maxLatencySamples) {
      this.recentLatencies = this.recentLatencies.slice(-this.maxLatencySamples);
    }

    // If average latency exceeds threshold, slow down
    const avgLatency = this.recentLatencies.reduce((a, b) => a + b, 0) / this.recentLatencies.length;
    if (avgLatency > this.latencyThresholdMs) {
      this.effectiveRateMultiplier = Math.max(0.25, this.effectiveRateMultiplier * 0.8);
      console.log(`[RateLimiter] High latency detected (${Math.round(avgLatency)}ms avg). Reducing rate to ${Math.round(this.getEffectiveRate())}/min`);
    }
  }

  /**
   * Signal that the provider returned a throttle response (429/timeout/busy).
   * Immediately halves the effective rate.
   */
  recordThrottle(): void {
    this.effectiveRateMultiplier = Math.max(0.1, this.effectiveRateMultiplier * 0.5);
    this.consecutiveSuccesses = 0;
    console.log(`[RateLimiter] Throttle signal received. Rate reduced to ${Math.round(this.getEffectiveRate())}/min`);
  }

  /**
   * Record a successful send. After sustained success, gradually recover rate.
   */
  recordSuccess(): void {
    this.consecutiveSuccesses++;

    if (this.consecutiveSuccesses >= this.recoveryThreshold && this.effectiveRateMultiplier < 1.0) {
      this.effectiveRateMultiplier = Math.min(1.0, this.effectiveRateMultiplier * 1.1);
      this.consecutiveSuccesses = 0;

      if (this.effectiveRateMultiplier >= 0.99) {
        this.effectiveRateMultiplier = 1.0;
        console.log('[RateLimiter] Rate fully recovered to base');
      }
    }
  }

  /**
   * Get the current effective rate in messages per minute.
   */
  getEffectiveRate(): number {
    return this.baseRatePerMinute * this.effectiveRateMultiplier;
  }

  // ── Internal Helpers ───────────────────────────────────────────────

  private calculateBaseDelay(): number {
    const effectiveRate = this.getEffectiveRate();
    if (effectiveRate <= 0) return 10_000;

    // Convert rate to ms between sends
    const msPerMessage = (60_000 / effectiveRate) * this.burstTarget;

    // Add randomization: 2-8 seconds range
    return Math.max(2_000, Math.min(8_000, msPerMessage));
  }

  private randomizeBurstTarget(): void {
    // Random burst size: 1 or 2 messages
    this.burstTarget = Math.random() < 0.6 ? 1 : 2;
  }

  private randomJitter(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
}
