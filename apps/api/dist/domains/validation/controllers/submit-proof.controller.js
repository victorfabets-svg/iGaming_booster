"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSubmitProof = handleSubmitProof;
exports.createSubmitProofController = createSubmitProofController;
const submit_proof_use_case_1 = require("../use-cases/submit-proof.use-case");
async function handleSubmitProof(body) {
    const input = {
        user_id: body.user_id,
        file_url: body.file_url,
    };
    const result = await (0, submit_proof_use_case_1.submitProof)(input);
    return {
        proof_id: result.proof_id,
    };
}
// For demonstration purposes - a simple Express-like handler structure
function createSubmitProofController() {
    return async (req) => {
        return handleSubmitProof(req.body);
    };
}
//# sourceMappingURL=submit-proof.controller.js.map