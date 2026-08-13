/**
 * SMS Misr HTTP Client Isolation Layer
 *
 * Handles HTTP POST calls, authentication, timeout signals (AbortController),
 * response status parsing (Code 1901 = Success), circuit breaker fault isolation,
 * and retryable vs fatal error classification.
 */

export interface SmsMisrSendOptions {
  mobile: string;
  message: string;
  intent: 'otp' | 'transactional' | 'promotional';
  otpCode?: string;
  templateId?: string;
}

export interface SmsMisrClientResult {
  success: boolean;
  code?: string;
  messageId?: string;
  error?: string;
  retryable?: boolean;
  rawResponse?: unknown;
}

export class SmsMisrClient {
  private username: string;
  private password: string;
  private senderId: string;
  private environment: string;
  private timeoutMs: number;
  private retryableStatuses: Set<number>;

  // Circuit Breaker State
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;
  private readonly failureThreshold = 5;
  private readonly circuitCoolingMs = 60_000;

  constructor() {
    this.username = process.env.SMSMISR_USERNAME || '';
    this.password = process.env.SMSMISR_PASSWORD || '';
    this.senderId = process.env.SMSMISR_SENDER_ID || 'seashell';
    
    // Direct Pass-Through: SMSMISR_ENVIRONMENT is passed directly to API payload. Default is '2' (Test) for safety.
    this.environment = process.env.SMSMISR_ENVIRONMENT || '2';

    if (this.environment === '1' && process.env.NODE_ENV !== 'production') {
      throw new Error(
        'CRITICAL SAFETY BLOCK: Live SMS Misr environment (1) is not allowed outside of production!'
      );
    }

    this.timeoutMs = Number(process.env.SMSMISR_TIMEOUT_MS) || 10_000;

    const retryableList = (process.env.SMSMISR_RETRYABLE_STATUS || '408,429,500,502,503')
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => !isNaN(n));
    this.retryableStatuses = new Set(retryableList);
  }

  /**
   * Primary entry point to dispatch SMS via OTP or SMS REST API.
   */
  async sendSms(options: SmsMisrSendOptions): Promise<SmsMisrClientResult> {
    // 1. Check Circuit Breaker
    if (this.isCircuitOpen()) {
      return {
        success: false,
        error: `Circuit breaker OPEN until ${new Date(this.circuitOpenUntil).toISOString()} due to consecutive upstream failures`,
        retryable: true,
      };
    }

    const isOtpRoute = options.intent === 'otp' && process.env.SMSMISR_ENABLE_OTP_API !== 'false';
    const baseUrl = isOtpRoute ? 'https://smsmisr.com/api/OTP/' : 'https://smsmisr.com/api/SMS/';

    const payload: Record<string, string> = {
      environment: this.environment,
      username: this.username,
      password: this.password,
      sender: this.senderId,
      mobile: options.mobile,
    };

    if (isOtpRoute && options.otpCode) {
      payload.otp = options.otpCode;
      if (options.templateId) {
        payload.template = options.templateId;
      }
    } else {
      // Language: 1 = English, 2 = Arabic, 3 = Unicode (Bilingual/Emojis)
      const hasArabic = /[\u0600-\u06FF]/.test(options.message);
      const hasUnicodeOrEmoji = /[^\u0000-\u007F]/.test(options.message);

      if (hasArabic) {
        payload.language = '2';
      } else if (hasUnicodeOrEmoji) {
        payload.language = '3';
      } else {
        payload.language = '1';
      }
      payload.message = options.message;
    }

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(payload).toString(),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      let responseData: Record<string, unknown> = {};
      try {
        responseData = (await response.json()) as Record<string, unknown>;
      } catch {
        // Fallback for empty or non-JSON response body
      }

      // SMS Misr success code is "1901" for SMS API and "4901" for OTP API
      const responseCode = String(responseData.code || responseData.Code || '');
      const isSuccess = response.ok && (responseCode === '1901' || responseCode === '4901' || responseCode === '1900' || responseCode === 'SUCCESS');

      if (isSuccess) {
        this.onSuccess();
        return {
          success: true,
          code: responseCode,
          messageId: String(responseData.message_id || responseData.SMSID || responseCode),
          rawResponse: responseData,
        };
      }

      // Handle Failed Response Code
      this.onFailure();
      
      // Permanent gateway errors that should not be retried:
      // 1902/4902 (Invalid URL/Params), 1903/4903 (Invalid Credentials), 1904/4904 (Invalid Sender),
      // 1905/4905 (Invalid Mobile), 1906/4906 (Insufficient Credit), 1909/4909 (Invalid Message),
      // 1910/4910 (Invalid Language), 1911/4911 (Text too long), 1912/4912 (Invalid Environment)
      const isFatalGatewayCode = /^(1902|1903|1904|1905|1906|1909|1910|1911|1912|4902|4903|4904|4905|4906|4909|4910|4911|4912)$/.test(responseCode);
      const isRetryable = this.retryableStatuses.has(response.status) || (response.ok && !isSuccess && !isFatalGatewayCode);

      return {
        success: false,
        code: responseCode,
        error: `SMS Misr returned Code: ${responseCode || 'N/A'}, HTTP Status: ${response.status} — ${JSON.stringify(responseData).substring(0, 200)}`,
        retryable: isRetryable,
        rawResponse: responseData,
      };

    } catch (error: unknown) {
      this.onFailure();
      const errMsg = error instanceof Error ? error.message : String(error);
      const isTimeout = errMsg.includes('timeout') || errMsg.includes('abort');
      const isNetwork =
        errMsg.includes('ECONNREFUSED') ||
        errMsg.includes('ECONNRESET') ||
        errMsg.includes('ENOTFOUND') ||
        errMsg.includes('fetch failed');

      return {
        success: false,
        error: `Network/HTTP error: ${errMsg}`,
        retryable: isTimeout || isNetwork,
      };
    }
  }

  // ── Circuit Breaker Helpers ─────────────────────────────────────────

  private isCircuitOpen(): boolean {
    if (this.circuitOpenUntil === 0) return false;
    if (Date.now() > this.circuitOpenUntil) {
      // Cooling period passed -> enter Half-Open
      this.circuitOpenUntil = 0;
      return false;
    }
    return true;
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
    this.circuitOpenUntil = 0;
  }

  private onFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.circuitOpenUntil = Date.now() + this.circuitCoolingMs;
      console.warn(`[SmsMisrClient] Circuit breaker TRIPPED! Opened for ${this.circuitCoolingMs / 1000}s`);
    }
  }
}
