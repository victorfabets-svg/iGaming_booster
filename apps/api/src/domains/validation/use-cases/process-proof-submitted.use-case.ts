import { createProofValidationWithClient, findValidationByProofId, updateValidationStatusWithClient, CreateProofValidationInput } from '../repositories/proof-validation.repository';
import { processValidation } from './process-validation.use-case';
import { findProofById } from '../repositories/proof.repository';
import { withTransactionalOutbox, insertEventInTransaction, insertAuditInTransaction } from '../../../../../../shared/events/transactional-outbox';

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

  // Create validation input
  const validationInput: CreateProofValidationInput = {
    proof_id: payload.proof_id,
    status: 'processing',
    validation_version: 'v1',
  };

  console.log(`🔄 Starting validation pipeline...`);
  
  try {
    // Use transactional outbox - create validation + event in same transaction
    await withTransactionalOutbox(async (client) => {
      // Domain write: Create validation record
      const validation = await createProofValidationWithClient(client, validationInput);
      console.log(`✅ Created validation record: ${validation.id} for proof: ${payload.proof_id}`);
      console.log(`   Status: ${validation.status}`);
      console.log(`   Version: ${validation.validation_version}`);

      // Event: Insert validation_started
      await insertEventInTransaction(
        client,
        'validation_started',
        {
          proof_id: payload.proof_id,
          validation_id: validation.id,
          user_id: payload.user_id,
        },
        'validation'
      );

      // Audit: Insert audit log
      await insertAuditInTransaction(
        client,
        'validation_started',
        'validation',
        validation.id,
        payload.user_id,
        { proof_id: payload.proof_id }
      );
    });

    // Process the validation (run OCR, heuristics, fraud scoring)
    // This is separate because it does its own transaction management
    await processValidation({ proof_id: payload.proof_id });
    console.log(`✨ Validation pipeline completed for proof: ${payload.proof_id}`);
  } catch (error) {
    // On any error, set status to manual_review
    console.error(`❌ Validation failed for proof: ${payload.proof_id}, setting to manual_review`);
    
    const proof = await findProofById(payload.proof_id);
    
    // Use transactional outbox - update validation + event in same transaction
    await withTransactionalOutbox(async (client) => {
      // Get the existing validation
      const validation = await findValidationByProofId(payload.proof_id);
      
      if (validation) {
        await updateValidationStatusWithClient(client, validation.id, 'manual_review');
      }
      
      await insertEventInTransaction(
        client,
        'proof_rejected',
        {
          proof_id: payload.proof_id,
          user_id: proof?.user_id || payload.user_id,
          file_url: proof?.file_url || '',
          submitted_at: payload.submitted_at,
          validation_id: validation?.id,
          reason: 'validation_error',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'validation'
      );

      if (validation) {
        await insertAuditInTransaction(
          client,
          'validation_error',
          'validation',
          validation.id,
          proof?.user_id || payload.user_id,
          { error: error instanceof Error ? error.message : 'Unknown error', proof_id: payload.proof_id }
        );
      }
    });
    console.log(`📢 Emitted proof_rejected event: validation error → manual_review (transactional)`);
  }
}