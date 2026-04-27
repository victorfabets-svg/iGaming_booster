import { FastifyRequest, FastifyReply } from 'fastify';
import { timingSafeEqual } from 'crypto';

/**
 * Subscription platform auth middleware - validates X-Subscription-Platform-Key header
 * Uses timingSafeEqual to prevent timing attacks
 */
export async function subscriptionAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const provided = request.headers['x-subscription-platform-key'];
  const expected = process.env.SUBSCRIPTION_PLATFORM_API_KEY;

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