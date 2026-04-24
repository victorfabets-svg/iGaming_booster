// API client.
// - All endpoints call real backend APIs
// - No mock or seed data

export interface SubmitProofResponse { proof_id: string; status: string; }
export interface HealthResponse { status: 'ok' | 'degraded'; db?: 'ok' | 'down'; latencyMs?: number; }

// List item shape returned by GET /proofs (flat, status joined from proof_validations).
export interface ProofListItem {
  proof_id: string;
  submitted_at: string;
  status: string;
  confidence_score: number | null;
}

// Detail shape returned by GET /proofs/:id.
export interface Proof {
  id: string;
  user_id: string;
  file_url: string;
  hash: string;
  submitted_at: string;
  status: string | null;
  confidence_score: number | null;
  validated_at: string | null;
}

// Reward types
export interface Reward {
  id: string;
  user_id: string;
  proof_id: string;
  type: string;
  status: string;
  created_at: string;
}

// Raffle types
export interface Raffle {
  id: string;
  name: string;
  prize: string;
  total_numbers: number;
  draw_date: string;
  status: string;
}

// Raffle result types
export interface RaffleResult {
  raffle_id: string;
  raffle_name: string;
  prize: string;
  result_number: number;
  winner_user_id: string | null;
  winner_ticket_id: string | null;
  executed_at: string;
}

// Metrics types
export interface MetricsSummary {
  proof_submissions: number;
  validations: {
    approved: number;
    rejected: number;
    manual_review: number;
  };
  rewards: {
    granted: number;
    blocked: number;
  };
  tickets_generated: number;
  raffle_executions: number;
  fraud_signals: number;
}

export interface MetricsResponse {
  metrics: string;
  summary: MetricsSummary;
}

// Event types
export interface SystemEvent {
  id: string;
  event_type: string;
  version: string;
  timestamp: string;
  producer: string;
  correlation_id: string;
  payload: Record<string, unknown>;
}

const DEV_JWT: string | undefined = (import.meta as any).env?.VITE_DEV_JWT;

const authHeaders = (): Record<string, string> =>
  DEV_JWT ? { Authorization: `Bearer ${DEV_JWT}` } : {};

function httpErrorMessage(status: number, fallback: string): string {
  if (status === 401 || status === 403) return 'Sessão expirada. Faça login novamente.';
  if (status === 404) return 'Recurso não encontrado.';
  if (status === 413) return 'Arquivo muito grande.';
  if (status === 429) return 'Muitas tentativas. Aguarde alguns instantes.';
  if (status >= 500) return 'Serviço temporariamente indisponível.';
  return fallback;
}

const createApiClient = (baseUrl: string) => {
  const url = (path: string) => `${baseUrl}${path}`;

  return {
    async getHealth(): Promise<HealthResponse> {
      const start = performance.now();
      const res = await fetch(url('/health/db'), { headers: authHeaders() });
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
      const response = await fetch(url('/proofs'), {
        method: 'POST',
        body: formData,
        headers: { ...authHeaders() },
      });
      if (!response.ok) {
        throw new Error(httpErrorMessage(response.status, 'Falha ao enviar comprovante.'));
      }
      return response.json();
    },

    async getRecentProofs(): Promise<ProofListItem[]> {
      const response = await fetch(url('/proofs'), { headers: authHeaders() });
      if (!response.ok) {
        throw new Error(httpErrorMessage(response.status, 'Falha ao carregar comprovantes.'));
      }
      return response.json();
    },

    async getProof(id: string): Promise<Proof> {
      const response = await fetch(url(`/proofs/${id}`), { headers: authHeaders() });
      if (!response.ok) {
        throw new Error(httpErrorMessage(response.status, 'Falha ao carregar comprovante.'));
      }
      return response.json();
    },

    async getRewards(): Promise<Reward[]> {
      const response = await fetch(url('/rewards'), { headers: authHeaders() });
      if (!response.ok) {
        throw new Error(httpErrorMessage(response.status, 'Falha ao carregar recompensas.'));
      }
      return response.json();
    },

    async getRaffles(): Promise<Raffle[]> {
      const response = await fetch(url('/raffles'), { headers: authHeaders() });
      if (!response.ok) {
        throw new Error(httpErrorMessage(response.status, 'Falha ao carregar sorteios.'));
      }
      return response.json();
    },

    async getRaffleById(id: string): Promise<Raffle> {
      const response = await fetch(url(`/raffles/${id}`), { headers: authHeaders() });
      if (!response.ok) {
        throw new Error(httpErrorMessage(response.status, 'Falha ao carregar sorteio.'));
      }
      return response.json();
    },

    async getRaffleResult(id: string): Promise<RaffleResult> {
      const response = await fetch(url(`/raffles/${id}/result`), { headers: authHeaders() });
      if (!response.ok) {
        throw new Error(httpErrorMessage(response.status, 'Falha ao carregar resultado do sorteio.'));
      }
      return response.json();
    },

    async getMetrics(): Promise<MetricsResponse> {
      const response = await fetch(url('/metrics'), { headers: authHeaders() });
      if (!response.ok) {
        throw new Error(httpErrorMessage(response.status, 'Falha ao carregar métricas.'));
      }
      return response.json();
    },
  };
};

export default createApiClient;
