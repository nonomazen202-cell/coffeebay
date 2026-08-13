/**
 * Circuit Breaker — Three-State Protection
 *
 * Prevents cascading failures by stopping sends when the provider
 * is consistently failing.
 *
 * States:
 * - Closed: Normal operation. Count consecutive failures.
 * - Open: All sends blocked. Cooldown timer running.
 * - Half-Open: Allow 1 probe message. If success → Closed. If fail → Open.
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private lastFailureAt = 0;
  private halfOpenProbesInFlight = 0;

  private readonly threshold: number;
  private readonly cooldownMs: number;
  private readonly halfOpenMaxProbes: number;

  constructor(options?: {
    threshold?: number;
    cooldownMs?: number;
    halfOpenMaxProbes?: number;
  }) {
    this.threshold = options?.threshold
      || Number(process.env.CIRCUIT_BREAKER_THRESHOLD) || 5;
    this.cooldownMs = options?.cooldownMs
      || Number(process.env.CIRCUIT_BREAKER_COOLDOWN_MS) || 60_000;
    this.halfOpenMaxProbes = options?.halfOpenMaxProbes || 1;
  }

  getState(): CircuitState {
    if (this.state === 'open') {
      // Check if cooldown has elapsed → transition to half-open
      if (Date.now() - this.lastFailureAt >= this.cooldownMs) {
        this.state = 'half-open';
        this.halfOpenProbesInFlight = 0;
        console.log('[CircuitBreaker] Cooldown elapsed → Half-Open (probing)');
      }
    }
    return this.state;
  }

  isOpen(): boolean {
    return this.getState() === 'open';
  }

  /**
   * Check if a send is allowed. In half-open, only allows limited probes.
   */
  allowRequest(): boolean {
    const currentState = this.getState();

    if (currentState === 'closed') return true;
    if (currentState === 'open') return false;

    // Half-open: allow limited probe messages
    if (currentState === 'half-open') {
      if (this.halfOpenProbesInFlight < this.halfOpenMaxProbes) {
        this.halfOpenProbesInFlight++;
        return true;
      }
      return false;
    }

    return false;
  }

  recordSuccess(): void {
    if (this.state === 'half-open') {
      // Probe succeeded → close the circuit
      this.state = 'closed';
      this.consecutiveFailures = 0;
      this.halfOpenProbesInFlight = 0;
      console.log('[CircuitBreaker] Probe succeeded → Closed');
    } else if (this.state === 'closed') {
      // Reset failure count on success
      this.consecutiveFailures = 0;
    }
  }

  recordFailure(): void {
    this.consecutiveFailures++;
    this.lastFailureAt = Date.now();

    if (this.state === 'half-open') {
      // Probe failed → reopen
      this.state = 'open';
      this.halfOpenProbesInFlight = 0;
      console.log('[CircuitBreaker] Probe failed → Open');
      return;
    }

    if (this.state === 'closed' && this.consecutiveFailures >= this.threshold) {
      this.state = 'open';
      console.log(`[CircuitBreaker] ${this.consecutiveFailures} consecutive failures → Open (cooldown: ${this.cooldownMs}ms)`);
    }
  }

  /**
   * Force reset (used by recovery service).
   */
  reset(): void {
    this.state = 'closed';
    this.consecutiveFailures = 0;
    this.halfOpenProbesInFlight = 0;
  }
}
