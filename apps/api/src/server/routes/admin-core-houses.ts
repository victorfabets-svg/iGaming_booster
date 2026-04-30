/**
 * Admin Routes for Canonical Houses Management
 * 
 * CRUD for core.houses table (canonical houses source of truth)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../infrastructure/auth/middleware';
import { requireAdmin } from '../../infrastructure/auth/require-admin';
import { ok, fail } from '../utils/response';
import { db } from '@shared/database/connection';

// Input validation constants
const SLUG_REGEX = /^[a-z0-9-]+$/;
const COUNTRY_REGEX = /^[A-Z]{2}$/;
const CURRENCY_REGEX = /^[A-Z]{3}$/;

interface CoreHouseRow {
  id: string;
  slug: string;
  name: string;
  country: string;
  currency: string;
  deposit_url: string;
  signup_url: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Validate core house input.
 */
function validateCoreHouseInput(input: unknown, isUpdate = false): string | null {
  if (!input || typeof input !== 'object') {
    return 'Invalid request body';
  }

  const body = input as Record<string, unknown>;

  // Required fields (only for create)
  if (!isUpdate) {
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
    if (typeof body.deposit_url !== 'string' || !body.deposit_url) {
      return 'deposit_url is required';
    }
  }

  // Validate slug format (only for create)
  if (!isUpdate && body.slug && !SLUG_REGEX.test(body.slug as string)) {
    return 'slug must be lowercase alphanumeric with dashes only';
  }

  // Validate country (2 chars)
  if (body.country && !COUNTRY_REGEX.test(String(body.country).toUpperCase())) {
    return 'country must be 2 uppercase characters';
  }

  // Validate currency (3 chars)
  if (body.currency && !CURRENCY_REGEX.test(String(body.currency).toUpperCase())) {
    return 'currency must be 3 uppercase characters';
  }

  // Validate deposit_url
  if (body.deposit_url) {
    try {
      new URL(body.deposit_url as string);
    } catch {
      return 'deposit_url must be a valid URL';
    }
  }

  // Validate signup_url if present
  if (body.signup_url) {
    try {
      new URL(body.signup_url as string);
    } catch {
      return 'signup_url must be a valid URL';
    }
  }

  return null;
}

/**
 * GET /admin/core-houses - List all canonical houses
 */
async function listAllCoreHouses(): Promise<CoreHouseRow[]> {
  const result = await db.query(
    `SELECT id, slug, name, country, currency, deposit_url, signup_url, active, created_at, updated_at
       FROM core.houses
      ORDER BY name`
  );
  return result.rows as CoreHouseRow[];
}

/**
 * GET /admin/core-houses/:slug - Get a single canonical house
 */
async function getCoreHouseBySlug(slug: string): Promise<CoreHouseRow | null> {
  const result = await db.query(
    `SELECT id, slug, name, country, currency, deposit_url, signup_url, active, created_at, updated_at
       FROM core.houses
      WHERE slug = $1`,
    [slug]
  );
  return result.rows[0] as CoreHouseRow | null;
}

/**
 * CREATE a canonical house (no upsert - explicit create)
 */
async function createCoreHouse(input: {
  slug: string;
  name: string;
  country: string;
  currency: string;
  deposit_url: string;
  signup_url?: string;
  active?: boolean;
}): Promise<CoreHouseRow> {
  const result = await db.query(
    `INSERT INTO core.houses (slug, name, country, currency, deposit_url, signup_url, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, slug, name, country, currency, deposit_url, signup_url, active, created_at, updated_at`,
    [
      input.slug,
      input.name,
      input.country,
      input.currency,
      input.deposit_url,
      input.signup_url || null,
      input.active ?? true,
    ]
  );
  return result.rows[0] as CoreHouseRow;
}

/**
 * UPDATE a canonical house
 */
