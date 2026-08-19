/**
 * Numeric input sanitization utilities.
 * Prevents leading zeros (e.g. "010000" -> "10000"), handles decimal points,
 * and allows clean clearing to an empty string.
 */

export function sanitizeDecimal(val: string): string {
  let v = val.replace(/[^0-9.]/g, '');
  // Remove leading zeros before digits: "0100" -> "100", "00" -> "0"
  v = v.replace(/^0+(?=\d)/, '');
  // If user types "." first, format to "0."
  if (v.startsWith('.')) v = '0' + v;
  // Keep only the first decimal point
  const parts = v.split('.');
  if (parts.length > 2) {
    v = parts[0] + '.' + parts.slice(1).join('');
  }
  return v;
}

export function sanitizeInteger(val: string): string {
  let v = val.replace(/[^0-9]/g, '');
  v = v.replace(/^0+(?=\d)/, '');
  return v;
}

export function parseNumber(val: string | number | undefined | null, fallback = 0): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  if (!val) return fallback;
  const num = Number(String(val).replace(/,/g, ''));
  return Number.isFinite(num) ? num : fallback;
}
