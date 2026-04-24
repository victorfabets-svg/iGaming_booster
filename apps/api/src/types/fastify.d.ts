import 'fastify';
import type { createLogger } from '../server/utils/logger';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
    logger: ReturnType<typeof createLogger>;
  }
}

export {};
