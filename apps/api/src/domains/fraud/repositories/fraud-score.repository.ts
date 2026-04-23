import { getDb, db } from '@shared/database/connection';

export interface FraudScore {
  id: string;
  proof_id: string;
  score: number;
  signals: Record<string, unknown>;
  created_at: Date;
}

export interface CreateFraudScoreInput {
  proof_id: string;
  score: number;
  signals: Record<string, unknown>;
}

export async function createFraudScore(input: CreateFraudScoreInput): Promise<FraudScore> {
  const result = await getDb().query(
    `INSERT INTO fraud.fraud_scores (proof_id, score, signals)
     VALUES ($1, $2, $3)
     RETURNING id, proof_id, score, signals, created_at`,
    [input.proof_id, input.score, JSON.stringify(input.signals)]
  );
  return result.rows[0];
}

/**
 * Create fraud score within a transaction.
 * Uses provided client for atomicity.
 */
export async function createFraudScoreWithClient(
  client: any,
  input: CreateFraudScoreInput
): Promise<FraudScore> {
  const result = await client.query(
    `INSERT INTO fraud.fraud_scores (proof_id, score, signals)
     VALUES ($1, $2, $3)
     RETURNING id, proof_id, score, signals, created_at`,
    [input.proof_id, input.score, JSON.stringify(input.signals)]
  );
  return result.rows[0];
}

export async function findFraudScoreByProofId(proofId: string): Promise<FraudScore | null> {
  return await db.query<FraudScore>(
    `SELECT id, proof_id, score, signals, created_at 
     FROM fraud.fraud_scores 
     WHERE proof_id = $1`,
    [proofId]
  ).then(r => r.rows[0] || null);
}