import { getDb, db } from '@shared/database/connection';

export interface ProofValidation {
  id: string;
  proof_id: string;
  status: string;
  confidence_score: number | null;
  validation_version: string;
  validated_at: Date | null;
  created_at: Date;
}

export interface CreateProofValidationInput {
  proof_id: string;
  status: string;
  validation_version: string;
}

export async function createProofValidation(input: CreateProofValidationInput): Promise<ProofValidation> {
  const result = await getDb().query(
    `INSERT INTO validation.proof_validations (proof_id, status, validation_version)
     VALUES ($1, $2, $3)
     RETURNING id, proof_id, status, confidence_score, validation_version, validated_at, created_at`,
    [input.proof_id, input.status, input.validation_version]
  );
  return result.rows[0];
}

/**
 * Create proof validation within a transaction.
 * Uses provided client for atomicity.
 */
export async function createProofValidationWithClient(
  client: any,
  input: CreateProofValidationInput
): Promise<ProofValidation> {
  const result = await client.query(
    `INSERT INTO validation.proof_validations (proof_id, status, validation_version)
     VALUES ($1, $2, $3)
     RETURNING id, proof_id, status, confidence_score, validation_version, validated_at, created_at`,
    [input.proof_id, input.status, input.validation_version]
  );
  return result.rows[0];
}

export async function findValidationByProofId(proofId: string): Promise<ProofValidation | null> {
  return await db.query<ProofValidation>(
    `SELECT id, proof_id, status, confidence_score, validation_version, validated_at, created_at
     FROM validation.proof_validations
     WHERE proof_id = $1`,
    [proofId]
  ).then(rows => rows[0] || null);
}

export async function updateValidationStatus(
  id: string,
  status: string,
  confidenceScore?: number
): Promise<void> {
  await getDb().query(
    `UPDATE validation.proof_validations
     SET status = $1, confidence_score = $2, validated_at = NOW()
     WHERE id = $3`,
    [status, confidenceScore ?? null, id]
  );
}

/**
 * Update validation status within a transaction.
 * Uses provided client for atomicity.
 */
export async function updateValidationStatusWithClient(
  client: any,
  id: string,
  status: string,
  confidenceScore?: number
): Promise<void> {
  await client.query(
    `UPDATE validation.proof_validations
     SET status = $1, confidence_score = $2, validated_at = NOW()
     WHERE id = $3`,
    [status, confidenceScore ?? null, id]
  );
}