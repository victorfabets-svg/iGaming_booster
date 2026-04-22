import { db } from 'shared/database/connection';

/**
 * Audit logger - records critical actions for traceability
 * @param userId - The user performing the action (null for system actions)
 * @param action - The action being performed (e.g., 'user_registered', 'proof_submitted')
 * @param metadata - Additional context about the action
 * @param correlationId - Optional request correlation ID for end-to-end tracing
 */
export async function auditLog(
  userId: string | null,
  action: string,
  metadata: Record<string, unknown> = {},
  correlationId?: string
): Promise<void> {
  try {
    // Include correlation_id in metadata for traceability
    const fullMetadata = {
      ...metadata,
      ...(correlationId && { correlation_id: correlationId })
    };
    
    await db.query(
      `INSERT INTO audit.logs (user_id, action, metadata)
       VALUES ($1, $2, $3)`,
      [userId, action, JSON.stringify(fullMetadata)]
    );
  } catch (err) {
    // Log error but don't fail the main flow
    console.error('[AUDIT] Failed to write audit log:', err);
  }
}

/**
 * System audit log - for actions not tied to a specific user
 */
export async function systemAuditLog(
  action: string,
  metadata: Record<string, unknown> = {},
  correlationId?: string
): Promise<void> {
  return auditLog(null, action, metadata, correlationId);
}