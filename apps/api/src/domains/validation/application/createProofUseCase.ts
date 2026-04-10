import { emitEvent } from '../../../../../../shared/events/emitter';
import { createProof } from '../infrastructure/proofRepository';
import { ProofInput } from '../domain/proof';
import { generateSHA256 } from '../../../../../../shared/utils/hash';
import { getStorageService } from '../../../infrastructure/storage';

/**
 * Determine content type from file extension
 */
function getContentType(ext: string): string {
  const contentTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'pdf': 'application/pdf',
    'webp': 'image/webp',
  };
  return contentTypes[ext.toLowerCase()] || 'application/octet-stream';
}

export async function createProofUseCase(input: ProofInput): Promise<{ proof_id: string; status: string }> {
  console.log('[PROOF] Request received for user_id:', input.user_id);

  // Validate buffer is not empty
  if (!input.file_buffer || input.file_buffer.length === 0) {
    throw new Error('Invalid file buffer: empty or missing');
  }

  // Generate hash first (before any operations that might fail)
  const hash = generateSHA256(input.file_buffer);

  // Get storage service
  const storageService = getStorageService();

  // Generate path and content type in domain layer (not in adapter)
  const filename = input.filename || 'proof.pdf';
  const fileExt = filename.split('.').pop() || 'pdf';
  const path = `proofs/${input.user_id}/${hash.substring(0, 8)}.${fileExt}`;
  const contentType = getContentType(fileExt);

  // Upload file to storage and get public URL
  const fileUrl = await storageService.upload(input.file_buffer, path, contentType);

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