async function updateCoreHouse(
  slug: string,
  input: {
    name?: string;
    country?: string;
    currency?: string;
    deposit_url?: string;
    signup_url?: string;
    active?: boolean;
  }
): Promise<CoreHouseRow | null> {
  const sets: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [slug];
  let paramIndex = 2;

  if (input.name !== undefined) {
    sets.push(`name = $${paramIndex++}`);
    params.push(input.name);
  }
  if (input.country !== undefined) {
    sets.push(`country = $${paramIndex++}`);
    params.push(input.country);
  }
  if (input.currency !== undefined) {
    sets.push(`currency = $${paramIndex++}`);
    params.push(input.currency);
  }
  if (input.deposit_url !== undefined) {
    sets.push(`deposit_url = $${paramIndex++}`);
    params.push(input.deposit_url);
  }
  if (input.signup_url !== undefined) {
    sets.push(`signup_url = $${paramIndex++}`);
    params.push(input.signup_url);
  }
  if (input.active !== undefined) {
    sets.push(`active = $${paramIndex++}`);
    params.push(input.active);
  }

  if (sets.length === 1) {
    // Nothing to update
    return getCoreHouseBySlug(slug);
  }

  const result = await db.query(
    `UPDATE core.houses SET ${sets.join(', ')} WHERE slug = $1
     RETURNING id, slug, name, country, currency, deposit_url, signup_url, active, created_at, updated_at`,
    params
  );
  return result.rows[0] as CoreHouseRow | null;
}

export async function adminCoreHousesRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // GET /admin/core-houses - List all canonical houses
  fastify.get(
    '/admin/core-houses',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const houses = await listAllCoreHouses();
      return ok(reply, { houses });
    }
  );

  // GET /admin/core-houses/:slug - Get a single canonical house
  fastify.get(
    '/admin/core-houses/:slug',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { slug: string };
      const house = await getCoreHouseBySlug(params.slug);
      if (!house) {
        return fail(reply, 'House not found', 'NOT_FOUND');
      }
      return ok(reply, { house });
    }
  );

  // POST /admin/core-houses - Create a canonical house
  fastify.post(
    '/admin/core-houses',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const validationError = validateCoreHouseInput(request.body);
      if (validationError) {
        return fail(reply, validationError, 'VALIDATION_ERROR');
      }

      const body = request.body as {
        slug: string;
        name: string;
        country: string;
        currency: string;
        deposit_url: string;
        signup_url?: string;
        active?: boolean;
      };

      // Check for duplicate slug
      const existing = await getCoreHouseBySlug(body.slug);
      if (existing) {
        return fail(reply, 'DUPLICATE_SLUG', 'DUPLICATE_SLUG');
      }

      const house = await createCoreHouse({
        slug: body.slug,
        name: body.name,
        country: body.country.toUpperCase(),
        currency: body.currency.toUpperCase(),
        deposit_url: body.deposit_url,
        signup_url: body.signup_url,
        active: body.active,
      });
      return ok(reply, { house });
    }
  );

  // PATCH /admin/core-houses/:slug - Update a canonical house
  fastify.patch(
    '/admin/core-houses/:slug',
    { preHandler: [authMiddleware, requireAdmin(fastify)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { slug: string };
      const body = request.body as {
        name?: string;
        country?: string;
        currency?: string;
        deposit_url?: string;
        signup_url?: string;
        active?: boolean;
      };

      const existing = await getCoreHouseBySlug(params.slug);
      if (!existing) {
        return fail(reply, 'House not found', 'NOT_FOUND');
      }

      const validationError = validateCoreHouseInput(request.body, true);
      if (validationError) {
        return fail(reply, validationError, 'VALIDATION_ERROR');
      }

      const updateInput: {
        name?: string;
        country?: string;
        currency?: string;
        deposit_url?: string;
        signup_url?: string;
        active?: boolean;
      } = {};

      if (body.name !== undefined) updateInput.name = body.name;
      if (body.country !== undefined) updateInput.country = body.country.toUpperCase();
      if (body.currency !== undefined) updateInput.currency = body.currency.toUpperCase();
      if (body.deposit_url !== undefined) updateInput.deposit_url = body.deposit_url;
      if (body.signup_url !== undefined) updateInput.signup_url = body.signup_url;
      if (body.active !== undefined) updateInput.active = body.active;

      const house = await updateCoreHouse(params.slug, updateInput);
      return ok(reply, { house });
    }
  );
}