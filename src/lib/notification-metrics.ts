/**
 * Notification Metrics — In-Memory Counters & Timings
 *
 * Tracks notification lifecycle events, send durations,
 * throughput, and circuit breaker activity.
 *
 * Exposed via structured logs and toJSON() for future API endpoints.
 */

export class NotificationMetrics {
  // ── Counters ────────────────────────────────────────────────────────

  queued = 0;
  sending = 0;
  sent = 0;
  delivered = 0;
  read = 0;
  retryScheduled = 0;
  deadLetter = 0;
  failed = 0;
  expired = 0;
  duplicatesSkipped = 0;

  // ── Timings ─────────────────────────────────────────────────────────

  private sendDurations: number[] = [];
  private readonly maxDurationSamples = 1000;

  // ── Throughput ──────────────────────────────────────────────────────

  private sentTimestamps: number[] = [];
  private readonly throughputWindowMs = 60_000;

  // ── Circuit Breaker ────────────────────────────────────────────────

  circuitBreakerTrips = 0;

  // ── Recording Methods ──────────────────────────────────────────────

  recordQueued(): void {
    this.queued++;
  }

  recordSend(durationMs: number): void {
    this.sent++;
    this.sendDurations.push(durationMs);
    this.sentTimestamps.push(Date.now());

    // Cap sample size
    if (this.sendDurations.length > this.maxDurationSamples) {
      this.sendDurations = this.sendDurations.slice(-this.maxDurationSamples);
    }

    // Clean old throughput samples
    const cutoff = Date.now() - this.throughputWindowMs;
    this.sentTimestamps = this.sentTimestamps.filter((t) => t >= cutoff);
  }

  recordFailure(): void {
    this.failed++;
  }

  recordRetry(): void {
    this.retryScheduled++;
  }

  recordDeadLetter(): void {
    this.deadLetter++;
  }

  recordDelivery(): void {
    this.delivered++;
  }

  recordRead(): void {
    this.read++;
  }

  recordExpired(): void {
    this.expired++;
  }

  recordDuplicateSkipped(): void {
    this.duplicatesSkipped++;
  }

  recordCircuitBreakerTrip(): void {
    this.circuitBreakerTrips++;
  }

  // ── Computed Metrics ───────────────────────────────────────────────

  get avgSendDurationMs(): number {
    if (this.sendDurations.length === 0) return 0;
    const sum = this.sendDurations.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.sendDurations.length);
  }

  get p95SendDurationMs(): number {
    if (this.sendDurations.length === 0) return 0;
    const sorted = [...this.sendDurations].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, index)];
  }

  get messagesPerMinute(): number {
    const cutoff = Date.now() - this.throughputWindowMs;
    const recent = this.sentTimestamps.filter((t) => t >= cutoff);
    return recent.length;
  }

  // ── Reporting ──────────────────────────────────────────────────────

  printSummary(): void {
    console.log('\n═══════════════════════════════════════════');
    console.log('  NOTIFICATION METRICS SUMMARY');
    console.log('═══════════════════════════════════════════');
    console.log(`  Queued:             ${this.queued}`);
    console.log(`  Sent:               ${this.sent}`);
    console.log(`  Delivered:          ${this.delivered}`);
    console.log(`  Read:               ${this.read}`);
    console.log(`  Retry Scheduled:    ${this.retryScheduled}`);
    console.log(`  Dead Letter:        ${this.deadLetter}`);
    console.log(`  Failed:             ${this.failed}`);
    console.log(`  Expired:            ${this.expired}`);
    console.log(`  Duplicates Skipped: ${this.duplicatesSkipped}`);
    console.log('───────────────────────────────────────────');
    console.log(`  Avg Send Duration:  ${this.avgSendDurationMs}ms`);
    console.log(`  P95 Send Duration:  ${this.p95SendDurationMs}ms`);
    console.log(`  Throughput:         ${this.messagesPerMinute} msg/min`);
    console.log(`  CB Trips:           ${this.circuitBreakerTrips}`);
    console.log('═══════════════════════════════════════════\n');
  }

  toJSON(): Record<string, number> {
    return {
      queued: this.queued,
      sending: this.sending,
      sent: this.sent,
      delivered: this.delivered,
      read: this.read,
      retryScheduled: this.retryScheduled,
      deadLetter: this.deadLetter,
      failed: this.failed,
      expired: this.expired,
      duplicatesSkipped: this.duplicatesSkipped,
      avgSendDurationMs: this.avgSendDurationMs,
      p95SendDurationMs: this.p95SendDurationMs,
      messagesPerMinute: this.messagesPerMinute,
      circuitBreakerTrips: this.circuitBreakerTrips,
    };
  }
}

export const notificationMetrics = new NotificationMetrics();
