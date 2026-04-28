import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@shared/database/connection';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { ok, fail } from '../utils/response';
import { requireFields } from '../utils/validation';
import { rateLimitDb } from '../utils/rate-limit-db';
import { checkIdempotency, saveIdempotency, getIdempotencyKey, reserveIdempotency, getIdempotency, completeIdempotency, releaseStaleIdempotency, isIdempotencyStale } from '../utils/idempotency';
import { auditLog } from '@shared/events/audit-log';
import argon2 from 'argon2';
import { sendEmail } from '@shared/infrastructure/email/resend';
import { loadAndRender } from '@shared/infrastructure/email/render-template';
import { renderFallback } from '@shared/infrastructure/email/fallback-templates';

// Simple email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Constants
const ACCESS_TOKEN_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const WEB_BASE_URL = process.env.WEB_BASE_URL || 'https://i-gaming-booster.vercel.app';

/**
 * Hash a refresh token using SHA-256 (base64url encoded)
 */
function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

/**
 * Generate a random refresh token (32 bytes, base64url encoded) - per spec D2
 */
function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
}

// Valid argon2id dummy hash for constant-time comparison when user doesn't exist
// Generated with: argon2.hash('constant-time-dummy', {type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:4})
const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$axjd+k8652X5zG7/ZZAK1w$YSkkQFQKv3yBYtj//ZVoq/r1rOwKAx/WNURTeWhiYRk';

/**
 * Truncated user ID hash for audit forensics (without exposing real user_id)
 */
function getUserIdHint(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 12);
}

