import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@shared/database/connection';
import { ok, fail } from '../utils/response';
import { authMiddleware } from '@shared/infrastructure/auth/middleware';
import { requireAdmin } from '@shared/infrastructure/auth/require-admin';
import { sendEmail } from '@shared/infrastructure/email/resend';
import { loadAndRender } from '@shared/infrastructure/email/render-template';
import { renderFallback } from '@shared/infrastructure/email/fallback-templates';

/**
 * Admin email templates routes
 */
export async function adminEmailTemplatesRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require auth + admin
  fastify.addHook('preHandler', async (request, reply) => {
    await authMiddleware(request, reply);
    await requireAdmin(fastify)(request, reply);
  });

  // GET /admin/email-templates
  fastify.get(
    '/admin/email-templates',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await db.query<{
        key: string;
        subject: string;
        html_body: string;
        description: string | null;
        supported_variables: string[];
        updated_at: Date;
      }>(
        `SELECT key, subject, html_body, description, supported_variables, updated_at
         FROM notifications.email_templates
         ORDER BY key`,
        []
      );

      return ok(reply, { templates: result.rows });
    }
  );

  // GET /admin/email-templates/:key
  fastify.get(
    '/admin/email-templates/:key',
    async (request: FastifyRequest<{ Params: { key: string } }>, reply: FastifyReply) => {
      const { key } = request.params;

      const result = await db.query<{
        key: string;
        subject: string;
        html_body: string;
        description: string | null;
        supported_variables: string[];
        updated_at: Date;
      }>(
        `SELECT key, subject, html_body, description, supported_variables, updated_at
         FROM notifications.email_templates WHERE key = $1`,
        [key]
      );

      const template = result.rows[0];
      if (!template) {
        return fail(reply, 'Template not found', 'NOT_FOUND');
      }

      return ok(reply, template);
    }
  );

  // PUT /admin/email-templates/:key
  fastify.put(
    '/admin/email-templates/:key',
    async (request: FastifyRequest<{ Params: { key: string }; Body: { subject: string; html_body: string; description?: string } }>, reply: FastifyReply) => {
      const { key } = request.params;
      const { subject, html_body, description } = request.body;

      // Check if template exists
      const existsResult = await db.query<{ key: string }>(
        `SELECT key FROM notifications.email_templates WHERE key = $1`,
        [key]
      );

      if (!existsResult.rows[0]) {
        return fail(reply, 'Template not found - can only update existing templates', 'NOT_FOUND');
      }

      // Update template
      await db.query(
        `UPDATE notifications.email_templates 
         SET subject = $1, html_body = $2, description = $3, updated_at = NOW()
         WHERE key = $4`,
        [subject, html_body, description || null, key]
      );

      return ok(reply, { message: 'Template updated' });
    }
  );

  // POST /admin/email-templates/:key/preview
  fastify.post(
    '/admin/email-templates/:key/preview',
    async (request: FastifyRequest<{ Params: { key: string }; Body: { vars: Record<string, string> } }>, reply: FastifyReply) => {
      const { key } = request.params;
      const { vars } = request.body;

      // Sample values for preview
      const sampleVars = {
        verification_url: 'https://example.com/verify-email/sample-token',
        display_name: 'Maria Silva',
        email: 'maria@example.com',
        ...vars,
      };

      const rendered = await loadAndRender(key, sampleVars) ?? renderFallback(key, sampleVars);
      if (!rendered) {
        return fail(reply, 'Template not found', 'NOT_FOUND');
      }

      return ok(reply, rendered);
    }
  );

  // POST /admin/email-templates/:key/test-send
  fastify.post(
    '/admin/email-templates/:key/test-send',
    async (request: FastifyRequest<{ Params: { key: string }; Body: { to: string; vars?: Record<string, string> } }>, reply: FastifyReply) => {
      const { key } = request.params;
      const { to, vars } = request.body;

      if (!to) {
        return fail(reply, 'Email address required', 'VALIDATION_ERROR');
      }

      // Sample values for test send
      const sampleVars = {
        verification_url: 'https://example.com/verify-email/sample-token',
        display_name: 'Maria Silva',
        email: to,
        ...vars,
      };

      const rendered = await loadAndRender(key, sampleVars) ?? renderFallback(key, sampleVars);
      if (!rendered) {
        return fail(reply, 'Template not found', 'NOT_FOUND');
      }

      const result = await sendEmail({
        to,
        subject: `[TEST] ${rendered.subject}`,
        html: rendered.html,
      });

      return ok(reply, result);
    }
  );
}