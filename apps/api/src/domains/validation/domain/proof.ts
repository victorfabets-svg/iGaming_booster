export interface Proof {
  id: string;
  user_id: string;
  file_url: string;
  hash: string;
  submitted_at: string;
  promotion_id?: string | null;
}

export interface ProofInput {
  user_id: string;
  file_buffer: Buffer;
  filename?: string;
  promotion_id?: string;
}

export interface ProofResult {
  proof: Proof;
  isNew: boolean;
}