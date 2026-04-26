/**
 * Normalize a payment identifier value for cross-proof deduplication.
 * Pure function: same input -> same output, no side effects.
 *
 * Steps:
 *  1. Uppercase
 *  2. Strip all whitespace
 *  3. Strip dashes, dots, slashes (common visual separators)
 *  4. Trim leading/trailing nothing-of-value
 */
export function normalizeIdentifier(value: string): string {
  if (!value) return '';
  return value
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[-.\\/]/g, '')
    .trim();
}