"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processProofSubmitted = processProofSubmitted;
const proof_validation_repository_1 = require("../repositories/proof-validation.repository");
const process_validation_use_case_1 = require("./process-validation.use-case");
async function processProofSubmitted(payload) {
    console.log(`📥 Processing proof_submitted event for proof: ${payload.proof_id}`);
    // Check if validation already exists (idempotency)
    const existingValidation = await (0, proof_validation_repository_1.findValidationByProofId)(payload.proof_id);
    if (existingValidation) {
        console.log(`⏭️  Validation already exists for proof: ${payload.proof_id}, skipping`);
        return;
    }
    // Create validation record with status "processing"
    const validationInput = {
        proof_id: payload.proof_id,
        status: 'processing',
        validation_version: 'v1',
    };
    const validation = await (0, proof_validation_repository_1.createProofValidation)(validationInput);
    console.log(`✅ Created validation record: ${validation.id} for proof: ${payload.proof_id}`);
    console.log(`   Status: ${validation.status}`);
    console.log(`   Version: ${validation.validation_version}`);
    // Process the validation (run OCR, heuristics, fraud scoring)
    console.log(`🔄 Starting validation pipeline...`);
    await (0, process_validation_use_case_1.processValidation)({ proof_id: payload.proof_id });
    console.log(`✨ Validation pipeline completed for proof: ${payload.proof_id}`);
}
//# sourceMappingURL=process-proof-submitted.use-case.js.map