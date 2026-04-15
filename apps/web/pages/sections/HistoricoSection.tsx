import React, { useState } from 'react';
import ProofTable from '../../components/ProofTable';
import ProofUpload from '../../components/ProofUpload';
import { useSystemState } from '../../state/useSystemState';
import createApiClient from '../../services/api';

const api = createApiClient('');

const HistoricoSection: React.FC = () => {
  // Use ONLY global system state - no duplicate local state
  const { proof, loading, error, loadProof } = useSystemState();
  
  // Keep UI-only state (filters are not data state)
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [campaignFilter, setCampaignFilter] = useState<string>('');

  const handleUpload = async (file: File) => {
    try {
      // Step 1: Submit the file to backend
      const res = await api.submitProof(file);
      
      // Step 2: Extract proof_id from backend response
      const { proof_id } = res;
      
      // Step 3: Load the proof using correct proof_id
      // This updates global state (loading, error, proof)
      await loadProof(proof_id);
    } catch (err) {
      // Error is already set in global state via loadProof
      console.error('Upload failed:', err);
    }
  };

  // Show single proof from global state or empty state if no proof exists
  const proofsToShow = proof ? [proof] : [];
  const hasFilter = statusFilter || campaignFilter;
  
  // Apply filters if they exist
  const filteredProofs = proofsToShow.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (campaignFilter && p.campaign !== campaignFilter) return false;
    return true;
  });

  const showEmpty = hasFilter || filteredProofs.length === 0;

  if (loading) {
    return (
      <section>
        <div className="loading-state">
          <p>Carregando dados...</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="g-row">
        <div className="card g-col-12">
          <h3 className="card-title">Enviar Comprovante</h3>
          <ProofUpload onSubmit={handleUpload} loading={loading} />
          {error && <p style={{ color: 'var(--color-error-primary)', marginTop: 12 }}>Falha no envio: {error}</p>}
          {proof && (
            <p style={{ color: 'var(--color-success-primary)', marginTop: 12, fontSize: 13 }}>
              Comprovante enviado: <code>{proof.id}</code> — status: <b>{proof.status || 'pending'}</b>
            </p>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-label">Status</span>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="approved">Aprovado</option>
            <option value="rejected">Rejeitado</option>
            <option value="manual_review">Revisão</option>
            <option value="processing">Em Análise</option>
            <option value="pending">Enviado</option>
          </select>
        </div>
        <div className="filter-divider" />
        <div className="filter-group">
          <span className="filter-label">Período</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" />
            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>até</span>
            <input type="date" />
          </div>
        </div>
        <div className="filter-divider" />
        <div className="filter-group">
          <span className="filter-label">Campanha</span>
          <select value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)}>
            <option value="">Todas</option>
            <option value="FB-23">FB-23</option>
            <option value="TT-Promo">TT-Promo</option>
            <option value="GG-Slot">GG-Slot</option>
          </select>
        </div>
        <button className="btn-filter-apply">Aplicar Filtros</button>
      </div>

      <div className="g-row">
        {showEmpty ? (
          <div className="card g-col-12">
            <div className="empty-state">
              <p>Nenhum comprovante encontrado</p>
            </div>
          </div>
        ) : (
          <ProofTable rows={filteredProofs} />
        )}
      </div>
    </section>
  );
};

export default HistoricoSection;