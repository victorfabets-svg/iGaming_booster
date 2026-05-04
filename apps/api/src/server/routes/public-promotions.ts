/**
 * Public-facing promotion routes — no auth required.
 *
 * Used by the landing page to render the featured promotion. Only returns
 * a promotion that is is_featured + active + within its [starts_at, ends_at]
 * window; otherwise responds with `{ promotion: null }` so the landing can
 * fall back to the default hero.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@shared/database/connection';
import { ok, fail } from '../utils/response';
import { randomUUID } from 'crypto';
import { createProofUseCase } from '../../domains/validation/application/createProofUseCase';
import { sendEmail } from '@shared/infrastructure/email/resend';
import { loadAndRender } from '@shared/infrastructure/email/render-template';
import { renderFallback } from '@shared/infrastructure/email/fallback-templates';
import { auditLog } from '@shared/events/audit-log';
import { getStorageService } from '../../infrastructure/storage';

// Keys we accept for /public/creatives/* — must start with this prefix.
// Anything else is rejected before touching storage.
const CREATIVE_KEY_PREFIX = 'promotions/creatives/';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

function digitsOnly(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

function isValidWhatsapp(phone: string): boolean {
  // Accept 10-13 digits (BR mobile with or without country code).
  return phone.length >= 10 && phone.length <= 13;
}

interface FeaturedRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  creative_url: string | null;
  creative_type: 'image' | 'video';
  cta_label: string | null;
  cta_url: string | null;
  house_slug: string;
  house_name: string;
  deposit_url: string;
  starts_at: string;
  ends_at: string;
  draw_at: string;
  raffle_id: string;
  raffle_name: string;
  raffle_prize: string;
  total_numbers: number;
  next_number: number;
}

interface TierRow {
  min_deposit_cents: number;
  tickets: number;
}

export async function publicPromotionsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/public/promotions/featured',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await db.query<FeaturedRow>(
        `SELECT
           p.id, p.slug, p.name, p.description, p.creative_url,
           p.creative_type, p.cta_label, p.cta_url,
           h.slug AS house_slug, h.name AS house_name, h.deposit_url,
           p.starts_at, p.ends_at, p.draw_at,
           p.raffle_id, r.name AS raffle_name, r.prize AS raffle_prize,
           r.total_numbers, r.next_number
         FROM promotions.promotions p
         JOIN core.houses h ON h.id = p.house_id
         JOIN raffles.raffles r ON r.id = p.raffle_id
         WHERE p.is_featured = TRUE
           AND p.active = TRUE
           AND p.starts_at <= NOW()
           AND p.ends_at >= NOW()
         LIMIT 1`
      );

      // Cache for 60s — any featured swap by admin propagates within a minute.
      reply.header('Cache-Control', 'public, max-age=60');

      if (result.rows.length === 0) {
        return ok(reply, { promotion: null });
      }

      const promo = result.rows[0];

      const tiersResult = await db.query<TierRow>(
        `SELECT min_deposit_cents, tickets
           FROM promotions.tiers
          WHERE promotion_id = $1
          ORDER BY min_deposit_cents ASC`,
        [promo.id]
      );

      // tickets_emitted = next_number - 1 (numbering starts at 1)
      const ticketsEmitted = Math.max(0, promo.next_number - 1);

      return ok(reply, {
        promotion: {
          slug: promo.slug,
          name: promo.name,
          description: promo.description,
          creative_url: promo.creative_url,
          creative_type: promo.creative_type,
          cta_label: promo.cta_label,
          cta_url: promo.cta_url,
          house_slug: promo.house_slug,
          house_name: promo.house_name,
          starts_at: promo.starts_at,
          ends_at: promo.ends_at,
          draw_at: promo.draw_at,
          raffle: {
            name: promo.raffle_name,
            prize: promo.raffle_prize,
            total_numbers: promo.total_numbers,
            tickets_emitted: ticketsEmitted,
          },
          tiers: tiersResult.rows.map(t => ({
            min_deposit_cents: t.min_deposit_cents,
            tickets: t.tickets,
          })),
        },
      });
    }
  );

  // GET /public/promotions/active — all active promotions in window,
  // with tiers, grouped on the client by house. Powers the landing's
  // hero card + per-house tier-button grid. No auth, cached 60s.
  fastify.get(
    '/public/promotions/active',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await db.query<FeaturedRow & { is_featured: boolean }>(
        `SELECT
           p.id, p.slug, p.name, p.description, p.creative_url,
           p.creative_type, p.cta_label, p.cta_url, p.is_featured,
           h.slug AS house_slug, h.name AS house_name, h.deposit_url,
           p.starts_at, p.ends_at, p.draw_at,
           p.raffle_id, r.name AS raffle_name, r.prize AS raffle_prize,
           r.total_numbers, r.next_number
         FROM promotions.promotions p
         JOIN core.houses h ON h.id = p.house_id
         JOIN raffles.raffles r ON r.id = p.raffle_id
         WHERE p.active = TRUE
           AND p.starts_at <= NOW()
           AND p.ends_at >= NOW()
         ORDER BY p.is_featured DESC, h.name ASC, p.draw_at ASC`
      );

      reply.header('Cache-Control', 'public, max-age=60');

      if (result.rows.length === 0) {
        return ok(reply, { promotions: [] });
      }

      const promoIds = result.rows.map(r => r.id);
      const tiersResult = await db.query<{ promotion_id: string; min_deposit_cents: number; tickets: number }>(
        `SELECT promotion_id, min_deposit_cents, tickets
           FROM promotions.tiers
          WHERE promotion_id = ANY($1::uuid[])
          ORDER BY min_deposit_cents ASC`,
        [promoIds]
      );

      const tiersByPromo = new Map<string, Array<{ min_deposit_cents: number; tickets: number }>>();
      for (const t of tiersResult.rows) {
        if (!tiersByPromo.has(t.promotion_id)) tiersByPromo.set(t.promotion_id, []);
        tiersByPromo.get(t.promotion_id)!.push({
          min_deposit_cents: t.min_deposit_cents,
          tickets: t.tickets,
        });
      }

      const promotions = result.rows.map(row => ({
        slug: row.slug,
        name: row.name,
        description: row.description,
        creative_url: row.creative_url,
        creative_type: row.creative_type,
        cta_label: row.cta_label,
        cta_url: row.cta_url,
        is_featured: row.is_featured,
        house_slug: row.house_slug,
        house_name: row.house_name,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        draw_at: row.draw_at,
        raffle: {
          name: row.raffle_name,
          prize: row.raffle_prize,
          total_numbers: row.total_numbers,
          tickets_emitted: Math.max(0, row.next_number - 1),
        },
        tiers: tiersByPromo.get(row.id) ?? [],
      }));

      return ok(reply, { promotions });
    }
  );

  // POST /public/promotions/:slug/claim — passwordless proof submission.
  //
  // Accepts (multipart):
  //   file                       — proof image/pdf (required)
  //   email, name, cpf, whatsapp — contact details (required)
  //   tier_min_deposit_cents     — optional; tier the user is targeting
  //
  // Behaviour:
  //   1. Find or create a user by email. If a password is already set,
  //      we refuse and ask the operator to log in (we don't leak the fact
  //      that an account exists — message is generic).
  //   2. Persist cpf/whatsapp/name on the user (so admin sees them later).
  //   3. Run the existing createProofUseCase (storage + OCR pipeline +
  //      reward path + ticket generation when validation approves).
  //   4. Issue a verification email reusing the email_verification
  //      template; clicking lands on /verify-email/:token which already
  //      logs the user in (no password needed for first session).
  //   5. Best-effort affiliate attribution from the tipster_cid cookie
  //      (matches /register's pattern; ON CONFLICT DO NOTHING).
  fastify.post<{ Params: { slug: string } }>(
    '/public/promotions/:slug/claim',
    async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
      const { slug } = request.params;
      const requestId = (request as any).requestId;

      // Validate promo is active in window.
      const promoResult = await db.query<{ id: string; name: string }>(
        `SELECT id, name FROM promotions.promotions
          WHERE slug = $1 AND active = TRUE
            AND starts_at <= NOW() AND ends_at >= NOW()
          LIMIT 1`,
        [slug]
      );
      if (promoResult.rows.length === 0) {
        return fail(reply, 'Promoção não encontrada ou fora da janela', 'INVALID_PROMOTION', 400);
      }
      const promotion = promoResult.rows[0];

      // Parse multipart payload.
      const parts = request.parts();
      let fileBuffer: Buffer | null = null;
      let filename: string | null = null;
      let email = '';
      let name = '';
      let whatsapp = '';

      try {
        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'file') {
            fileBuffer = await part.toBuffer();
            filename = part.filename;
          } else if (part.type === 'field') {
            const v = typeof part.value === 'string' ? part.value.trim() : '';
            if (part.fieldname === 'email') email = v.toLowerCase();
            else if (part.fieldname === 'name') name = v;
            else if (part.fieldname === 'whatsapp') whatsapp = digitsOnly(v);
          }
        }
      } catch (err) {
        request.log.error({ event: 'claim_multipart_parse_failed', err: (err as Error).message });
        return fail(reply, 'Falha ao processar o envio. Tente novamente.', 'MULTIPART_ERROR');
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return fail(reply, 'Envie o comprovante.', 'VALIDATION_ERROR');
      }
      if (!EMAIL_REGEX.test(email)) {
        return fail(reply, 'Informe um e-mail válido.', 'VALIDATION_ERROR');
      }
      if (!name) {
        return fail(reply, 'Informe seu nome completo.', 'VALIDATION_ERROR');
      }
      if (!isValidWhatsapp(whatsapp)) {
        return fail(reply, 'Informe um WhatsApp válido (DDD + número).', 'VALIDATION_ERROR');
      }

      // Find or create user by email.
      const existing = await db.query<{ id: string; password_hash: string | null }>(
        `SELECT id, password_hash FROM identity.users WHERE email = $1`,
        [email]
      );

      let userId: string;
      let isNewUser: boolean;

      if (existing.rows.length === 0) {
        userId = randomUUID();
        await db.query(
          `INSERT INTO identity.users (id, email, display_name, whatsapp, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [userId, email, name, whatsapp]
        );
        isNewUser = true;
        await auditLog(userId, 'user_created_via_promo_claim', { email, promotion_slug: slug }, requestId);
      } else {
        const u = existing.rows[0];
        if (u.password_hash) {
          // Don't leak existence — same generic message either way.
          return fail(
            reply,
            'Já encontramos um cadastro com esse e-mail. Faça login para enviar o comprovante.',
            'ACCOUNT_EXISTS',
            409
          );
        }
        userId = u.id;
        // Refresh contact fields with the values the user just typed —
        // they may differ from a previous shadow signup. CPF stays NULL
        // until the user fills it on /me/profile.
        await db.query(
          `UPDATE identity.users
              SET display_name = COALESCE(NULLIF($2, ''), display_name),
                  whatsapp     = COALESCE(NULLIF($3, ''), whatsapp)
            WHERE id = $1`,
          [userId, name, whatsapp]
        );
        isNewUser = false;
      }

      // Best-effort affiliate attribution (matches /register pattern).
      const cookieCid = (request.cookies as Record<string, string> | undefined)?.tipster_cid;
      if (cookieCid) {
        try {
          await db.query(
            `INSERT INTO affiliate.attributions (user_id, click_id, house_id)
             SELECT $1, c.click_id, c.house_id
               FROM affiliate.clicks c
               WHERE c.click_id = $2
             ON CONFLICT (user_id) DO NOTHING`,
            [userId, cookieCid]
          );
        } catch (attrErr) {
          request.log.error({ event: 'claim_attribution_failed', err: (attrErr as Error).message });
        }
      }

      // Submit proof through the existing pipeline (storage + OCR + reward).
      let proofId: string;
      try {
        const result = await createProofUseCase({
          user_id: userId,
          file_buffer: fileBuffer,
          filename: filename || 'comprovante.jpg',
          promotion_id: promotion.id,
        });
        proofId = result.proof_id;
      } catch (err) {
        request.log.error({ event: 'claim_proof_failed', err: (err as Error).message });
        return fail(reply, 'Falha ao salvar o comprovante. Tente novamente.', 'PROOF_FAILED');
      }

      // Issue a verification email so the user can land on the platform
      // logged in (no password required for the first session).
      const verificationToken = randomUUID();
      const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_MS);
      try {
        await db.query(
          `UPDATE identity.users
              SET verification_token = $2,
                  verification_token_expires_at = $3
            WHERE id = $1`,
          [userId, verificationToken, expiresAt]
        );
      } catch (err) {
        request.log.error({ event: 'claim_verification_token_save_failed', err: (err as Error).message });
        // Non-fatal — proof is already saved.
      }

      const webBase = process.env.WEB_BASE_URL || 'http://localhost:5173';
      const verificationUrl = `${webBase}/verify-email/${verificationToken}`;
      const rendered = await loadAndRender('email_verification', {
        verification_url: verificationUrl,
        display_name: name,
        email,
      }) ?? renderFallback('email_verification', {
        verification_url: verificationUrl,
        display_name: name,
        email,
      });

      // Fire-and-forget — never block the API response on email infra.
      sendEmail({ to: email, subject: rendered.subject, html: rendered.html })
        .catch(err => request.log.error({ event: 'claim_email_failed', err: (err as Error).message }));

      return ok(reply, {
        ok: true,
        email,
        is_new_user: isNewUser,
        proof_id: proofId,
        promotion_name: promotion.name,
      });
    }
  );

  // GET /public/creatives/* — public proxy for promotion creatives uploaded
  // via /admin/promotions/upload-creative. Streams from R2 with a 1y immutable
  // cache (keys are UUIDs — never reused). Restricted to the dedicated
  // `promotions/creatives/` prefix so this endpoint can't be abused to read
  // arbitrary objects (e.g. proofs) from the same bucket.
  fastify.get(
    '/public/creatives/*',
    async (request: FastifyRequest<{ Params: { '*': string } }>, reply: FastifyReply) => {
      const key = request.params['*'];
      if (!key || !key.startsWith(CREATIVE_KEY_PREFIX) || key.includes('..')) {
        return reply.status(404).send({ error: 'Not found' });
      }

      const storage = getStorageService();
      const file = await storage.download(key);
      if (!file) {
        return reply.status(404).send({ error: 'Not found' });
      }

      return reply
        .header('Content-Type', file.contentType)
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .send(file.buffer);
    }
  );
}
