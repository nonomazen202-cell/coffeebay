/**
 * Phone number validation and E.164 normalization.
 *
 * Responsibilities:
 * - Strip formatting characters (spaces, dashes, parentheses)
 * - Apply default country code when missing
 * - Validate minimum/maximum length
 * - Reject clearly malformed numbers
 * - Return normalized E.164 format
 */
export interface PhoneValidationResult {
  valid: boolean;
  normalized: string;
  error?: string;
}
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;
/**
 * Validates and normalizes a raw phone string to E.164 format.
 *
 * @param rawPhone - The raw phone input from the user
 * @param defaultCountryCode - Fallback country code (e.g., '+966'). Defaults to DEFAULT_COUNTRY_CODE env var.
 * @returns PhoneValidationResult with normalized E.164 phone or error
 */
export function validateAndNormalizePhone(
  rawPhone: string,
  defaultCountryCode?: string,
): PhoneValidationResult {
  const countryCode =
    defaultCountryCode || process.env.DEFAULT_COUNTRY_CODE || "";
  if (!rawPhone || typeof rawPhone !== "string") {
    return { valid: false, normalized: "", error: "Phone number is required" };
  }
  // Strip all formatting characters: spaces, dashes, parentheses, dots
  let digits = rawPhone.replace(/[\s\-().]/g, "");
  // Preserve leading '+' if present
  const hasPlus = digits.startsWith("+");
  const pureDigits = digits.replace(/\+/g, "");
  // Validate that remaining characters are all digits
  if (!/^\d+$/.test(pureDigits)) {
    return {
      valid: false,
      normalized: "",
      error: "Phone number contains invalid characters",
    };
  }
  // Reconstruct with or without '+'
  if (hasPlus) {
    digits = `+${pureDigits}`;
  } else if (pureDigits.startsWith("00")) {
    // International dialing prefix '00' → replace with '+'
    digits = `+${pureDigits.slice(2)}`;
  } else if (pureDigits.startsWith("0") && countryCode) {
    // Local number with leading zero — replace zero with country code
    digits = `${countryCode}${pureDigits.slice(1)}`;
  } else if (!pureDigits.startsWith("0") && countryCode && !hasPlus) {
    // No prefix at all — prepend country code
    digits = `${countryCode}${pureDigits}`;
  } else {
    digits = `+${pureDigits}`;
  }
  // Ensure leading '+'
  if (!digits.startsWith("+")) {
    digits = `+${digits}`;
  }
  // Extract pure digits for length validation
  const finalDigits = digits.replace(/\+/g, "");
  if (finalDigits.length < MIN_PHONE_DIGITS) {
    return {
      valid: false,
      normalized: "",
      error: `Phone number too short (minimum ${MIN_PHONE_DIGITS} digits)`,
    };
  }
  if (finalDigits.length > MAX_PHONE_DIGITS) {
    return {
      valid: false,
      normalized: "",
      error: `Phone number too long (maximum ${MAX_PHONE_DIGITS} digits)`,
    };
  }
  return { valid: true, normalized: digits };
}
