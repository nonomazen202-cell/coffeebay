import crypto from 'crypto';
import { rateLimiter } from '../lib/security/rate-limiter';
import { turnstileVerifier } from '../lib/security/turnstile';
import { honeypot } from '../lib/security/honeypot';
import { requestValidator } from '../lib/security/request-validator';
import { auditLogger } from '../lib/security/audit-logger';

export interface SecurityCheckRequest {
  ip: string;
  userAgent: string;
  payload: {
    name?: string;
    phone?: string;
    serialCode?: string;
    turnstileToken?: string;
    honeyPot?: string;
  };
}

export interface SecurityCheckResult {
  success: boolean;
  requestId: string;
  normalizedPayload?: {
    name: string;
    phone: string;
    serialCode: string;
  };
  errors?: string[];
  retryAfterSeconds?: number;
}

export class SecurityService {
  /**
   * Generates a request trace ID at the entry point of the transaction.
   */
  generateRequestId(): string {
    return crypto.randomUUID();
  }

  /**
   * Executes a suite of modular security checks under the provided requestId.
   */
  async performSecurityCheck(
    requestId: string,
    req: SecurityCheckRequest
  ): Promise<SecurityCheckResult> {
    const { ip, userAgent, payload } = req;

    // 1. Honeypot check
    const isHuman = honeypot.validate(payload?.honeyPot);
    if (!isHuman) {
      auditLogger.log({
        requestId,
        ip,
        userAgent,
        action: 'REDEEM_CODE',
        result: 'BLOCKED',
        details: { reason: 'Honeypot verification failed (bot detected)' },
      });
      return {
        success: false,
        requestId,
        errors: ['Bot submission detected'],
      };
    }

    // 2. Schema validation and field normalization
    const validationResult = requestValidator.validateRedeemRequest(payload);
    if (!validationResult.isValid) {
      auditLogger.log({
        requestId,
        ip,
        userAgent,
        action: 'REDEEM_CODE',
        result: 'FAILED',
        details: { errors: validationResult.errors },
      });
      return {
        success: false,
        requestId,
        errors: validationResult.errors,
      };
    }

    // 3. Sliding window IP rate limit check
    const rateLimitResult = await rateLimiter.checkRateLimit(ip);
    if (rateLimitResult.limited) {
      auditLogger.log({
        requestId,
        ip,
        userAgent,
        action: 'REDEEM_CODE',
        result: 'BLOCKED',
        details: {
          reason: 'Rate limit exceeded',
          retryAfterSeconds: rateLimitResult.retryAfterSeconds,
        },
      });
      return {
        success: false,
        requestId,
        errors: ['Too many requests. Please try again later.'],
        retryAfterSeconds: rateLimitResult.retryAfterSeconds,
      };
    }

    // 4. Cloudflare Turnstile token check (fail-closed if key is configured)
    if (process.env.TURNSTILE_SECRET_KEY) {
      const isTokenValid = await turnstileVerifier.verifyToken(
        payload.turnstileToken || '',
        ip
      );
      if (!isTokenValid) {
        auditLogger.log({
          requestId,
          ip,
          userAgent,
          action: 'REDEEM_CODE',
          result: 'BLOCKED',
          details: { reason: 'Cloudflare Turnstile token validation failed' },
        });
        return {
          success: false,
          requestId,
          errors: ['Captcha verification failed'],
        };
      }
    }

    // Passed all security parameters successfully
    return {
      success: true,
      requestId,
      normalizedPayload: validationResult.normalized,
    };
  }
}

export const securityService = new SecurityService();
