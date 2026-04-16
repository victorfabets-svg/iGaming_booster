import { createProofInTransaction } from '../infrastructure/proofRepository';
import { ProofInput } from '../domain/proof';
import { generateSHA256 } from 'shared/utils/hash';
import { getStorageService } from '../../../infrastructure/storage';
import { withTransactionalOutbox, insertEventInTransaction, insertAuditInTransaction } from 'shared/events/transactional-outbox';
import { config } from 'shared/config/env';

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

export interface CreateProofResult {
  proof_id: string;
  status: string;
  file_url?: string;
  expires_in?: number;
}

export async function createProofUseCase(input: ProofInput): Promise<CreateProofResult> {
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

  // Upload file to storage and get storage key (outside transaction - not a DB op)
  const { key } = await storageService.upload(input.file_buffer, path, contentType);
  console.log('[PROOF] Storage key:', key);

  // Use transactional outbox to ensure atomicity: proof + event + audit in same tx
  const result = await withTransactionalOutbox(async (client) => {
    // Insert proof within transaction
    const proofResult = await createProofInTransaction(client, input, key, hash);
    console.log('[PROOF] Created proof:', proofResult.proof.id);

    // Only insert event and audit for new proofs (not duplicates)
    if (proofResult.isNew) {
      // Insert event in same transaction
      await insertEventInTransaction(
        client,
        'proof_submitted',
        {
          proof_id: proofResult.proof.id,
          user_id: proofResult.proof.user_id,
          hash: proofResult.proof.hash,
        },
        'validation'
      );
      console.log('[PROOF] Event proof_submitted inserted in transaction for:', proofResult.proof.id);

      // Insert audit log in same transaction
      await insertAuditInTransaction(
        client,
        'proof_submitted',
        'proof',
        proofResult.proof.id,
        proofResult.proof.user_id,
        {
          action: 'proof_created',
          file_url: proofResult.proof.file_url,
          hash: proofResult.proof.hash,
        }
      );
    } else {
      console.log('[PROOF] Duplicate proof - skipping event insert');
    }

    return proofResult;
  });

  // Generate signed URL for R2 (best effort - failures should not crash the response)
  let signedUrl: string | undefined;
  let expiresIn: number | undefined;
  
  try {
    // Check if R2 is configured (preferred) - use centralized config
    const { r2Endpoint, r2AccessKeyId, r2SecretAccessKey } = config.storage;
    if (r2Endpoint && r2AccessKeyId && r2SecretAccessKey) {
      // getStorageService returns R2StorageAdapter which has getSignedUrl
      signedUrl = await (storageService as any).getSignedUrl(path, 300); // 5 minutes
      expiresIn = 300;
      console.log('[PROOF] Generated signed URL, expires in:', expiresIn, 'seconds');
    }
  } catch (error) {
    // Signed URL is optional - log but don't fail
    console.error('[PROOF] Signed URL generation failed:', (error as Error).message);
  }

  return { 
    proof_id: result.proof.id, 
    status: 'submitted',
    file_url: signedUrl,
    expires_in: expiresIn
  };
}