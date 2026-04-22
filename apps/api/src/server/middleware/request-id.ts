import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

/**
 * Request ID middleware - extracts or generates x-request-id for distributed tracing
 * 
 * If the client sends x-request-id, it's preserved. Otherwise, a new UUID is generated.
 * The request ID is attached to the request object and returned in response headers.
 */
export async function requestIdMiddleware(
  fastify: FastifyInstance
): Promise<void> {
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Extract incoming request ID or generate new one
    const incoming = request.headers['x-request-id'] as string | undefined;
    const requestId = incoming || randomUUID();

    // Attach to request for use in handlers
    (request as any).requestId = requestId;

    // Set response header so client can correlate
    reply.header('x-request-id', requestId);
  });
}