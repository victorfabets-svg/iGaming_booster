import React, { useState, useEffect } from 'react';
import ProofUpload from '../components/ProofUpload';
import RewardPanel from '../components/RewardPanel';
import TicketList from '../components/TicketList';
import RafflePanel from '../components/RafflePanel';
import RaffleResult from '../components/RaffleResult';
import MetricsPanel from '../components/MetricsPanel';
import { useSystemState } from '../state/useSystemState';
import createApiClient from '../services/api';

const api = createApiClient('');

// Status mapping as per backend
const STATUS_MAP: Record<string, string> = {
  'submitted': 'Recebido',
  'processing': 'Em análise',
  'approved': 'Aprovado',
  'rejected': 'Rejeitado',
  'manual_review': 'Em revisão',
};

// Visual status mapping
const STATUS_VISUAL: Record<string, { class: string; color: string }> = {
  'submitted': { class: 'badge-gray', color: 'var(--text-secondary)' },
  'processing': { class: 'badge-blue', color: 'var(--color-primary-primary)' },
  'approved': { class: 'badge-success', color: 'var(--color-success-primary)' },
  'rejected': { class: 'badge-error', color: 'var(--color-error-primary)' },
  'manual_review': { class: 'badge-warning', color: 'var(--color-warning-primary)' },
};

// Timeline steps based on backend status
const TIMELINE_STEPS = ['submitted', 'processing', 'approved', 'rejected', 'manual_review'];

// Inner component that uses the system state
const SystemFlowContent: React.FC = () => {
  const { proof, loading, error, loadProof } = useSystemState();
  
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const res = await api.submitProof(file);
      // Load the proof to get full details and start polling
      loadProof(res.proof_id);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setUploading(false);
    }
  };

  // Get current step in timeline
  const getCurrentStep = (status: string | null): number => {
    if (!status) return 0;
    const index = TIMELINE_STEPS.indexOf(status);
    return index >= 0 ? index : 0;
  };

  // Format confidence as percentage
  const formatConfidence = (score: number | null): string => {
    if (score === null || score === undefined) return 'N/A';
    return `${Math.round(score * 100)}%`;
  };

  // Get status display info
  const getStatusInfo = (status: string | null) => {
    const mappedStatus = status ? STATUS_MAP[status] : 'Desconhecido';
    const visual = status ? STATUS_VISUAL[status] : { class: 'badge-gray', color: 'var(--text-muted)' };
    return { label: mappedStatus, ...visual };
  };

  return (
    <section className="system-flow">
      <div className="flow-header">
        <h2>Fluxo do Sistema</h2>
        <p>Visualize todo o ciclo: prova → recompensa → bilhetes → sorteio → resultado</p>
      </div>

      {/* Step 1: Upload */}
      <div className="flow-step">
        <div className="step-indicator">
          <span className="step-number">1</span>
          <span className="step-label">Enviar Comprovante</span>
        </div>
        <div className="step-content">
          <div className="card">
            <ProofUpload onSubmit={handleUpload} loading={uploading} />
            {uploadError && (
              <div className="alert-box alert-error" style={{ marginTop: 12 }}>
                <p>Erro: {uploadError}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Arrow */}
      <div className="flow-arrow">↓</div>

      {/* Step 2: Proof Status */}
      <div className="flow-step">
        <div className="step-indicator">
          <span className="step-number">2</span>
          <span className="step-label">Status da Prova</span>
        </div>
        <div className="step-content">
          <div className="card">
            {loading ? (
              <div className="loading-state">
                <p>Processando...</p>
              </div>
            ) : error ? (
              <div className="alert-box alert-error">
                <p>Erro: {error}</p>
              </div>
            ) : proof ? (
              <div className="proof-status">
                {/* ID */}
                <div className="status-row">
                  <span className="status-label">ID:</span>
                  <span className="status-value mono">{proof.id}</span>
                </div>
                
                {/* Status Badge */}
                <div className="status-row">
                  <span className="status-label">Status:</span>
                  <span className={`badge ${getStatusInfo(proof.status).class}`}>
                    {getStatusInfo(proof.status).label}
                  </span>
                </div>

                {/* Confidence Score */}
                {proof.confidence_score !== null && proof.confidence_score !== undefined && (
                  <div className="status-row">
                    <span className="status-label">Confiança:</span>
                    <span className="status-value confidence-score">
                      {formatConfidence(proof.confidence_score)}
                    </span>
                  </div>
                )}

                {/* Submitted At */}
                <div className="status-row">
                  <span className="status-label">Enviado em:</span>
                  <span className="status-value">
                    {proof.submitted_at ? new Date(proof.submitted_at).toLocaleString('pt-BR') : 'N/A'}
                  </span>
                </div>

                {/* Timeline */}
                <div className="validation-timeline">
                  <div className="timeline-label">Progresso da Validação</div>
                  <div className="timeline-steps">
                    <div className={`timeline-step ${getCurrentStep(proof.status) >= 0 ? 'active' : ''}`}>
                      <span className="step-dot"></span>
                      <span className="step-text">Recebido</span>
                    </div>
                    <div className={`timeline-step ${getCurrentStep(proof.status) >= 1 ? 'active' : ''}`}>
                      <span className="step-dot"></span>
                      <span className="step-text">Em análise</span>
                    </div>
                    <div className={`timeline-step ${getCurrentStep(proof.status) >= 2 ? 'active' : ''} ${proof.status === 'approved' ? 'completed' : ''}`}>
                      <span className="step-dot"></span>
                      <span className="step-text">Resultado</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>Nenhuma prova enviada ainda</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Arrow */}
      <div className="flow-arrow">↓</div>

      {/* Step 3: Reward Panel */}
      <div className="flow-step">
        <div className="step-indicator">
          <span className="step-number">3</span>
          <span className="step-label">Recompensa</span>
        </div>
        <div className="step-content">
          <RewardPanel />
        </div>
      </div>

      {/* Arrow */}
      <div className="flow-arrow">↓</div>

      {/* Step 4: Ticket List */}
      <div className="flow-step">
        <div className="step-indicator">
          <span className="step-number">4</span>
          <span className="step-label">Bilhetes</span>
        </div>
        <div className="step-content">
          <TicketList />
        </div>
      </div>

      {/* Arrow */}
      <div className="flow-arrow">↓</div>

      {/* Step 5: Raffle Panel */}
      <div className="flow-step">
        <div className="step-indicator">
          <span className="step-number">5</span>
          <span className="step-label">Sorteio</span>
        </div>
        <div className="step-content">
          <RafflePanel />
        </div>
      </div>

      {/* Arrow */}
      <div className="flow-arrow">↓</div>

      {/* Step 6: Raffle Result */}
      <div className="flow-step">
        <div className="step-indicator">
          <span className="step-number">6</span>
          <span className="step-label">Resultado</span>
        </div>
        <div className="step-content">
          <RaffleResult userId={proof?.user_id} />
        </div>
      </div>

      {/* Arrow */}
      <div className="flow-arrow">↓</div>

      {/* Step 7: Metrics Panel */}
      <div className="flow-step">
        <div className="step-indicator">
          <span className="step-number">7</span>
          <span className="step-label">Métricas</span>
        </div>
        <div className="step-content">
          <MetricsPanel />
        </div>
      </div>
    </section>
  );
};

const SystemFlow: React.FC = () => {
  return <SystemFlowContent />;
};

export default SystemFlow;