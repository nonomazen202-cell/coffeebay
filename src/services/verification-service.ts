import crypto from 'crypto';

export class VerificationService {
  /**
   * Generates a cryptographically secure verification code matching format CFB-XXXXXX (6 digits).
   * Uses crypto.randomInt() (CSPRNG) instead of Math.random() to prevent prediction attacks.
   */
  generateVerificationCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(crypto.randomInt(0, chars.length));
    }
    return `CFB-${code}`;
  }

  /**
   * Validates if a verification code conforms to the format CFB-XXXXXX (6 alphanumeric chars).
   */
  isValidVerificationCode(code: string): boolean {
    const regex = /^CFB-[A-Z0-9]{6}$/;
    return regex.test(code);
  }

  /**
   * Validates if a serial code matches the alphanumeric format XXXX-XXXX.
   */
  isValidSerialCode(code: string): boolean {
    const regex = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    return regex.test(code);
  }
}

export const verificationService = new VerificationService();
