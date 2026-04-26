/**
 * Fraud Signals Repository
 * Queries behavioral signals from validation.proofs table:
 * - duplicate_hash_other_users: count of how many OTHER users submitted this same hash
 * - user_velocity_1h: count of user's submits in last 1 hour
 * - user_velocity_24h: count of user's submits in last 24 hours
 * 
 * Uses a single CTE query to minimize round-trips.
 */

import { db } from '@shared/database/connection';
import { logger } from '@shared/observability/logger';

export interface BehavioralSignals {
  duplicate_hash_other_users: number;
  user_velocity_1h: number;
  user_velocity_24h: number;
}

/**
 * Fetch behavioral signals for a given proof_id.
 * 
 * Uses single CTE to get all signals in one query:
 * - duplicate_hash_other_users: counts other users with the same hash
 * - user_velocity_1h: counts user's proofs in last 1 hour
 * - user_velocity_24h: counts user's proofs in last 24 hours
 * 
 * @param proofId - The proof ID to analyze
 * @returns BehavioralSignals with counts
 */
export async function fetchBehavioralSignals(proofId: string): Promise<BehavioralSignals> {
  const query = `
    WITH p AS (
      SELECT user_id, hash 
      FROM validation.proofs 
      WHERE id = $1
    ),
    counts AS (
      SELECT
        (SELECT COUNT(*)::int 
         FROM validation.proofs pr, p 
         WHERE pr.hash = p.hash AND pr.user_id != p.user_id) AS duplicate_hash_other_users,
        (SELECT COUNT(*)::int 
         FROM validation.proofs pr, p 
         WHERE pr.user_id = p.user_id 
           AND pr.submitted_at >= NOW() - INTERVAL '1 hour') AS user_velocity_1h,
        (SELECT COUNT(*)::int 
         FROM validation.proofs pr, p 
         WHERE pr.user_id = p.user_id 
           AND pr.submitted_at >= NOW() - INTERVAL '24 hours') AS user_velocity_24h
      FROM p
      WHERE EXISTS (SELECT 1 FROM p)
    )
    SELECT 
      COALESCE(MAX(duplicate_hash_other_users), 0) AS duplicate_hash_other_users,
      COALESCE(MAX(user_velocity_1h), 0) AS user_velocity_1h,
      COALESCE(MAX(user_velocity_24h), 0) AS user_velocity_24h
    FROM counts
    LIMIT 1
  `;

  try {
    const result = await db.query<BehavioralSignals>(query, [proofId]);
    
    if (result.rows.length === 0) {
      // Proof not found - return zeros
      logger.warn({
        event: 'proof_not_found_for_signals',
        context: 'fraud',
        data: { proof_id: proofId }
      });
      return {
        duplicate_hash_other_users: 0,
        user_velocity_1h: 0,
        user_velocity_24h: 0
      };
    }

    const signals = result.rows[0];
    
    logger.info({
      event: 'behavioral_signals_fetched',
      context: 'fraud',
      data: { proof_id: proofId, signals }
    });

    return signals;
  } catch (error) {
    logger.error({
      event: 'behavioral_signals_query_failed',
      context: 'fraud',
      data: { proof_id: proofId, error: String(error) }
    });
    // Return zeros on error to be safe
    return {
      duplicate_hash_other_users: 0,
      user_velocity_1h: 0,
      user_velocity_24h: 0
    };
  }
}