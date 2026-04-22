import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { createLogger } from '../utils/logger';

// Fallback logger used when a request is aborted BEFORE the
// preHandler hook replaces it with a request-specific instance
// (e.g. auth failure, multipart parse error, concurrency reject).
// Prevents `request.logger.error(...)` from throwing when
// request.logger would otherwise be null.
const fallbackLogger = createLogger({ module: 'http', request_id: 'preauth' });

/**
 * Request ID middleware - extracts or generates x-request-id for distributed tracing
 * Also attaches a context-aware logger to each request.
 * 
 * If the client sends x-request-id, it's preserved. Otherwise, a new UUID is generated.
 * The request ID is attached to the request object and returned in response headers.
 */
export async function requestIdMiddleware(
  fastify: FastifyInstance
): Promise<void> {
  // Decorate request with logger property for stable V8 hidden class
  fastify.decorateRequest('logger', fallbackLogger);

  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Extract incoming request ID or generate new one
    const incoming = request.headers['x-request-id'] as string | undefined;
    const requestId = incoming || randomUUID();

    // Attach to request for use in handlers
    (request as any).requestId = requestId;

    // Attach context-aware logger to request
    (request as any).logger = createLogger({
      module: 'http',
      request_id: requestId
    });

    // Set response header so client can correlate
    reply.header('x-request-id', requestId);
  });
}