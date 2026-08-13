import { monitorEventLoopDelay, type IntervalHistogram } from 'node:perf_hooks';
import { performance } from 'node:perf_hooks';

// ─── Step Timing ─────────────────────────────────────────────────────────
interface StepRecord {
  start: number;
  end: number;
}

/**
 * Per-request timer that tracks the duration of each named step.
 * Create one per request, call startStep/endStep, then pass to telemetry.recordRequest().
 */
export class RequestTimer {
  private steps: Map<string, StepRecord> = new Map();
  readonly enteredAt: number;

  constructor() {
    this.enteredAt = performance.now();
  }

  startStep(name: string): void {
    this.steps.set(name, { start: performance.now(), end: 0 });
  }

  endStep(name: string): number {
    const step = this.steps.get(name);
    if (!step) return 0;
    step.end = performance.now();
    return step.end - step.start;
  }

  /** Returns all step durations in ms */
  getStepDurations(): Map<string, number> {
    const result = new Map<string, number>();
    for (const [name, record] of this.steps) {
      if (record.end > 0) {
        result.set(name, record.end - record.start);
      }
    }
    return result;
  }

  getTotalDuration(): number {
    return performance.now() - this.enteredAt;
  }
}

// ─── Aggregated Step Statistics ──────────────────────────────────────────
interface StepStats {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  values: number[];
}

// ─── Telemetry Service ──────────────────────────────────────────────────
class TelemetryService {
  private enabled = false;
  private activeRequests = 0;
  private peakActiveRequests = 0;
  private totalEntered = 0;
  private totalCompleted = 0;
  private stepAggregates: Map<string, StepStats> = new Map();
  private totalDurations: number[] = [];
  private eventLoopMonitor: IntervalHistogram | null = null;