/**
 * Auth routes - login, register, token refresh, logout
 */
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // Registration endpoint
  fastify.post(
    '/register',
    async (request: FastifyRequest<{ Body: { email: string; password: string; display_name?: string } }>, reply: FastifyReply) => {
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
      const displayName = (request.body as { display_name?: string }).display_name?.trim() || '';

      // Email normalization (case-insensitive)
      const normalizedEmail = email.trim().toLowerCase();

      if (!isValidEmail(normalizedEmail)) {
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

        // Generate verification token
        const verificationToken = randomUUID();
        const verificationExpiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_MS);

        await db.query(
          `INSERT INTO identity.users (id, email, password_hash, password_updated_at, created_at, display_name, verification_token, verification_token_expires_at) 
           VALUES ($1, $2, $3, NOW(), NOW(), $4, $5, $6)`,
          [userId, normalizedEmail, passwordHash, displayName || null, verificationToken, verificationExpiresAt]
        );

        // Sprint 9 T2: best-effort first-touch attribution.
        // Cookie tipster_cid set by /r/:house route; fallback body.cid for mobile/in-app.
        const cookieCid = (request.cookies as Record<string, string> | undefined)?.tipster_cid;
        const bodyCid = (request.body as { cid?: string })?.cid;
        const clickId = cookieCid || bodyCid;

        if (clickId) {
          try {
            await db.query(
              `INSERT INTO affiliate.attributions (user_id, click_id, house_id)
               SELECT $1, c.click_id, c.house_id
                 FROM affiliate.clicks c
                 WHERE c.click_id = $2
               ON CONFLICT (user_id) DO NOTHING`,
              [userId, clickId]
            );
          } catch (attrErr) {
            // Attribution failure does NOT fail registration.
            console.error('[affiliate] attribution failed for user', userId, attrErr);
          }
        }

        // Audit log for successful registration and password set
        await auditLog(userId, 'user_registered', { email: normalizedEmail }, requestId);
        await auditLog(userId, 'password_set', { method: 'register' }, requestId);

        // Send verification email (fire-and-forget)
        const verificationUrl = `${WEB_BASE_URL}/verify-email/${verificationToken}`;
        const greetingName = displayName || 'olá';
        
        // Try to render template from DB, fallback if needed
        const rendered = await loadAndRender('email_verification', {
          verification_url: verificationUrl,
          display_name: greetingName,
          email: normalizedEmail,
        }) ?? renderFallback('email_verification', {
          verification_url: verificationUrl,
          display_name: greetingName,
          email: normalizedEmail,
        });

        sendEmail({
          to: normalizedEmail,
          subject: rendered.subject,
          html: rendered.html,
        }).catch(err => console.error('[email] verification send failed', err));

        if (idemKey) {
          await completeIdempotency(idemKey, { user_id: userId, email: normalizedEmail });
        }

        return ok(reply, { user_id: userId, email: normalizedEmail });
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

      // Email normalization (case-insensitive)
      const normalizedEmail = email.trim().toLowerCase();

      // Look up user by email (incl. role for JWT, email_verified for auth)
      const userResult = await db.query<{ id: string; password_hash: string | null; role: string; email_verified: boolean }>(
        `SELECT id, password_hash, role, email_verified FROM identity.users WHERE email = $1`,
        [normalizedEmail]
      );

      const user = userResult.rows[0];

      // Constant-time verification regardless of whether user exists
      // This prevents timing attacks from revealing if email exists
      let isValid = false;
      try {
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
      } catch (err) {
        // Corrupted hash or argon2 internal error - treat as invalid
        if (user) {
          await auditLog(null, 'auth_hash_verify_error', {
            target_user_hint: getUserIdHint(user.id),
            error: (err as Error).message
          }, requestId);
        }
        isValid = false;
      }

      if (!user) {
        // Audit failed login - never expose user_id to prevent email enumeration
        await auditLog(null, 'user_login_failed', { ip: clientIp, reason: 'unknown_email' }, requestId);
        return fail(reply, 'Invalid credentials', 'INVALID_CREDENTIALS');
      }

      if (!user.password_hash) {
        // Legacy account without password - audit with hint, not real user_id
        await auditLog(null, 'user_login_failed', { ip: clientIp, reason: 'no_password_set', target_user_hint: getUserIdHint(user.id) }, requestId);
        return fail(reply, 'Invalid credentials', 'INVALID_CREDENTIALS');
      }

      if (!isValid) {
        // Invalid password - audit with hint, not real user_id
        await auditLog(null, 'user_login_failed', { ip: clientIp, reason: 'invalid_password', target_user_hint: getUserIdHint(user.id) }, requestId);
        return fail(reply, 'Invalid credentials', 'INVALID_CREDENTIALS');
      }

      // Check if email is verified
      if (!user.email_verified) {
        return fail(reply, 'Confirme seu email antes de entrar.', 'EMAIL_NOT_VERIFIED');
      }

      // Generate access token with standard 'sub' claim + user_id + role for RBAC
      const userRole = user?.role || 'user';
      const accessToken = await reply.jwtSign({ sub: user.id, user_id: user.id, role: userRole }, { expiresIn: ACCESS_TOKEN_EXPIRY });

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

        // Mark the trigger token as the one that detected the compromise
        await db.query(
          `UPDATE identity.refresh_tokens 
           SET revoked_reason = 'family_compromise_trigger' 
           WHERE id = $1`,
          [token.id]
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

      // Re-fetch role from DB for refreshed token (role changes should propagate)
      const roleResult = await db.query<{ role: string }>(
        `SELECT role FROM identity.users WHERE id = $1`,
        [token.user_id]
      );
      const userRole = roleResult.rows[0]?.role || 'user';

      // Generate new access token with role for RBAC
      const accessToken = await reply.jwtSign({ sub: token.user_id, user_id: token.user_id, role: userRole }, { expiresIn: ACCESS_TOKEN_EXPIRY });

      return ok(reply, { 
        access_token: accessToken, 
        refresh_token: newRefreshTokenValue, 
        expires_in: 86400 
      });
    }
  );

  // Logout endpoint - requires JWT authentication + ownership check
  fastify.post(
    '/logout',
    async (request: FastifyRequest<{ Body: { refresh_token: string } }>, reply: FastifyReply) => {
      // Verify JWT to get authenticated user
      try {
        await request.jwtVerify();
      } catch {
        return fail(reply, 'Authentication required', 'UNAUTHORIZED');
      }

      const userId = (request as any).user?.user_id || (request as any).user?.sub;
      if (!userId) {
        return fail(reply, 'Authentication required', 'UNAUTHORIZED');
      }

      const requestId = (request as any).requestId;

      const fieldsError = requireFields(request.body, ['refresh_token']);
      if (fieldsError) {
        return fail(reply, fieldsError, 'VALIDATION_ERROR');
      }

      const { refresh_token } = request.body;
      const refreshTokenHash = hashRefreshToken(refresh_token);

      // Verify token ownership - only revoke if token belongs to authenticated user
      const tokenOwnerResult = await db.query<{ user_id: string }>(
        `SELECT user_id FROM identity.refresh_tokens WHERE token_hash = $1`,
        [refreshTokenHash]
      );

      const tokenOwner = tokenOwnerResult.rows[0];
      if (!tokenOwner) {
        return fail(reply, 'Invalid refresh token', 'INVALID_REFRESH');
      }

      if (tokenOwner.user_id !== userId) {
        // Token belongs to different user - forbidden
        await auditLog(userId, 'user_logout_forbidden', { reason: 'token_owner_mismatch' }, requestId);
        return fail(reply, 'Forbidden', 'FORBIDDEN');
      }

      // Revoke the refresh token
      await db.query(
        `UPDATE identity.refresh_tokens 
         SET revoked_at = NOW(), revoked_reason = 'logout' 
         WHERE token_hash = $1`,
        [refreshTokenHash]
      );

      // Audit logout (user_id is known since authenticated)
      await auditLog(userId, 'user_logout', {}, requestId);

      return ok(reply, { ok: true });
    }
  );

  // Verify email endpoint
  fastify.post(
    '/verify-email',
    async (request: FastifyRequest<{ Body: { token: string } }>, reply: FastifyReply) => {
      const fieldsError = requireFields(request.body, ['token']);
      if (fieldsError) {
        return fail(reply, fieldsError, 'VALIDATION_ERROR');
      }

      const { token } = request.body;
      const requestId = (request as any).requestId;

      // Look up user by verification token
      const userResult = await db.query<{ id: string; email: string }>(
        `SELECT id, email FROM identity.users 
         WHERE verification_token = $1 AND verification_token_expires_at > NOW()`,
        [token]
      );

      const user = userResult.rows[0];
      if (!user) {
        return fail(reply, 'Link inválido ou expirado', 'INVALID_TOKEN');
      }

      // Mark email as verified and clear token
      await db.query(
        `UPDATE identity.users 
         SET email_verified = TRUE, verification_token = NULL, verification_token_expires_at = NULL 
         WHERE id = $1`,
        [user.id]
      );

      // Audit email verification
      await auditLog(user.id, 'email_verified', { email: user.email }, requestId);

      // Now issue tokens (same as login)
      const userRoleResult = await db.query<{ role: string }>(
        `SELECT role FROM identity.users WHERE id = $1`,
        [user.id]
      );
      const userRole = userRoleResult.rows[0]?.role || 'user';

      const accessToken = await reply.jwtSign({ sub: user.id, user_id: user.id, role: userRole }, { expiresIn: ACCESS_TOKEN_EXPIRY });

      const refreshTokenValue = generateRefreshToken();
      const refreshTokenHash = hashRefreshToken(refreshTokenValue);
      const familyId = randomUUID();
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      await db.query(
        `INSERT INTO identity.refresh_tokens (user_id, family_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [user.id, familyId, refreshTokenHash, expiresAt]
      );

      return ok(reply, { 
        access_token: accessToken, 
        refresh_token: refreshTokenValue, 
        expires_in: 86400 
      });
    }
  );

  // Resend verification email endpoint
  fastify.post(
    '/resend-verification',
    async (request: FastifyRequest<{ Body: { email: string } }>, reply: FastifyReply) => {
      // Rate limiting - 1 request per minute per IP+email
      const clientIp = request.ip || request.headers['x-forwarded-for'] as string || 'unknown';
      const email = (request.body as { email?: string })?.email?.trim().toLowerCase() || '';
      
      if (email) {
        const allowed = await rateLimitDb(`resend-ip:${clientIp}:${email}`, 1, 60000);
        if (!allowed) {
          return fail(reply, 'Too many requests', 'RATE_LIMIT');
        }
      }

      // Always return 200 to prevent email enumeration
      if (!email || !isValidEmail(email)) {
        return ok(reply, { message: 'Se seu email estiver cadastrado, você receberá um novo link.' });
      }

      // Look up user
      const userResult = await db.query<{ id: string; email_verified: boolean }>(
        `SELECT id, email_verified FROM identity.users WHERE email = $1`,
        [email]
      );

      const user = userResult.rows[0];
      
      // If user exists and not verified, resend token
      if (user && !user.email_verified) {
        const newToken = randomUUID();
        const newExpiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_MS);

        await db.query(
          `UPDATE identity.users 
           SET verification_token = $1, verification_token_expires_at = $2 
           WHERE id = $3`,
          [newToken, newExpiresAt, user.id]
        );

        const userDetailResult = await db.query<{ display_name: string | null }>(
          `SELECT display_name FROM identity.users WHERE id = $1`,
          [user.id]
        );
        const displayName = userDetailResult.rows[0]?.display_name || '';

        const verificationUrl = `${WEB_BASE_URL}/verify-email/${newToken}`;
        const greetingName = displayName || 'olá';

        const rendered = await loadAndRender('email_verification', {
          verification_url: verificationUrl,
          display_name: greetingName,
          email,
        }) ?? renderFallback('email_verification', {
          verification_url: verificationUrl,
          display_name: greetingName,
          email,
        });

        sendEmail({
          to: email,
          subject: rendered.subject,
          html: rendered.html,
        }).catch(err => console.error('[email] resend verification failed', err));
      }
      
      // Always return success to prevent email enumeration
      return ok(reply, { message: 'Se seu email estiver cadastrado, você receberá um novo link.' });
    }
  );
}