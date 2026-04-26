import { FastifyRequest, FastifyReply } from 'fastify';
import { timingSafeEqual } from 'crypto';

/**
 * Tipster auth middleware - validates X-Tipster-API-Key header
 * Uses timingSafeEqual to prevent timing attacks
 */
export async function tipsterAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const provided = request.headers['x-tipster-api-key'];
  const expected = process.env.TIPSTER_API_KEY;

  if (!expected || !provided || typeof provided !== 'string') {
    reply.status(401).send({ error: 'Unauthorized' });
    return;
  }

  // Constant-time comparison; both buffers must be same length
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    reply.status(401).send({ error: 'Unauthorized' });
    return;
  }
  // Auth passed — handler proceeds
}