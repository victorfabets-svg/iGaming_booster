import { createProofValidation, findValidationByProofId, CreateProofValidationInput } from '../repositories/proof-validation.repository';
import { processValidation } from './process-validation.use-case';

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
  await processValidation({ proof_id: payload.proof_id });
  console.log(`✨ Validation pipeline completed for proof: ${payload.proof_id}`);
}