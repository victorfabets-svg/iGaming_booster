import { createProofValidation, findValidationByProofId, updateValidationStatus, CreateProofValidationInput } from '../repositories/proof-validation.repository';
import { processValidation } from './process-validation.use-case';
import { findProofById } from '../repositories/proof.repository';
import { withTransactionalOutbox, queueEventInTransaction } from '../../../../../../shared/events/transactional-outbox';

export interface ProofSubmittedEventPayload {
  proof_id: string;
  user_id: string;
  file_url: string;
  submitted_at: string;
}

export async function processProofSubmitted(payload: ProofSubmittedEventPayload): Promise<void> {
  console.log(`📥 Processing proof_submitted event for proof: ${payload.proof_id}`);

  // Check if validation already exists (idempotency)
  const existingValidation = await findValidationByProofId(payload.proof_id);
  
  if (existingValidation) {
    console.log(`⏭️  Validation already exists for proof: ${payload.proof_id}, skipping`);
    return;
  }

  // Create validation record with status "processing"
  const validationInput: CreateProofValidationInput = {
    proof_id: payload.proof_id,
    status: 'processing',
    validation_version: 'v1',
  };

  const validation = await createProofValidation(validationInput);

  console.log(`✅ Created validation record: ${validation.id} for proof: ${payload.proof_id}`);
  console.log(`   Status: ${validation.status}`);
  console.log(`   Version: ${validation.validation_version}`);

  // Process the validation (run OCR, heuristics, fraud scoring)
  console.log(`🔄 Starting validation pipeline...`);
  
  try {
    await processValidation({ proof_id: payload.proof_id });
    console.log(`✨ Validation pipeline completed for proof: ${payload.proof_id}`);
  } catch (error) {
    // On any error, set status to manual_review
    console.error(`❌ Validation failed for proof: ${payload.proof_id}, setting to manual_review`);
    
    const proof = await findProofById(payload.proof_id);
    
    // Use transactional outbox
    await withTransactionalOutbox(async (txnId) => {
      await updateValidationStatus(validation.id, 'manual_review');
      
      queueEventInTransaction(txnId, 'proof_rejected', {
        proof_id: payload.proof_id,
        user_id: proof?.user_id || payload.user_id,
        file_url: proof?.file_url || '',
        submitted_at: payload.submitted_at,
        validation_id: validation.id,
        reason: 'validation_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'validation');
    });
    console.log(`📢 Emitted proof_rejected event: validation error → manual_review (transactional)`);
  }
}