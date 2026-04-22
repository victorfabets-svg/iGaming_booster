import { FastifyReply } from 'fastify';
import { fail } from './response';

/**
 * Validates that all required fields are present in the request body.
 * Returns null if valid, or error message if any field is missing.
 */
export function requireFields(
  body: Record<string, any>,
  requiredFields: string[]
): string | null {
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}