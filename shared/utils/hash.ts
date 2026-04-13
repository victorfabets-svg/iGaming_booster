import { createHash } from 'crypto';

/**
 * Generates SHA-256 hash of a buffer
 * @param buffer - The buffer to hash
 * @returns The hex-encoded hash string
 */
export function generateSHA256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}