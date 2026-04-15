import React, { useState, useEffect } from 'react';
import ProofUpload from '../components/ProofUpload';
import RewardPanel from '../components/RewardPanel';
import TicketList from '../components/TicketList';
import RafflePanel from '../components/RafflePanel';
import RaffleResult from '../components/RaffleResult';
import { SystemStateProvider, useSystemState } from '../hooks/useSystemState';
import createApiClient from '../services/api';

const api = createApiClient('');

// Inner component that uses the system state
const SystemFlowContent: React.FC = () => {
  const { currentProof, setCurrentProof, rewards, setRewards, tickets, setTickets, raffles, setRaffles, results, setResults } = useSystemState();
  
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [proofStatusLoading, setProofStatusLoading] = useState(false);
  const [proofStatusError, setProofStatusError] = useState<string | null>(null);

  // Load initial data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch rewards
        setRewards([]);
        // Fetch tickets
        setTickets([]);
        // Fetch raffles
        setRaffles([]);
        // Fetch results
        setResults([]);
      } catch (err) {
        console.error('Error fetching system data:', err);
      }
    };
    fetchData();
  }, [setRewards, setTickets, setRaffles, setResults]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const res = await api.submitProof(file);
      setCurrentProof({
        id: res.proof_id,
        user_id: 'test-user',
        status: res.status,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setUploading(false);
    }
  };

  // Fetch proof status if there's a current proof
  useEffect(() => {
    if (!currentProof) return;
    
    const checkProofStatus = async () => {
      setProofStatusLoading(true);
      setProofStatusError(null);
      try {
        const proofs = await api.getRecentProofs();
        const proof = proofs.find(p => p.id === currentProof.id);
        if (proof) {
          setCurrentProof({
            ...currentProof,
            status: proof.status,
          });
        }
      } catch (err) {
        setProofStatusError(err instanceof Error ? err.message : 'unknown');
      } finally {
        setProofStatusLoading(false);
      }
    };

    // Check status every 5 seconds if proof is pending
    if (currentProof.status === 'pending' || currentProof.status === 'processing') {
      const interval = setInterval(checkProofStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [currentProof?.id]);

  const statusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'Aprovado';
      case 'rejected': return 'Rejeitado';
      case 'manual_review': return 'Revisão Manual';
      case 'processing': return 'Em Análise';
      case 'pending': return 'Pendente';
      default: return status;
    }
  };

  const statusBadgeClass = (status: string) => {
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
            {proofStatusLoading ? (
              <div className="loading-state">
                <p>Verificando status...</p>
              </div>
            ) : currentProof ? (
              <div className="proof-status">
                <div className="status-row">
                  <span className="status-label">ID:</span>
                  <span className="status-value mono">{currentProof.id}</span>
                </div>
                <div className="status-row">
                  <span className="status-label">Status:</span>
                  <span className={`badge ${statusBadgeClass(currentProof.status)}`}>
                    {statusLabel(currentProof.status)}
                  </span>
                </div>
                <div className="status-row">
                  <span className="status-label">Enviado em:</span>
                  <span className="status-value">{new Date(currentProof.created_at).toLocaleString('pt-BR')}</span>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>Nenhuma prova enviada ainda</p>
              </div>
            )}
            {proofStatusError && (
              <div className="alert-box alert-error" style={{ marginTop: 12 }}>
                <p>Erro: {proofStatusError}</p>
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
          <RaffleResult userId={currentProof?.user_id} />
        </div>
      </div>
    </section>
  );
};

const SystemFlow: React.FC = () => {
  return (
    <SystemStateProvider>
      <SystemFlowContent />
    </SystemStateProvider>
  );
};

export default SystemFlow;