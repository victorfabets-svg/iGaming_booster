/**
 * Standardized API response helpers.
 * Ensures consistent response contract for frontend integration.
 */

/**
 * Send successful response with data.
 */
export function ok(res: any, data: any): any {
  return res.send({
    success: true,
    data,
    error: null
  });
}

/**
 * Default HTTP status mapping per error code. Codes not listed fall back
 * to 500 so the helper stays backwards-compatible. Callers can override
 * with the explicit `status` argument when the route needs a non-default
 * mapping.
 */
const DEFAULT_STATUS_BY_CODE: Record<string, number> = {
  VALIDATION_ERROR: 400,
  INVALID_TOKEN: 400,
  NO_PASSWORD: 400,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  INVALID_PASSWORD: 401,
  INVALID_REFRESH: 401,
  EXPIRED_REFRESH: 401,
  FAMILY_REVOKED: 401,
  FORBIDDEN: 403,
  EMAIL_NOT_VERIFIED: 403,
  NOT_FOUND: 404,
  DUPLICATE_EMAIL: 409,
  IDEMPOTENCY_IN_PROGRESS: 409,
  RATE_LIMIT: 429,
  INTERNAL_ERROR: 500,
};

/**
 * Send error response with message and optional code/status.
 * - code defaults to INTERNAL_ERROR
 * - status is inferred from code unless explicitly passed (back-compat)
 */
export function fail(
  res: any,
  message: string,
  code: string = 'INTERNAL_ERROR',
  status?: number
): any {
  const httpStatus = status ?? DEFAULT_STATUS_BY_CODE[code] ?? 500;
  return res.status(httpStatus).send({
    success: false,
    data: null,
    error: {
      message,
      code
    }
  });
}