  /**
   * Activates telemetry. Call once at app startup or before a test.
   * Controlled by ENABLE_TELEMETRY=true env var.
   */
  initialize(): void {
    if (process.env.ENABLE_TELEMETRY !== 'true') return;

    this.enabled = true;
    this.reset();

    // Start event loop lag monitoring (20ms resolution)
    this.eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });
    this.eventLoopMonitor.enable();

    console.log('🔬 [Telemetry] Initialized — server-side measurements active');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Called when a request enters the route handler.
   * Returns a RequestTimer for tracking step durations.
   */
  onRequestEnter(): RequestTimer {
    if (!this.enabled) return new RequestTimer();

    this.totalEntered++;
    this.activeRequests++;
    if (this.activeRequests > this.peakActiveRequests) {
      this.peakActiveRequests = this.activeRequests;
    }

    // Log milestone every 100 requests
    if (this.totalEntered % 100 === 0) {
      console.log(
        `🔬 [Telemetry] Entered: ${this.totalEntered} | Active: ${this.activeRequests} | Peak: ${this.peakActiveRequests}`
      );
    }

    return new RequestTimer();
  }

  /**
   * Called when a request completes (success or error).
   * Records all step timings from the RequestTimer.
   */
  onRequestComplete(timer: RequestTimer): void {
    if (!this.enabled) return;

    this.activeRequests--;
    this.totalCompleted++;

    // Record total duration
    this.totalDurations.push(timer.getTotalDuration());

    // Aggregate step timings
    const steps = timer.getStepDurations();
    for (const [stepName, durationMs] of steps) {
      let stats = this.stepAggregates.get(stepName);
      if (!stats) {
        stats = { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0, values: [] };
        this.stepAggregates.set(stepName, stats);
      }
      stats.count++;
      stats.totalMs += durationMs;
      if (durationMs < stats.minMs) stats.minMs = durationMs;
      if (durationMs > stats.maxMs) stats.maxMs = durationMs;
      stats.values.push(durationMs);
    }
  }

  /**
   * Prints a complete telemetry summary.
   * Call after all requests have completed (e.g., from a test endpoint).
   */
  printSummary(): void {
    if (!this.enabled) {
      console.log('🔬 [Telemetry] Not enabled. Set ENABLE_TELEMETRY=true to activate.');
      return;
    }

    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║              🔬 SERVER-SIDE TELEMETRY REPORT               ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    // ─── Request Counts ──────────────────────────────────────────────
    console.log('\n📊 Request Counts:');
    console.log(`  Total entered handler  : ${this.totalEntered}`);
    console.log(`  Total completed        : ${this.totalCompleted}`);
    console.log(`  Still active           : ${this.activeRequests}`);
    console.log(`  Peak concurrent        : ${this.peakActiveRequests}`);

    // ─── Total Request Duration ──────────────────────────────────────
    if (this.totalDurations.length > 0) {
      const sorted = [...this.totalDurations].sort((a, b) => a - b);
      const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      const p50 = sorted[Math.floor(sorted.length * 0.50)] ?? 0;
      const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
      const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;

      console.log('\n⏱️  Total Request Duration (handler entry → handler exit):');
      console.log(`  Avg : ${avg.toFixed(1)}ms`);
      console.log(`  P50 : ${p50.toFixed(1)}ms`);
      console.log(`  P95 : ${p95.toFixed(1)}ms`);
      console.log(`  P99 : ${p99.toFixed(1)}ms`);
      console.log(`  Min : ${sorted[0].toFixed(1)}ms`);
      console.log(`  Max : ${sorted[sorted.length - 1].toFixed(1)}ms`);
    }

    // ─── Per-Step Breakdown ──────────────────────────────────────────
    if (this.stepAggregates.size > 0) {
      console.log('\n📐 Per-Step Timing Breakdown:');
      console.log(`  ${'Step'.padEnd(30)} ${'Count'.padStart(6)} ${'Avg'.padStart(10)} ${'P95'.padStart(10)} ${'Max'.padStart(10)}`);
      console.log(`  ${'─'.repeat(30)} ${'─'.repeat(6)} ${'─'.repeat(10)} ${'─'.repeat(10)} ${'─'.repeat(10)}`);

      // Sort steps by average duration descending (slowest first)
      const entries = Array.from(this.stepAggregates.entries());
      entries.sort((a, b) => (b[1].totalMs / b[1].count) - (a[1].totalMs / a[1].count));

      for (const [name, stats] of entries) {
        const avg = stats.totalMs / stats.count;
        const sorted = [...stats.values].sort((a, b) => a - b);
        const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? stats.maxMs;

        console.log(
          `  ${name.padEnd(30)} ${stats.count.toString().padStart(6)} ${(avg.toFixed(1) + 'ms').padStart(10)} ${(p95.toFixed(1) + 'ms').padStart(10)} ${(stats.maxMs.toFixed(1) + 'ms').padStart(10)}`
        );
      }
    }

    // ─── Event Loop Lag ──────────────────────────────────────────────
    if (this.eventLoopMonitor) {
      // IntervalHistogram values are in nanoseconds
      const toMs = (ns: number): string => (ns / 1_000_000).toFixed(1);
      console.log('\n🔄 Event Loop Lag:');
      console.log(`  P50  : ${toMs(this.eventLoopMonitor.percentile(50))}ms`);
      console.log(`  P95  : ${toMs(this.eventLoopMonitor.percentile(95))}ms`);
      console.log(`  P99  : ${toMs(this.eventLoopMonitor.percentile(99))}ms`);
      console.log(`  Max  : ${toMs(this.eventLoopMonitor.max)}ms`);
      console.log(`  Mean : ${toMs(this.eventLoopMonitor.mean)}ms`);
    }

    console.log('\n══════════════════════════════════════════════════════════════');
  }

  /** Resets all counters for a fresh measurement. */
  reset(): void {
    this.activeRequests = 0;
    this.peakActiveRequests = 0;
    this.totalEntered = 0;
    this.totalCompleted = 0;
    this.stepAggregates.clear();
    this.totalDurations = [];

    if (this.eventLoopMonitor) {
      this.eventLoopMonitor.disable();
      this.eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });
      this.eventLoopMonitor.enable();
    }
  }
}

/** Singleton telemetry instance shared across route and services */
export const telemetry = new TelemetryService();
