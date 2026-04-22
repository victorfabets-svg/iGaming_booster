/**
 * Error mapping utility.
 * Maps errors to standardized format for consistent API responses.
 */

export interface MappedError {
  message: string;
  code: string;
  type: 'VALIDATION' | 'BUSINESS' | 'SYSTEM';
}

export function mapError(err: any): MappedError {
  // Fastify validation error (query/body schema validation)
  if (err.code === 'VALIDATION_ERROR' || err.validation) {
    return {
      message: err.message || 'Validation failed',
      code: 'VALIDATION_ERROR',
      type: 'VALIDATION'
    };
  }

  // Forbidden/access denied
  if (err.code === 'FORBIDDEN' || err.statusCode === 403) {
    return {
      message: err.message || 'Access denied',
      code: 'FORBIDDEN',
      type: 'BUSINESS'
    };
  }

  // Not found
  if (err.code === 'NOT_FOUND' || err.statusCode === 404) {
    return {
      message: err.message || 'Resource not found',
      code: 'NOT_FOUND',
      type: 'BUSINESS'
    };
  }

  // Unauthorized
  if (err.code === 'UNAUTHORIZED' || err.statusCode === 401) {
    return {
      message: err.message || 'Authentication required',
      code: 'UNAUTHORIZED',
      type: 'BUSINESS'
    };
  }

  // Default to internal error
  return {
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
    type: 'SYSTEM'
  };
}