import React, { useState, useEffect } from 'react';
import ProofUpload from '../components/ProofUpload';
import RewardPanel from '../components/RewardPanel';
import TicketList from '../components/TicketList';
import RafflePanel from '../components/RafflePanel';
import RaffleResult from '../components/RaffleResult';
import { useSystemState } from '../state/useSystemState';
import createApiClient from '../services/api';

const api = createApiClient('');

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

  const statusLabel = (status: string | null) => {
    switch (status) {
      case 'approved': return 'Aprovado';
      case 'rejected': return 'Rejeitado';
      case 'manual_review': return 'Revisão Manual';
      case 'processing': return 'Em Análise';
      case 'pending': return 'Pendente';
      default: return status || 'Desconhecido';
    }
  };

  const statusBadgeClass = (status: string | null) => {
    switch (status) {
      case 'approved': return 'badge-success';
      case 'rejected': return 'badge-error';
      case 'manual_review': return 'badge-warning';
      case 'processing': return 'badge-blue';
      case 'pending': return 'badge-warning';
      default: return 'badge-gray';
    }
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
                <p>Verificando status...</p>
              </div>
            ) : error ? (
              <div className="alert-box alert-error">
                <p>Erro: {error}</p>
              </div>
            ) : proof ? (
              <div className="proof-status">
                <div className="status-row">
                  <span className="status-label">ID:</span>
                  <span className="status-value mono">{proof.id}</span>
                </div>
                <div className="status-row">
                  <span className="status-label">Status:</span>
                  <span className={`badge ${statusBadgeClass(proof.status)}`}>
                    {statusLabel(proof.status)}
                  </span>
                </div>
                <div className="status-row">
                  <span className="status-label">Enviado em:</span>
                  <span className="status-value">{new Date(proof.submitted_at).toLocaleString('pt-BR')}</span>
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
    </section>
  );
};

const SystemFlow: React.FC = () => {
  return <SystemFlowContent />;
};

export default SystemFlow;