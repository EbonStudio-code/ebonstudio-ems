export const PHONE_HINT = 'Optional. Use 7–15 digits with spaces, dashes, dots or parentheses and an optional leading +. Leave blank to remove it.';
export const PHONE_ERROR = 'Enter a valid phone number with 7–15 digits, for example +1 (202) 555-0123, or leave it blank.';

// A region-neutral format check, not verification that the number is assigned or reachable.
export function phoneValidationError(value: string): string {
  const phone = value.trim();
  if (!phone) return '';
  if (phone.length > 32) return 'Phone number must be at most 32 characters, including formatting.';
  const digits = phone.replace(/\D/g, '');
  const format = phone.replace(/\(\d+\)/g, '0').replace(/ +/g, ' ');
  if (digits.length < 7 || digits.length > 15 || !/[1-9]/.test(digits) ||
    !/^\+?\d+(?:[ .-]\d+)*$/.test(format)) return PHONE_ERROR;
  return '';
}
