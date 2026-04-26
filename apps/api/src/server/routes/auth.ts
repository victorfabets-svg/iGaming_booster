import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@shared/database/connection';
import { randomUUID, createHash } from 'crypto';
import { ok, fail } from '../utils/response';
import { requireFields } from '../utils/validation';
import { rateLimitDb } from '../utils/rate-limit-db';
import { checkIdempotency, saveIdempotency, getIdempotencyKey, reserveIdempotency, getIdempotency, completeIdempotency, releaseStaleIdempotency, isIdempotencyStale } from '../utils/idempotency';
import { auditLog } from '@shared/events/audit-log';
import argon2 from 'argon2';

// Simple email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Constants
const ACCESS_TOKEN_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

/**
 * Hash a refresh token using SHA-256 (base64url encoded)
 */
function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

/**
 * Generate a random refresh token (32 bytes, base64url encoded)
 */
function generateRefreshToken(): string {
  return createHash('sha256').update(randomUUID() + Date.now().toString()).digest('base64url');
}

function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
}

// Dummy hash for constant-time comparison when user doesn't exist
// This ensures we don't leak whether an email exists via timing
const DUMMY_HASH = '$argon2i$v=19$m=65536,t=3,p=4$000000000000000000000000000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000';

/**
 * Auth routes - login, register, token refresh, logout
 */
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // Registration endpoint
  fastify.post(
    '/register',
    async (request: FastifyRequest<{ Body: { email: string; password: string } }>, reply: FastifyReply) => {
      const idemKey = getIdempotencyKey(request.headers as Record<string, unknown>);
      if (idemKey) {
        const reserve = await reserveIdempotency(idemKey);
        
        if (!reserve.acquired) {
          const existing = await getIdempotency(idemKey);
          
          if (existing?.status === 'done') {
            return ok(reply, existing.response);
          }
          
          if (isIdempotencyStale(existing)) {
            await releaseStaleIdempotency(idemKey);
            const retryReserve = await reserveIdempotency(idemKey);
            if (!retryReserve.acquired) {
              const retryExisting = await getIdempotency(idemKey);
              if (retryExisting?.status === 'done') {
                return ok(reply, retryExisting.response);
              }
              return fail(reply, 'Request in progress, please retry', 'IDEMPOTENCY_IN_PROGRESS');
            }
          } else {
            return fail(reply, 'Request in progress, please retry', 'IDEMPOTENCY_IN_PROGRESS');
          }
        }
      }

      // Rate limiting - 5 requests per minute per IP (register-specific key)
      const clientIp = request.ip || request.headers['x-forwarded-for'] as string || 'unknown';
      const allowed = await rateLimitDb(`register-ip:${clientIp}`, 5, 60000);

      if (!allowed) {
        return fail(reply, 'Too many requests', 'RATE_LIMIT');
      }

      const fieldsError = requireFields(request.body, ['email', 'password']);
      if (fieldsError) {
        return fail(reply, fieldsError, 'VALIDATION_ERROR');
      }

      const { email, password } = request.body;

      if (!isValidEmail(email)) {
        return fail(reply, 'Valid email required', 'VALIDATION_ERROR');
      }

      if (password.length < 8) {
        return fail(reply, 'Password must be at least 8 characters', 'VALIDATION_ERROR');
      }

      const userId = randomUUID();
      const requestId = (request as any).requestId;

      try {
        // Hash password with argon2
        const passwordHash = await argon2.hash(password, {
          type: argon2.argon2id,
          memoryCost: 65536,
          timeCost: 3,
        });

        await db.query(
          `INSERT INTO identity.users (id, email, password_hash, password_updated_at, created_at) 
           VALUES ($1, $2, $3, NOW(), NOW())`,
          [userId, email, passwordHash]
        );

        // Audit log for successful registration and password set
        await auditLog(userId, 'user_registered', { email }, requestId);
        await auditLog(userId, 'password_set', { method: 'register' }, requestId);

        if (idemKey) {
          await completeIdempotency(idemKey, { user_id: userId, email });
        }

        return ok(reply, { user_id: userId, email });
      } catch (err: any) {
        if (err.code === '23505') {
          return fail(reply, 'Email already registered', 'DUPLICATE_EMAIL');
        }
        console.error(err);
        return fail(reply, err.message);
      }
    }
  );

  // Login endpoint
  fastify.post(
    '/login',
    async (request: FastifyRequest<{ Body: { email: string; password: string } }>, reply: FastifyReply) => {
      // Rate limiting - 5 requests per minute per IP
      const clientIp = request.ip || request.headers['x-forwarded-for'] as string || 'unknown';
      const allowed = await rateLimitDb(`login-ip:${clientIp}`, 5, 60000);

      if (!allowed) {
        return fail(reply, 'Too many requests', 'RATE_LIMIT');
      }

      const fieldsError = requireFields(request.body, ['email', 'password']);
      if (fieldsError) {
        return fail(reply, fieldsError, 'VALIDATION_ERROR');
      }

      const { email, password } = request.body;
      const requestId = (request as any).requestId;

      // Look up user by email
      const userResult = await db.query<{ id: string; password_hash: string | null }>(
        `SELECT id, password_hash FROM identity.users WHERE email = $1`,
        [email]
      );

      const user = userResult.rows[0];

      // Constant-time verification regardless of whether user exists
      // This prevents timing attacks from revealing if email exists
      let isValid = false;
      if (user) {
        if (!user.password_hash) {
          // User exists but has no password (legacy account)
          // Still do dummy verify to maintain constant time
          await argon2.verify(DUMMY_HASH, password);
        } else {
          isValid = await argon2.verify(user.password_hash, password);
        }
      } else {
        // User doesn't exist - verify against dummy hash (constant time)
        await argon2.verify(DUMMY_HASH, password);
      }

      if (!user) {
        // Audit failed login (don't expose that email doesn't exist)
        await auditLog(null, 'user_login_failed', { ip: clientIp }, requestId);
        return fail(reply, 'Invalid credentials', 'INVALID_CREDENTIALS');
      }

      if (!user.password_hash) {
        // Legacy account without password
        await auditLog(user.id, 'user_login_failed', { reason: 'no_password_set' }, requestId);
        return fail(reply, 'Invalid credentials', 'INVALID_CREDENTIALS');
      }

      if (!isValid) {
        // Invalid password
        await auditLog(user.id, 'user_login_failed', { ip: clientIp }, requestId);
        return fail(reply, 'Invalid credentials', 'INVALID_CREDENTIALS');
      }

      // Generate access token
      const accessToken = await reply.jwtSign({ user_id: user.id }, { expiresIn: ACCESS_TOKEN_EXPIRY });

      // Generate refresh token
      const refreshTokenValue = generateRefreshToken();
      const refreshTokenHash = hashRefreshToken(refreshTokenValue);
      const familyId = randomUUID();
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      // Store refresh token
      await db.query(
        `INSERT INTO identity.refresh_tokens (user_id, family_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [user.id, familyId, refreshTokenHash, expiresAt]
      );

      // Audit successful login
      await auditLog(user.id, 'user_login_success', { method: 'password' }, requestId);

      return ok(reply, { 
        access_token: accessToken, 
        refresh_token: refreshTokenValue, 
        expires_in: 86400 
      });
    }
  );

  // Token refresh endpoint
  fastify.post(
    '/token/refresh',
    async (request: FastifyRequest<{ Body: { refresh_token: string } }>, reply: FastifyReply) => {
      const fieldsError = requireFields(request.body, ['refresh_token']);
      if (fieldsError) {
        return fail(reply, fieldsError, 'VALIDATION_ERROR');
      }

      const { refresh_token } = request.body;
      const requestId = (request as any).requestId;
      const refreshTokenHash = hashRefreshToken(refresh_token);

      // Look up the refresh token
      const tokenResult = await db.query<{
        id: string;
        user_id: string;
        family_id: string;
        expires_at: Date;
        revoked_at: Date | null;
      }>(
        `SELECT id, user_id, family_id, expires_at, revoked_at 
         FROM identity.refresh_tokens 
         WHERE token_hash = $1`,
        [refreshTokenHash]
      );

      const token = tokenResult.rows[0];

      if (!token) {
        return fail(reply, 'Invalid refresh token', 'INVALID_REFRESH');
      }

      if (new Date(token.expires_at) < new Date()) {
        return fail(reply, 'Refresh token expired', 'EXPIRED_REFRESH');
      }

      if (token.revoked_at) {
        // Reuse detected - revoke entire family
        await db.query(
          `UPDATE identity.refresh_tokens 
           SET revoked_at = NOW(), revoked_reason = 'family_compromised' 
           WHERE family_id = $1 AND revoked_at IS NULL`,
          [token.family_id]
        );

        await auditLog(token.user_id, 'refresh_token_reuse_detected', { severity: 'high' }, requestId);
        return fail(reply, 'Token family revoked', 'FAMILY_REVOKED');
      }

      // Revoke the old token and generate new one
      await db.query(
        `UPDATE identity.refresh_tokens 
         SET revoked_at = NOW(), revoked_reason = 'rotated' 
         WHERE id = $1`,
        [token.id]
      );

      // Generate new refresh token with same family
      const newRefreshTokenValue = generateRefreshToken();
      const newRefreshTokenHash = hashRefreshToken(newRefreshTokenValue);
      const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      await db.query(
        `INSERT INTO identity.refresh_tokens (user_id, family_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [token.user_id, token.family_id, newRefreshTokenHash, newExpiresAt]
      );

      // Generate new access token
      const accessToken = await reply.jwtSign({ user_id: token.user_id }, { expiresIn: ACCESS_TOKEN_EXPIRY });

      return ok(reply, { 
        access_token: accessToken, 
        refresh_token: newRefreshTokenValue, 
        expires_in: 86400 
      });
    }
  );

  // Logout endpoint
  fastify.post(
    '/logout',
    async (request: FastifyRequest<{ Body: { refresh_token?: string } }>, reply: FastifyReply) => {
      const requestId = (request as any).requestId;
      
      // Check for refresh token in body or Authorization header
      let refreshToken = request.body?.refresh_token;
      
      if (!refreshToken) {
        const authHeader = request.headers['authorization'] as string;
        if (authHeader?.startsWith('Bearer ')) {
          refreshToken = authHeader.substring(7);
        }
      }

      if (!refreshToken) {
        return fail(reply, 'Refresh token required', 'MISSING_REFRESH_TOKEN');
      }

      const refreshTokenHash = hashRefreshToken(refreshToken);
      const userId = (request as any).user?.user_id;

      // Revoke the refresh token
      await db.query(
        `UPDATE identity.refresh_tokens 
         SET revoked_at = NOW(), revoked_reason = 'logout' 
         WHERE token_hash = $1`,
        [refreshTokenHash]
      );

      // Audit logout
      if (userId) {
        await auditLog(userId, 'user_logout', {}, requestId);
      }

      return ok(reply, { ok: true });
    }
  );
}