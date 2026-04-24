import { createProofValidationWithClient, findValidationByProofId, updateValidationStatusWithClient, CreateProofValidationInput } from '../repositories/proof-validation.repository';
import { findProofById } from '../repositories/proof.repository';
import { insertEventInTransaction, insertAuditInTransaction } from '@shared/events/transactional-outbox';
import { logger } from '@shared/observability/logger';

export interface ProofSubmittedEventPayload {
  proof_id: string;
  user_id: string;
  file_url: string;
  submitted_at: string;
}

export async function processProofSubmitted(payload: ProofSubmittedEventPayload, client: any): Promise<void> {
  logger.info({
    event: 'proof_submitted_processing',
    context: 'validation',
    data: { proof_id: payload.proof_id }
  });

  // Check if validation already exists (idempotency)
  const existingValidation = await findValidationByProofId(payload.proof_id);
  
  if (existingValidation) {
    logger.info({
      event: 'validation_already_exists',
      context: 'validation',
      data: { proof_id: payload.proof_id }
    });
    return;
  }

  // Create validation input
  const validationInput: CreateProofValidationInput = {
    proof_id: payload.proof_id,
    status: 'processing',
    validation_version: 'v1',
  };

  logger.info({
    event: 'validation_pipeline_start',
    context: 'validation',
    data: { proof_id: payload.proof_id }
  });
  
  try {
    // Domain write: Create validation record
    const validation = await createProofValidationWithClient(client, validationInput);
    logger.info({
      event: 'validation_created',
      context: 'validation',
      data: { validation_id: validation.id, proof_id: payload.proof_id, status: validation.status }
    });

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

    // EVENT CHAIN: proof_submitted → fraud_check_requested + payment_identifier_requested
    // Sprint 5.2 pipeline contract — both events fan out from validation_started.
    await insertEventInTransaction(
      client,
      'fraud_check_requested',
      {
        proof_id: payload.proof_id,
        user_id: payload.user_id,
        validation_id: validation.id,
      },
      'validation'
    );


    await insertEventInTransaction(
      client,
      'payment_identifier_requested',
      {
        proof_id: payload.proof_id,
        user_id: payload.user_id,
        validation_id: validation.id,
        file_url: payload.file_url,
      },
      'validation'
    );

    logger.info({
      event: 'validation_pipeline_completed',
      context: 'validation',
      data: { proof_id: payload.proof_id }
    });
  } catch (error) {
    logger.error('validation_error', 'validation', `Failed: ${error}`);
    
    const proof = await findProofById(payload.proof_id);
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
  }
}
