export class Honeypot {
  /**
   * Validates the honeypot field value.
   * Returns true if valid (the field is empty, i.e., submission was by a human),
   * or false if invalid (field is populated, indicating automatic bot submission).
   */
  validate(value: string | undefined | null): boolean {
    if (value === undefined || value === null) {
      return true;
    }
    return value.trim() === '';
  }
}

export const honeypot = new Honeypot();
