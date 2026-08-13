export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  normalized?: {
    name: string;
    phone: string;
    serialCode: string;
  };
}

export class RequestValidator {
  private readonly phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
  private readonly serialRegex = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

  validateRedeemRequest(data: unknown): ValidationResult {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      return { isValid: false, errors: ['Request payload is missing or invalid'] };
    }

    const payload = data as Record<string, unknown>;

    // Extract and normalize values
    const rawName = typeof payload.name === 'string' ? payload.name : '';
    const rawPhone = typeof payload.phone === 'string' ? payload.phone : '';
    const rawSerial = typeof payload.serialCode === 'string' ? payload.serialCode : '';

    const name = rawName.trim();
    const phone = rawPhone.trim();
    const serialCode = rawSerial.trim().toUpperCase();

    // Validate name
    if (!name) {
      errors.push('Name is required');
    } else if (name.length < 2 || name.length > 100) {
      errors.push('Name must be between 2 and 100 characters');
    }

    // Validate phone
    if (!phone) {
      errors.push('Phone number is required');
    } else if (!this.phoneRegex.test(phone.replace(/\s+/g, ''))) {
      errors.push('Invalid phone number format');
    }

    // Validate serial code
    if (!serialCode) {
      errors.push('Serial code is required');
    } else if (!this.serialRegex.test(serialCode)) {
      errors.push('Invalid serial code format (expected format: XXXX-XXXX)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      normalized: errors.length === 0 ? { name, phone, serialCode } : undefined,
    };
  }
}

export const requestValidator = new RequestValidator();
