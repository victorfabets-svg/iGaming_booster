// API client.
// - Real endpoints: POST /proofs, GET /health/db
// - Mocked aggregations (validation summary, funnel, recent proofs):
//   not yet exposed by the backend; return seed data so the UI is usable
//   while those endpoints are designed.

import type { ProofRow } from '../components/ProofTable';

export interface SubmitProofResponse { proof_id: string; status: string; }
export interface HealthResponse { status: 'ok' | 'degraded'; db?: 'ok' | 'down'; latencyMs?: number; }

export interface ValidationStats {
  approved: number;
  rejected: number;
  manual_review: number;
}

export interface FunnelStats {
  clicks: number;
  signups: number;
  proofs_submitted: number;
  proofs_validated: number;
}

const SEED_PROOFS: ProofRow[] = [
  { id: 'PRF-0042', date: '2026-04-14 09:12', user: 'user_123', amount: 250,  status: 'approved',      confidence: 0.94, risk: 'low',    campaign: 'FB-23',    type: 'original' },
  { id: 'PRF-0043', date: '2026-04-14 08:47', user: 'user_456', amount: 100,  status: 'rejected',      confidence: 0.31, risk: 'high',   campaign: 'FB-23',    type: 'original' },
  { id: 'PRF-0044', date: '2026-04-14 08:55', user: 'user_456', amount: 100,  status: 'manual_review', confidence: 0.87, risk: 'low',    campaign: 'FB-23',    type: 'revisao' },
  { id: 'PRF-0045', date: '2026-04-13 17:30', user: 'user_789', amount: 500,  status: 'processing',    confidence: 0.58, risk: 'medium', campaign: 'TT-Promo', type: 'original' },
  { id: 'PRF-0046', date: '2026-04-13 15:22', user: 'user_321', amount: 75,   status: 'approved',      confidence: 0.98, risk: 'low',    campaign: 'TT-Promo', type: 'original' },
  { id: 'PRF-0047', date: '2026-04-13 12:05', user: 'user_654', amount: 200,  status: 'pending',       confidence: null, risk: null,     campaign: 'GG-Slot',  type: 'original' },
];

const createApiClient = (baseUrl: string) => {
  const url = (path: string) => `${baseUrl}${path}`;

  return {
    async getHealth(): Promise<HealthResponse> {
      const start = performance.now();
      const res = await fetch(url('/health/db'));
      const latencyMs = Math.round(performance.now() - start);
      if (!res.ok) return { status: 'degraded', db: 'down', latencyMs };
      try {
        const json = await res.json() as { status?: string; db?: string };
        const ok = (json.status === 'ok' || json.db === 'ok');
        return { status: ok ? 'ok' : 'degraded', db: ok ? 'ok' : 'down', latencyMs };
      } catch {
        return { status: 'ok', db: 'ok', latencyMs };
      }
    },

    async submitProof(file: File, userId: string = 'test-user'): Promise<SubmitProofResponse> {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', userId);
      const response = await fetch(url('/proofs'), { method: 'POST', body: formData });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    },

    async getValidationStats(): Promise<ValidationStats> {
      // TODO: replace with GET /validation/stats once backend exposes it
      return { approved: 704, rejected: 420, manual_review: 156 };
    },

    async getFunnelStats(): Promise<FunnelStats> {
      // TODO: replace with GET /analytics/funnel once backend exposes it
      return { clicks: 10000, signups: 3200, proofs_submitted: 1280, proofs_validated: 704 };
    },

    async getRecentProofs(): Promise<ProofRow[]> {
      // TODO: replace with GET /proofs?limit=N
      return SEED_PROOFS;
    },
  };
};

export default createApiClient;
