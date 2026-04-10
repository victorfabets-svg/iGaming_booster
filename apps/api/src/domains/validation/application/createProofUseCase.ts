import { createHash } from 'crypto';
import { emitEvent } from '../../../../shared/events/emitter';
import { createProof } from '../infrastructure/proofRepository';
import { ProofInput } from '../domain/proof';

function generateHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function simulateStorage(proofId: string): string {
  return `https://storage.local/proofs/${proofId}`;
}

export async function createProofUseCase(input: ProofInput): Promise<{ proof_id: string; status: string }> {
  console.log('[PROOF] Request received for user_id:', input.user_id);

  // Validate buffer is not empty
  if (!input.file_buffer || input.file_buffer.length === 0) {
    throw new Error('Invalid file buffer: empty or missing');
  }

  // Generate hash from file buffer
  const hash = generateHash(input.file_buffer);

  // Generate proof ID for storage URL simulation
  const tempId = `proof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const fileUrl = simulateStorage(tempId);

  // Insert proof - DB enforces idempotency via UNIQUE constraint
  const result = await createProof(input, fileUrl, hash);

  console.log('[PROOF] Created proof:', result.proof.id);

  // Only emit event for new proofs (not duplicates)
  if (result.isNew) {
    await emitEvent({
      event_type: 'proof_submitted',
      producer: 'validation',
      payload: {
        proof_id: result.proof.id,
        user_id: result.proof.user_id,
        hash: result.proof.hash,
      },
    });
    console.log('[PROOF] Event proof_submitted emitted for:', result.proof.id);
  } else {
    console.log('[PROOF] Duplicate proof - skipping event emit');
  }

  return { proof_id: result.proof.id, status: 'submitted' };
}