/**
 * Standardized API response helpers.
 * Ensures consistent response contract for frontend integration.
 */

/**
 * Send successful response with data.
 */
export function ok(res: any, data: any): any {
  return res.json({
    success: true,
    data,
    error: null
  });
}

/**
 * Send error response with message and optional code.
 */
export function fail(
  res: any,
  message: string,
  code: string = 'INTERNAL_ERROR'
): any {
  return res.status(500).json({
    success: false,
    data: null,
    error: {
      message,
      code
    }
  });
}