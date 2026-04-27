/**
 * Admin Routes for Partner Houses Management
 * 
 * FIX-8: Added authMiddleware + requireAdmin
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../infrastructure/auth/middleware';
import { requireAdmin } from '../../infrastructure/auth/require-admin';
import {
  listAll,
  upsertBySlug,
  PartnerHouseInput,
} from '../../domains/validation/repositories/partner-houses.repository';
import { createHash } from 'crypto';
import { ok, fail } from '../utils/response';
import { requireFields } from '../utils/validation';

// Input validation constants
const SLUG_REGEX = /^[a-z0-9-]+$/;
const COUNTRY_REGEX = /^[A-Z]{2}$/;
const CURRENCY_REGEX = /^[A-Z]{3}$/;

/**
 * Validate partner house input.
 */
function validatePartnerHouseInput(input: unknown): string | null {
  if (!input || typeof input !== 'object') {
    return 'Invalid request body';
  }

  const body = input as Record<string, unknown>;

  // Required fields
  if (typeof body.slug !== 'string' || !body.slug) {
    return 'slug is required';
  }
  if (typeof body.name !== 'string' || !body.name) {
    return 'name is required';
  }
  if (typeof body.country !== 'string' || !body.country) {
    return 'country is required';
  }
  if (typeof body.currency !== 'string' || !body.currency) {
    return 'currency is required';
  }

  // Validate slug format
  if (!SLUG_REGEX.test(body.slug)) {
    return 'slug must be lowercase alphanumeric with dashes only';
  }

  // Validate country (2 chars)
  if (!COUNTRY_REGEX.test(body.country.toUpperCase())) {
    return 'country must be 2 uppercase characters';
  }

  // Validate currency (3 chars)
  if (!CURRENCY_REGEX.test(body.currency.toUpperCase())) {
    return 'currency must be 3 uppercase characters';
  }

  // Validate amounts if present
  if (body.min_amount !== undefined && body.min_amount !== null) {
    const minAmount = Number(body.min_amount);
    if (isNaN(minAmount) || minAmount < 0) {
      return 'min_amount must be a non-negative number';
    }
  }

  if (body.max_amount !== undefined && body.max_amount !== null) {
    const maxAmount = Number(body.max_amount);
    if (isNaN(maxAmount) || maxAmount < 0) {
      return 'max_amount must be a non-negative number';
    }
  }

  // Validate max >= min if both present
  if (body.min_amount !== undefined && body.max_amount !== undefined) {
    if (body.min_amount !== null && body.max_amount !== null) {
      const minAmount = Number(body.min_amount);
      const maxAmount = Number(body.max_amount);
      if (minAmount > maxAmount) {
        return 'max_amount must be greater than or equal to min_amount';
      }
    }
  }

  return null;
}

/**
 * Convert request body to PartnerHouseInput.
 */
function toPartnerHouseInput(body: Record<string, unknown>): PartnerHouseInput {
  return {
    slug: String(body.slug),
    name: String(body.name),
    country: String(body.country).toUpperCase(),
    currency: String(body.currency).toUpperCase(),
    ocr_aliases: Array.isArray(body.ocr_aliases)
      ? body.ocr_aliases.map((s) => String(s))
      : undefined,
    deposit_keywords: Array.isArray(body.deposit_keywords)
      ? body.deposit_keywords.map((s) => String(s))
      : undefined,
    min_amount:
      body.min_amount !== undefined && body.min_amount !== null
        ? Number(body.min_amount)
        : undefined,
    max_amount:
      body.max_amount !== undefined && body.max_amount !== null
        ? Number(body.max_amount)
        : undefined,
    regex_patterns: Array.isArray(body.regex_patterns) ? body.regex_patterns : undefined,
    active: typeof body.active === 'boolean' ? body.active : undefined,
  };
}

export async function adminPartnerHousesRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // GET /admin/partner-houses - List all partner houses
  fastify.get(
    '/admin/partner-houses',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const houses = await listAll();
      return ok(reply, { houses });
    }
  );

  // POST /admin/partner-houses - Create or update a partner house
  fastify.post(
    '/admin/partner-houses',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (
      request: FastifyRequest<{ Body: PartnerHouseInput }>,
      reply: FastifyReply
    ) => {
      const validationError = validatePartnerHouseInput(request.body);
      if (validationError) {
        return fail(reply, validationError, 'VALIDATION_ERROR');
      }

      const houseInput = toPartnerHouseInput(request.body as unknown as Record<string, unknown>);
      const house = await upsertBySlug(houseInput);

      return ok(reply, { house });
    }
  );
}