import './env-loader';
import crypto from 'crypto';
import { sql } from 'drizzle-orm';
import { createNotificationProvider } from '../services/notification-provider';
import { SessionManager } from './session-manager';
import { CircuitBreaker } from './circuit-breaker';
import { AdaptiveRateLimiter } from './rate-limiter';
import { RecoveryService } from './recovery-service';
import { HealthMonitor } from './health-monitor';
import { notificationMetrics } from '../lib/notification-metrics';
import { getCachedAdminPhone } from '../services/settings-cache';
import { validateAndNormalizePhone } from '../lib/validators/phone-validator';

const maskPhone = (p: string) => {
  if (p.length <= 6) return p;
  return p.substring(0, 6) + '*'.repeat(p.length - 8) + p.substring(p.length - 2);
};

// Set flag to bypass in-process worker initialization if imported elsewhere
process.env.DISABLE_NOTIFICATION_WORKER = 'true';

interface NotificationQueryResult {
  id: number;
  phone: string;
  template: string;
  payload: string | Record<string, unknown>;
  message: string;
  attempts: number;
  max_attempts: number;
  priority: number;
  expires_at: string | null;
  idempotency_key: string;
}

async function bootstrap() {
  console.log('[Worker] Starting notification queue daemon...');
  const { getPayloadClient } = await import('../lib/payload');
  const payload = await getPayloadClient();

  const workerId = `worker-${crypto.randomUUID()}`;
  console.log(`[Worker] Worker ID: ${workerId}`);

  // ─── Initialize Worker Infrastructure ─────────────────────────────────
  const provider = createNotificationProvider();
  await provider.initialize();

  const sessionManager = new SessionManager(provider);
  await sessionManager.ensureConnected();

  const circuitBreaker = new CircuitBreaker();
  const rateLimiter = new AdaptiveRateLimiter({
    ratePerMinute: provider.capabilities.defaultRateLimitPerMinute,
    requiresHumanDelay: provider.capabilities.requiresHumanDelay,
  });

  // Run crash/power-failure recovery on startup
  const recoveryService = new RecoveryService(workerId);
  await recoveryService.recover();

  const healthMonitor = new HealthMonitor(provider, sessionManager, circuitBreaker, rateLimiter, workerId);
  healthMonitor.start();

  console.log('[Worker] Connected to PostgreSQL. Queue loop initialized.');

  const BATCH_SIZE = Number(process.env.NOTIFICATION_BATCH_SIZE) || 5;
  const POLL_INTERVAL_MS = Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS) || 3000;
  const LEASE_DURATION_MS = Number(process.env.WORKER_LEASE_DURATION_MS) || 300_000; // 5 minutes
  const HEARTBEAT_INTERVAL_MS = Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS) || 30_000;

  let isShuttingDown = false;
  let inFlightCount = 0;
  let lastHeartbeatAt = 0;
  let lastUserMessageSentAt = Date.now();
  let oldestAdminAlertCreatedAt: number | null = null;

  // ─── Update Worker Heartbeat ──────────────────────────────────────────
  async function updateHeartbeat() {
    if (Date.now() - lastHeartbeatAt < HEARTBEAT_INTERVAL_MS) return;
    lastHeartbeatAt = Date.now();
    try {
      // Use local API preference/KV or simple console check.
      // We can also store worker heartbeat directly in DB or log it.
      // This confirms worker is actively breathing.
      console.log(`[Worker] Heartbeat OK (Active in-flight tasks: ${inFlightCount})`);
    } catch (err) {
      console.error('[Worker] Heartbeat log failure:', err);
    }
  }

  // ─── Process Batch ────────────────────────────────────────────────────
  async function processBatch(): Promise<number> {
    if (isShuttingDown) return 0;

    await updateHeartbeat();

    // 0. Backpressure and circuit breaker checks
    if (circuitBreaker.isOpen()) {
      console.warn('[Worker] Circuit breaker is OPEN. Queue processing paused temporarily.');
      return 0;
    }

    if (sessionManager.shouldPause()) {
      console.warn('[Worker] Provider session disconnected or offline. Queue processing paused.');
      return 0;
    }

    let currentBatchSize = BATCH_SIZE;
    if (circuitBreaker.getState() === 'half-open') {
      currentBatchSize = 1;
      console.log('[Worker] Circuit breaker is HALF-OPEN. Forcing batch size to 1 for probe.');
    }

    // Phase 1: Atomic Row Selection & State Transition inside a single transaction
    // Lock using database row locking with priority ordering and TTL validation
    const lockedNotifications = await payload.db.drizzle.transaction(async (tx) => {
      const nowStr = new Date().toISOString();
      const leaseExpiryStr = new Date(Date.now() + LEASE_DURATION_MS).toISOString();

      // Lock due notifications: queued/retry-scheduled, not admin-alert, not expired, attempt counts remaining
      const selectResult = await tx.execute(sql`
        SELECT id, phone, template, payload, message, attempts, max_attempts, priority, expires_at, idempotency_key
        FROM notifications
        WHERE status IN ('queued', 'retry-scheduled')
          AND template != 'admin-alert'
          AND (expires_at IS NULL OR expires_at > NOW())
          AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
        ORDER BY priority DESC, created_at ASC
        LIMIT ${currentBatchSize}
        FOR UPDATE SKIP LOCKED
      `);

      const rows: NotificationQueryResult[] = (selectResult.rows as unknown as NotificationQueryResult[]) || [];
      if (rows.length === 0) {
        return [];
      }

      const ids = rows.map((r) => r.id);
      const idsPgArray = `{${ids.join(',')}}`;

      // Update state to 'locked' with worker lease details
      await tx.execute(sql`
        UPDATE notifications
        SET status = 'locked',
            locked_at = ${nowStr},
            locked_by = ${workerId},
            lease_expires_at = ${leaseExpiryStr}
        WHERE id = ANY(${idsPgArray}::int[])
      `);

      return rows;
    });

    if (lockedNotifications.length === 0) {
      return 0;
    }

    console.log(`[Worker] Locked ${lockedNotifications.length} notifications (Priority Batch)`);
    inFlightCount += lockedNotifications.length;

    // Phase 2: Concurrent message dispatch through the provider interface
    const dispatchPromises = lockedNotifications.map(async (notif) => {
      try {
        const nowStr = new Date().toISOString();

        // 1. Double check expiration before sending
        if (notif.expires_at && new Date(notif.expires_at) <= new Date()) {
          console.warn(`[Worker] Notification ${notif.id} expired in queue. Skipping send.`);
          
          await payload.db.drizzle.transaction(async (tx) => {
            const updateResult = await tx.execute(sql`
              UPDATE notifications
              SET status = 'failed',
                  last_error = 'Expired: TTL exceeded before delivery',
                  locked_at = NULL,
                  locked_by = NULL,
                  lease_expires_at = NULL
              WHERE id = ${notif.id} AND status = 'locked' AND locked_by = ${workerId}
            `);

            if ((updateResult.rowCount ?? 0) > 0) {
              await tx.execute(sql`
                INSERT INTO notification_audit (notification_id, from_status, to_status, actor, error, created_at, updated_at)
                VALUES (${notif.id}, 'locked', 'failed', ${workerId}, 'Expired: TTL exceeded before delivery', NOW(), NOW())
              `);
            }
          });
          
          notificationMetrics.recordExpired();
          return;
        }

        // 2. Perform duplicate check at send time (double-check guard)
        // Set status to 'sending' before starting provider call to enforce status check constraint
        await payload.db.drizzle.transaction(async (tx) => {
          const updateResult = await tx.execute(sql`
            UPDATE notifications
            SET status = 'sending',
                locked_at = NOW()
            WHERE id = ${notif.id} AND status = 'locked' AND locked_by = ${workerId}
          `);

          if ((updateResult.rowCount ?? 0) > 0) {
            await tx.execute(sql`
              INSERT INTO notification_audit (notification_id, from_status, to_status, actor, created_at, updated_at)
              VALUES (${notif.id}, 'locked', 'sending', ${workerId}, NOW(), NOW())
            `);
          }
        });

        // 3. Acquire Slot from Adaptive Rate Limiter (intelligent throttling)
        await rateLimiter.acquire();

        // 4. Send using provider-agnostic notification object
        const startTime = Date.now();
        console.log(`[Worker] Dispatching notification ${notif.id} to ${maskPhone(notif.phone)}...`);

        let parsedPayload = notif.payload;
        if (typeof parsedPayload === 'string') {
          try {
            parsedPayload = JSON.parse(parsedPayload);
          } catch {
            parsedPayload = { type: 'verification', variables: {} };
          }
        }

        const result = await provider.send({
          id: notif.id,
          phone: notif.phone,
          payload: parsedPayload as { type: 'verification' | 'winner-notification' | 'admin-alert'; variables: Record<string, string> },
          message: notif.message,
          idempotencyKey: notif.idempotency_key,
          priority: notif.priority,
          createdAt: nowStr,
          expiresAt: notif.expires_at,
        });

        const duration = Date.now() - startTime;
        rateLimiter.recordLatency(duration);

        if (result.success) {
          // Success Path: Status transition with strict WHERE guard
          await payload.db.drizzle.transaction(async (tx) => {
            const updateResult = await tx.execute(sql`
              UPDATE notifications
              SET status = ${result.status || 'sent'},
                  attempts = ${notif.attempts + 1},
                  sent_at = NOW(),
                  locked_at = NULL,
                  locked_by = NULL,
                  lease_expires_at = NULL,
                  provider_message_id = ${result.messageId || null},
                  provider_name = ${provider.name},
                  send_duration_ms = ${duration},
                  message = COALESCE(message, ${result.renderedMessage || null}),
                  delivery_payload = ${result.deliveryPayload ? JSON.stringify(result.deliveryPayload) : null}
              WHERE id = ${notif.id} AND status = 'sending'
            `);

            if ((updateResult.rowCount ?? 0) > 0) {
              await tx.execute(sql`
                INSERT INTO notification_audit (notification_id, from_status, to_status, actor, duration_ms, event_type, created_at, updated_at)
                VALUES (${notif.id}, 'sending', ${result.status || 'sent'}, ${workerId}, ${duration}, 'notification_transition', NOW(), NOW())
              `);
            }
          });

          rateLimiter.recordSuccess();
          circuitBreaker.recordSuccess();
          notificationMetrics.recordSend(duration);
          console.log(`[Worker] Notification ${notif.id} successfully sent. MessageID: ${result.messageId}`);
        } else {
          // Failure Path
          const errorMsg = result.error || 'Unknown dispatch error';
          await handleFailure(notif, errorMsg, result.retryable ?? false, result.deliveryPayload, result.renderedMessage);
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await handleFailure(notif, `Unexpected worker error: ${errMsg}`, true);
      } finally {
        inFlightCount--;
      }
    });

    await Promise.all(dispatchPromises);
    return lockedNotifications.length;
  }

  async function handleFailure(
    notif: NotificationQueryResult,
    errorMsg: string,
    retryable: boolean,
    deliveryPayload?: unknown,
    renderedMessage?: string
  ) {
    const attempts = notif.attempts + 1;
    console.error(`[Worker] Delivery failed for notification ${notif.id} to ${maskPhone(notif.phone)}: ${errorMsg} (Attempt ${attempts}/${notif.max_attempts})`);

    // Report feedback to circuit breaker and rate limiter
    circuitBreaker.recordFailure();
    if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('throttle') || errorMsg.toLowerCase().includes('busy')) {
      rateLimiter.recordThrottle();
    }

    if (!retryable || attempts >= notif.max_attempts) {
      const finalStatus = !retryable ? 'failed' : 'dead-letter';
      
      // Permanent failure or retry limit exhausted
      await payload.db.drizzle.transaction(async (tx) => {
        const updateResult = await tx.execute(sql`
          UPDATE notifications
          SET status = ${finalStatus},
              attempts = ${attempts},
              last_error = ${errorMsg},
              locked_at = NULL,
              locked_by = NULL,
              lease_expires_at = NULL,
              message = COALESCE(message, ${renderedMessage || null}),
              delivery_payload = ${deliveryPayload ? JSON.stringify(deliveryPayload) : null}
          WHERE id = ${notif.id} AND status = 'sending'
        `);

        if ((updateResult.rowCount ?? 0) > 0) {
          await tx.execute(sql`
            INSERT INTO notification_audit (notification_id, from_status, to_status, actor, error, event_type, created_at, updated_at)
            VALUES (${notif.id}, 'sending', ${finalStatus}, ${workerId}, ${errorMsg}, 'notification_transition', NOW(), NOW())
          `);
        }
      });

      if (finalStatus === 'dead-letter') {
        notificationMetrics.recordDeadLetter();
        console.error(`[Worker] Notification ${notif.id} moved to DEAD LETTER. Queue exhausted.`);

        // Queue DLQ Admin notification
        try {
          let adminPhone = await getCachedAdminPhone();
          if (!adminPhone) {
            adminPhone = process.env.WHATSAPP_ADMIN_PHONE || null;
          }

          if (adminPhone) {
            const adminMsg = `🚨 *DLQ ALERT:* Notification Job Permanently Failed (ID: ${notif.id})\nRecipient: ${notif.phone}\nError: ${errorMsg}`;
            await payload.create({
              collection: 'notifications',
              data: {
                phone: adminPhone,
                template: 'admin-alert',
                payload: { type: 'admin-alert', variables: { details: `DLQ ID ${notif.id}` } },
                message: adminMsg,
                status: 'queued',
                priority: 80,
                attempts: 0,
                maxAttempts: 3,
                idempotencyKey: `dlq-alert-${notif.id}`,
              },
            });
          }
        } catch (adminErr) {
          console.error('[Worker] Failed to queue DLQ admin alert:', adminErr);
        }
      } else {
        notificationMetrics.recordFailure();
      }
    } else {
      // Exponential Backoff with jitter
      let delayMs = 60 * 1000;
      if (attempts === 1) {
        delayMs = 1 * 60 * 1000;
      } else if (attempts === 2) {
        delayMs = 5 * 60 * 1000;
      } else if (attempts === 3) {
        delayMs = 30 * 60 * 1000;
      } else if (attempts === 4) {
        delayMs = 120 * 60 * 1000;
      }

      const jitterMs = Math.floor(Math.random() * 15000);
      const nextAttemptAt = new Date(Date.now() + delayMs + jitterMs);

      await payload.db.drizzle.transaction(async (tx) => {
        const updateResult = await tx.execute(sql`
          UPDATE notifications
          SET status = 'retry-scheduled',
              attempts = ${attempts},
              next_attempt_at = ${nextAttemptAt.toISOString()},
              last_error = ${errorMsg},
              locked_at = NULL,
              locked_by = NULL,
              lease_expires_at = NULL,
              message = COALESCE(message, ${renderedMessage || null}),
              delivery_payload = ${deliveryPayload ? JSON.stringify(deliveryPayload) : null}
          WHERE id = ${notif.id} AND status = 'sending'
        `);

        if ((updateResult.rowCount ?? 0) > 0) {
          await tx.execute(sql`
            INSERT INTO notification_audit (notification_id, from_status, to_status, actor, error, event_type, created_at, updated_at)
            VALUES (${notif.id}, 'sending', 'retry-scheduled', ${workerId}, ${errorMsg}, 'notification_transition', NOW(), NOW())
          `);
        }
      });

      notificationMetrics.recordRetry();
      console.log(`[Worker] Notification ${notif.id} scheduled for retry at ${nextAttemptAt.toISOString()}`);
    }
  }

  const ADMIN_ALERT_INTERVAL_MS = Number(process.env.ADMIN_ALERT_INTERVAL_MS) || 300_000; // 5 minutes

  // ─── Check and Process Admin Alerts Digest (Quiet Times Only) ───────────
  async function checkAndProcessAdminDigest() {
    try {
      // 1. Fetch metadata about pending admin alerts: count and oldest creation time
      const pendingAlertsMetadata = await payload.db.drizzle.execute(sql`
        SELECT COUNT(*)::int as count,
               MIN(created_at) as oldest_created_at
        FROM notifications
        WHERE template = 'admin-alert'
          AND status IN ('queued', 'retry-scheduled')
      `);

      const metadata = pendingAlertsMetadata.rows[0] as { count: number; oldest_created_at: string | null };
      const pendingCount = metadata.count || 0;
      
      if (pendingCount === 0) {
        oldestAdminAlertCreatedAt = null;
        return;
      }

      // Record oldest alert creation time if not set
      if (metadata.oldest_created_at) {
        oldestAdminAlertCreatedAt = new Date(metadata.oldest_created_at).getTime();
      }

      // 2. Determine if we should process:
      // a) Quiet logic: wait 30 seconds since the last standard send, AND no standard messages are currently queued/sending/locked/retry-scheduled
      const activeUserCountResult = await payload.db.drizzle.execute(sql`
        SELECT COUNT(*)::int as count
        FROM notifications
        WHERE template != 'admin-alert'
          AND status IN ('queued', 'locked', 'sending', 'retry-scheduled')
      `);
      const activeUserCount = (activeUserCountResult.rows[0] as { count: number }).count || 0;

      const isQuiet = (Date.now() - lastUserMessageSentAt >= 30_000) && activeUserCount === 0;
      
      // b) Starvation fallback: oldest alert has been waiting for more than 5 minutes
      const isMaxWaitExceeded = oldestAdminAlertCreatedAt !== null && (Date.now() - oldestAdminAlertCreatedAt >= ADMIN_ALERT_INTERVAL_MS);

      if (!isQuiet && !isMaxWaitExceeded) {
        return;
      }

      console.log(`[Worker] Triggering admin digest. Pending alerts: ${pendingCount}. isQuiet: ${isQuiet}, isMaxWaitExceeded: ${isMaxWaitExceeded}`);

      // 3. Lock and fetch all pending admin-alert rows
      const lockedAlerts = await payload.db.drizzle.transaction(async (tx) => {
        const selectResult = await tx.execute(sql`
          SELECT id, phone, template, payload, message, attempts, created_at
          FROM notifications
          WHERE template = 'admin-alert'
            AND status IN ('queued', 'retry-scheduled')
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
        `);

        const rows = (selectResult.rows as unknown as { id: number; phone: string; template: string; payload: string | Record<string, unknown>; message: string; attempts: number; created_at: string }[]) || [];
        if (rows.length === 0) return [];

        const ids = rows.map((r) => r.id);
        const idsPgArray = `{${ids.join(',')}}`;

        await tx.execute(sql`
          UPDATE notifications
          SET status = 'locked',
              locked_at = NOW(),
              locked_by = ${workerId},
              lease_expires_at = ${new Date(Date.now() + LEASE_DURATION_MS).toISOString()}
          WHERE id = ANY(${idsPgArray}::int[])
        `);

        return rows;
      });

      if (lockedAlerts.length === 0) {
        return;
      }

      // 4. Retrieve admin phone number from the locked database records (which are normalized on insertion)
      // and fall back to settings-cache or environment variable if not present.
      let adminPhone = lockedAlerts[0]?.phone || null;
      if (!adminPhone) {
        const rawPhone = (await getCachedAdminPhone()) || process.env.WHATSAPP_ADMIN_PHONE || null;
        if (rawPhone) {
          const normResult = validateAndNormalizePhone(rawPhone);
          if (normResult.valid) {
            adminPhone = normResult.normalized;
          } else {
            adminPhone = rawPhone;
          }
        }
      }

      const alertIdsArray = `{${lockedAlerts.map((a) => a.id).join(',')}}`;

      if (!adminPhone) {
        console.warn('[Worker] WhatsApp admin phone is not configured. Marking digest notifications as failed.');
        await payload.db.drizzle.execute(sql`
          UPDATE notifications
          SET status = 'failed',
              last_error = 'Admin phone not configured',
              locked_at = NULL,
              locked_by = NULL,
              lease_expires_at = NULL
          WHERE id = ANY(${alertIdsArray}::int[])
        `);
        oldestAdminAlertCreatedAt = null;
        return;
      }

      // Transition locked notifications to 'sending' before calling provider
      await payload.db.drizzle.execute(sql`
        UPDATE notifications
        SET status = 'sending'
        WHERE id = ANY(${alertIdsArray}::int[])
      `);

      // 5. Construct a consolidated summary text message
      const digestLines: string[] = [
        "🔔 *CoffeeBay Operations Summary*",
        "--------------------------------",
      ];

      lockedAlerts.forEach((alert) => {
        let parsedPayload = alert.payload;
        if (typeof parsedPayload === 'string') {
          try {
            parsedPayload = JSON.parse(parsedPayload);
          } catch {
            parsedPayload = {};
          }
        }
        const vars = (parsedPayload as Record<string, unknown>)?.variables as Record<string, string> || {};
        
        const winDate = new Date(alert.created_at);
        const dateStr = winDate.toLocaleDateString('en-US', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' });
        const timeStr = winDate.toLocaleTimeString('en-US', { timeZone: 'Africa/Cairo', hour12: true, hour: '2-digit', minute: '2-digit' });

        digestLines.push(
          `• *${vars.participantName || 'N/A'}* (${vars.participantPhone || 'N/A'}) - ${dateStr} | ${timeStr}`,
          `   Prize: *${vars.prizeName || 'N/A'}*`,
          `   Prize Code: \`${vars.serialCode || 'N/A'}\``,
          ""
        );
      });

      digestLines.push("--------------------------------", "_◆ CoffeeBay Systems Monitoring_");
      const digestText = digestLines.join("\n");

      // 6. Dispatch the single message through the provider with rate-limiting slot
      await rateLimiter.acquire();
      const startTime = Date.now();

      const result = await provider.send({
        id: -1, // Dummy ID
        phone: adminPhone,
        payload: { type: 'admin-alert', variables: {} },
        message: digestText,
        idempotencyKey: `admin-digest-${Date.now()}`,
        priority: 80,
        createdAt: new Date().toISOString(),
        expiresAt: null
      });

      const duration = Date.now() - startTime;
      rateLimiter.recordLatency(duration);

      if (result.success) {
        // Success Path: Update all notifications to 'sent'
        await payload.db.drizzle.transaction(async (tx) => {
          await tx.execute(sql`
            UPDATE notifications
            SET status = 'sent',
                attempts = attempts + 1,
                sent_at = NOW(),
                locked_at = NULL,
                locked_by = NULL,
                lease_expires_at = NULL,
                provider_message_id = ${result.messageId || null},
                provider_name = ${provider.name},
                send_duration_ms = ${duration},
                message = ${digestText}
            WHERE id = ANY(${alertIdsArray}::int[])
          `);

          for (const alert of lockedAlerts) {
            await tx.execute(sql`
              INSERT INTO notification_audit (notification_id, from_status, to_status, actor, duration_ms, event_type, created_at, updated_at)
              VALUES (${alert.id}, 'sending', 'sent', ${workerId}, ${duration}, 'notification_transition', NOW(), NOW())
            `);
          }
        });

        rateLimiter.recordSuccess();
        circuitBreaker.recordSuccess();
        console.log(`[Worker] Successfully sent admin digest for ${lockedAlerts.length} alerts (MessageID: ${result.messageId})`);
        oldestAdminAlertCreatedAt = null;
      } else {
        // Failure Path: Handle failure and retry logic for each alert in the digest
        const errorMsg = result.error || 'Digest dispatch failed';
        console.error(`[Worker] Admin digest dispatch failed: ${errorMsg}`);
        
        circuitBreaker.recordFailure();
        if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('throttle') || errorMsg.toLowerCase().includes('busy')) {
          rateLimiter.recordThrottle();
        }

        await payload.db.drizzle.transaction(async (tx) => {
          for (const alert of lockedAlerts) {
            const nextAttempts = alert.attempts + 1;
            if (nextAttempts >= 5) {
              await tx.execute(sql`
                UPDATE notifications
                SET status = 'failed',
                    attempts = ${nextAttempts},
                    last_error = ${errorMsg},
                    locked_at = NULL,
                    locked_by = NULL,
                    lease_expires_at = NULL
                WHERE id = ${alert.id}
              `);
              await tx.execute(sql`
                INSERT INTO notification_audit (notification_id, from_status, to_status, actor, error, event_type, created_at, updated_at)
                VALUES (${alert.id}, 'sending', 'failed', ${workerId}, ${errorMsg}, 'notification_transition', NOW(), NOW())
              `);
            } else {
              const delayMs = 60 * 1000;
              const nextAttemptAt = new Date(Date.now() + delayMs);
              await tx.execute(sql`
                UPDATE notifications
                SET status = 'retry-scheduled',
                    attempts = ${nextAttempts},
                    next_attempt_at = ${nextAttemptAt.toISOString()},
                    last_error = ${errorMsg},
                    locked_at = NULL,
                    locked_by = NULL,
                    lease_expires_at = NULL
                WHERE id = ${alert.id}
              `);
              await tx.execute(sql`
                INSERT INTO notification_audit (notification_id, from_status, to_status, actor, error, event_type, created_at, updated_at)
                VALUES (${alert.id}, 'sending', 'retry-scheduled', ${workerId}, ${errorMsg}, 'notification_transition', NOW(), NOW())
              `);
            }
          }
        });
      }
    } catch (err) {
      console.error('[Worker] Unexpected error in checkAndProcessAdminDigest:', err);
    }
  }

  // ─── Loop Tick (Recursive with Delay) ──────────────────────────────────
  async function tick() {
    if (isShuttingDown) return;
    try {
      const processed = await processBatch();
      if (processed > 0) {
        lastUserMessageSentAt = Date.now();
      }
      
      await checkAndProcessAdminDigest();
    } catch (err) {
      console.error('[Worker Loop Error] Unexpected loop exception:', err);
    } finally {
      setTimeout(tick, POLL_INTERVAL_MS);
    }
  }

  tick();

  // ─── Graceful Shutdown Handlers ──────────────────────────────────────────
  async function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[Worker] Received ${signal}. Initiating graceful shutdown...`);

    healthMonitor.stop();

    // Wait up to 10 seconds for any active sends to complete
    let waitAttempts = 0;
    while (inFlightCount > 0 && waitAttempts < 20) {
      console.log(`[Worker] Waiting for ${inFlightCount} active sends to finish...`);
      await new Promise((resolve) => setTimeout(resolve, 500));
      waitAttempts++;
    }

    try {
      await provider.shutdown();
    } catch (err) {
      console.error('[Worker] Error shutting down provider:', err);
    }

    console.log('[Worker] Graceful shutdown complete. Exiting.');
    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('[Worker Fatal Error] Bootstrap crashed:', err);
  process.exit(1);
});
