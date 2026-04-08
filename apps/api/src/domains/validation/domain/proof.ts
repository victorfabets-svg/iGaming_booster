export interface Proof {
  id: string;
  user_id: string;
  file_url: string;
  hash: string;
  created_at: string;
}

export interface ProofInput {
  user_id: string;
  file_buffer: Buffer;
}