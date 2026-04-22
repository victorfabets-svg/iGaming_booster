/**
 * Centralized logger with automatic context injection.
 * All logs automatically include bound context (request_id, correlation_id, etc.)
 */

export interface LogData extends Record<string, unknown> {
  event?: string;
  [key: string]: unknown;
}

export interface Logger {
  info(data: LogData): void;
  error(data: LogData): void;
  warn(data: LogData): void;
  debug(data: LogData): void;
}

/**
 * Create a logger with bound context.
 * Context is automatically included in every log entry.
 * 
 * NOTE: timestamp is generated per-log, not per-logger (fixes timestamp drift)
 */
export function createLogger(context: Record<string, unknown> = {}): Logger {
  const boundContext = { ...context };

  const log = (level: string, data: LogData) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(), // Generate fresh timestamp per log
      level,
      ...boundContext,
      ...data
    }));
  };

  return {
    info: (data) => log('info', data),
    error: (data) => log('error', data),
    warn: (data) => log('warn', data),
    debug: (data) => log('debug', data),
  };
}

/**
 * Fastify request extension with logger
 */
export interface RequestWithLogger {
  logger: Logger;
  requestId?: string;
  ip?: string;
  headers?: Record<string, unknown>;
}

/**
 * Create logger from request - extracts requestId automatically
 */
export function createRequestLogger(request: RequestWithLogger): Logger {
  const requestId = request?.requestId || (request?.headers as any)?.['x-request-id'];
  return createLogger({ 
    request_id: requestId,
    ip: request?.ip || (request?.headers as any)?.['x-forwarded-for']
  });
}

/**
 * Create logger for worker/consumer with correlation_id
 */
export function createWorkerLogger(correlationId?: string): Logger {
  return createLogger({ 
    ...(correlationId && { correlation_id: correlationId })
  });
}