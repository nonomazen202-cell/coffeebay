/**
 * Health Monitor — Periodic Health Checks
 *
 * Runs every 60 seconds inside the worker process to evaluate and report
 * the health of the entire notification system, including:
 * - Provider API availability & connection status
 * - Queue metrics (queued, retry, dead-letter counts)
 * - Worker metrics (uptime, memory, database connection latency)
 * - Circuit breaker and Rate limiter status
 */

import { sql } from 'drizzle-orm';
import { getPayloadClient } from '../lib/payload';
import type { NotificationProvider } from '../services/notification-provider';
import type { SessionManager } from './session-manager';
import type { CircuitBreaker } from './circuit-breaker';
import type { AdaptiveRateLimiter } from './rate-limiter';


export interface HealthReport {
  timestamp: string;
  provider: {
    healthy: boolean;
    sessionConnected: boolean;
    phoneConnected: boolean;
    details: Record<string, unknown>;
  };
  worker: {
    workerId: string;
    uptime: number;
    memoryUsageMb: number;
  };
  queue: {
    queued: number;
    locked: number;
    sending: number;
    retryScheduled: number;
    deadLetter: number;
    total: number;
  };
  database: {
    connected: boolean;
    latencyMs: number;
  };
  circuitBreaker: string;
  rateLimiter: {
    effectiveRate: number;
    baseRate: number;
  };
}

export class HealthMonitor {
  private provider: NotificationProvider;
  private sessionManager: SessionManager;
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: AdaptiveRateLimiter;
  private workerId: string;
  private startTime: number;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    provider: NotificationProvider,
    sessionManager: SessionManager,
    circuitBreaker: CircuitBreaker,
    rateLimiter: AdaptiveRateLimiter,
    workerId: string,
  ) {
    this.provider = provider;
    this.sessionManager = sessionManager;
    this.circuitBreaker = circuitBreaker;
    this.rateLimiter = rateLimiter;
    this.workerId = workerId;
    this.startTime = Date.now();
  }

  /**
   * Start periodic health checks.
   */
  start(intervalMs: number = 60_000): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(async () => {
      try {
        const report = await this.generateReport();
        this.logReport(report);

        // Auto-recover/sync session if provider is offline or if manager's internal state is desynced
        const isSessionConnected = report.provider.sessionConnected;
        const currentSessionState = this.sessionManager.getState();

        if (!isSessionConnected || currentSessionState !== 'connected') {
          await this.sessionManager.checkAndRecover();
        }
      } catch (err) {
        console.error('[HealthMonitor] Health check loop exception:', err);
      }
    }, intervalMs);

    console.log(`[HealthMonitor] Periodic checks started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop periodic health checks.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[HealthMonitor] Periodic checks stopped');
    }
  }

  /**
   * Generates a comprehensive health report.
   */
  async generateReport(): Promise<HealthReport> {
    const payload = await getPayloadClient();

    // 1. Measure DB connection latency
    let dbConnected = false;
    let dbLatencyMs = -1;
    const dbStart = Date.now();
    try {
      await payload.db.drizzle.execute(sql`SELECT 1`);
      dbConnected = true;
      dbLatencyMs = Date.now() - dbStart;
    } catch (err) {
      console.error('[HealthMonitor] DB check failed:', err);
    }

    // 2. Fetch Queue Sizes
    const queueStats = { queued: 0, locked: 0, sending: 0, retryScheduled: 0, deadLetter: 0, total: 0 };
    if (dbConnected) {
      try {
        const counts = await payload.db.drizzle.execute(sql`
          SELECT status, count(*) as count
          FROM notifications
          GROUP BY status
        `);

        const rows = counts.rows as Array<{ status: string; count: string | number }>;
        for (const row of rows) {
          const count = Number(row.count);
          queueStats.total += count;
          if (row.status === 'queued') queueStats.queued = count;
          else if (row.status === 'locked') queueStats.locked = count;
          else if (row.status === 'sending') queueStats.sending = count;
          else if (row.status === 'retry-scheduled') queueStats.retryScheduled = count;
          else if (row.status === 'dead-letter') queueStats.deadLetter = count;
        }
      } catch (err) {
        console.error('[HealthMonitor] Queue metrics fetch failed:', err);
      }
    }

    // 3. Provider Health Check
    let providerHealth = { healthy: false, sessionConnected: false, phoneConnected: false, details: {} };
    try {
      const ph = await this.provider.checkHealth();
      providerHealth = {
        healthy: ph.healthy,
        sessionConnected: ph.sessionConnected,
        phoneConnected: ph.phoneConnected,
        details: ph.details,
      };
    } catch (err) {
      console.error('[HealthMonitor] Provider check failed:', err);
    }

    // 4. Memory Metrics
    const memoryUsage = process.memoryUsage();
    const memoryUsageMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);

    return {
      timestamp: new Date().toISOString(),
      provider: providerHealth,
      worker: {
        workerId: this.workerId,
        uptime: Math.round((Date.now() - this.startTime) / 1000),
        memoryUsageMb,
      },
      queue: queueStats,
      database: {
        connected: dbConnected,
        latencyMs: dbLatencyMs,
      },
      circuitBreaker: this.circuitBreaker.getState(),
      rateLimiter: {
        effectiveRate: this.rateLimiter.getEffectiveRate(),
        baseRate: Number(process.env.NOTIFICATION_RATE_LIMIT_PER_MINUTE) || 20,
      },
    };
  }

  private logReport(report: HealthReport): void {
    console.log(`[HealthReport] Worker ID: ${report.worker.workerId} | Status: ${report.provider.sessionConnected ? '🟢 CONNECTED' : '🔴 DISCONNECTED'}`);
    console.log(`  Uptime: ${report.worker.uptime}s | Memory: ${report.worker.memoryUsageMb}MB | DB Latency: ${report.database.latencyMs}ms`);
    console.log(`  Queue Stats: Queued=${report.queue.queued} | Retry=${report.queue.retryScheduled} | DLQ=${report.queue.deadLetter} | Active Sending=${report.queue.sending}`);
    console.log(`  Circuit Breaker: ${report.circuitBreaker.toUpperCase()} | Effective Rate: ${report.rateLimiter.effectiveRate}/min`);
    if (report.queue.deadLetter > 0) {
      console.warn(`  🚨 ALERT: Dead Letter Queue size is ${report.queue.deadLetter}! Operator inspection advised.`);
    }
  }
}
