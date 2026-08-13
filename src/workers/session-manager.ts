/**
 * Session Manager — Provider Connection Lifecycle
 *
 * Dedicated component for managing the provider session.
 * The worker does NOT manage sessions — this component handles:
 * - Connection state tracking
 * - Auto-reconnect on disconnect
 * - QR code requirement detection
 * - Pause/resume signaling to the worker
 *
 * Operates entirely through the NotificationProvider interface.
 * Does NOT know which provider is being used.
 */

import type { NotificationProvider } from '../services/notification-provider';

export class SessionManager {
  private provider: NotificationProvider;
  private currentState: 'connected' | 'disconnected' | 'connecting' | 'qr-required' = 'disconnected';
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly baseReconnectDelayMs = 5_000;
  private isPaused = false;

  constructor(provider: NotificationProvider) {
    this.provider = provider;
  }

  /**
   * Ensure the provider session is connected.
   * Blocks until connected or throws after max attempts.
   */
  async ensureConnected(): Promise<void> {
    if (!this.provider.capabilities.supportsSessionManagement) {
      this.currentState = 'connected';
      return;
    }

    this.currentState = await this.provider.getSessionState();

    if (this.currentState === 'connected') {
      this.reconnectAttempts = 0;
      this.isPaused = false;
      return;
    }

    console.log(`[SessionManager] Session state: ${this.currentState}. Attempting to connect...`);
    await this.provider.connect();

    // Wait for connection with polling
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      this.currentState = await this.provider.getSessionState();
      if (this.currentState === 'connected') {
        console.log('[SessionManager] Session connected successfully');
        this.reconnectAttempts = 0;
        this.isPaused = false;
        return;
      }
      if (this.currentState === 'qr-required') {
        console.warn('[SessionManager] QR code scan required. Waiting for operator...');
        this.isPaused = true;
        return;
      }
    }

    console.warn('[SessionManager] Could not establish connection within timeout');
  }

  /**
   * Get the current session state.
   */
  getState(): 'connected' | 'disconnected' | 'connecting' | 'qr-required' {
    return this.currentState;
  }

  /**
   * Whether the worker should pause processing.
   */
  shouldPause(): boolean {
    return this.isPaused || this.currentState !== 'connected';
  }

  /**
   * Handle disconnect event. Triggers auto-reconnect with exponential backoff.
   */
  async onDisconnected(): Promise<void> {
    this.currentState = 'disconnected';
    this.isPaused = true;
    console.warn('[SessionManager] Session disconnected');

    if (!this.provider.capabilities.supportsSessionManagement) {
      return;
    }

    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      if ((this.currentState as string) === 'connected') {
        console.log('[SessionManager] Session is already connected. Aborting reconnect loop.');
        this.reconnectAttempts = 0;
        this.isPaused = false;
        return;
      }

      this.reconnectAttempts++;
      const delay = this.baseReconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1);
      const jitter = Math.round(Math.random() * 2000);

      console.log(`[SessionManager] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay + jitter}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));

      if ((this.currentState as string) === 'connected') {
        console.log('[SessionManager] Session became connected during sleep. Aborting reconnect loop.');
        this.reconnectAttempts = 0;
        this.isPaused = false;
        return;
      }

      try {
        await this.provider.reconnect();
        await new Promise((resolve) => setTimeout(resolve, 3_000));
        this.currentState = await this.provider.getSessionState();

        if (this.currentState === 'connected') {
          console.log('[SessionManager] Reconnected successfully');
          this.reconnectAttempts = 0;
          this.isPaused = false;
          return;
        }
      } catch (err) {
        console.error(`[SessionManager] Reconnect attempt ${this.reconnectAttempts} failed:`, err);
      }
    }

    console.error('[SessionManager] Max reconnect attempts reached. Manual intervention required.');
  }

  /**
   * Handle QR code requirement event.
   */
  onQrRequired(): void {
    this.currentState = 'qr-required';
    this.isPaused = true;
    console.warn('[SessionManager] QR code scan required. Processing paused until scan is complete.');
  }

  /**
   * Handle connection restored event (e.g., from webhook).
   */
  onConnected(): void {
    this.currentState = 'connected';
    this.isPaused = false;
    this.reconnectAttempts = 0;
    console.log('[SessionManager] Session connected (from event)');
  }

  /**
   * Periodic check called by HealthMonitor.
   */
  async checkAndRecover(): Promise<void> {
    if (!this.provider.capabilities.supportsSessionManagement) return;

    try {
      const state = await this.provider.getSessionState();

      if (state !== this.currentState) {
        console.log(`[SessionManager] State changed: ${this.currentState} → ${state}`);
        this.currentState = state;

        if (state === 'disconnected') {
          await this.onDisconnected();
        } else if (state === 'qr-required') {
          this.onQrRequired();
        } else if (state === 'connected') {
          this.onConnected();
        }
      }
    } catch (err) {
      console.error('[SessionManager] Health check failed:', err);
    }
  }
}
