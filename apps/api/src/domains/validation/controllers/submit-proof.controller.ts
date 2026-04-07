import { submitProof, SubmitProofInput } from '../use-cases/submit-proof.use-case';

export interface SubmitProofRequest {
  user_id: string;
  file_url: string;
}

export interface SubmitProofResponse {
  proof_id: string;
}

export async function handleSubmitProof(body: SubmitProofRequest): Promise<SubmitProofResponse> {
  const input: SubmitProofInput = {
    user_id: body.user_id,
    file_url: body.file_url,
  };

  const result = await submitProof(input);

  return {
    proof_id: result.proof_id,
  };
}

// For demonstration purposes - a simple Express-like handler structure
export function createSubmitProofController() {
  return async (req: { body: SubmitProofRequest }) => {
    return handleSubmitProof(req.body);
  };
}