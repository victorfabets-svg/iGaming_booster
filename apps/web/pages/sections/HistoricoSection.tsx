import React, { useState } from 'react';
import ProofTable, { ProofRow } from '../../components/ProofTable';
import ProofUpload from '../../components/ProofUpload';
import { useSystemState } from '../../state/useSystemState';

const HistoricoSection: React.FC = () => {
  const { proof, loading: globalLoading, error, loadProof } = useSystemState();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastUploadId, setLastUploadId] = useState<string | null>(null);
  const [lastUploadStatus, setLastUploadStatus] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [campaignFilter, setCampaignFilter] = useState<string>('');

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const res = await loadProof(file.name);
      setLastUploadId(res.proof_id);
      setLastUploadStatus(res.status);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setUploading(false);
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

  if (globalLoading) {
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
          <ProofUpload onSubmit={handleUpload} loading={uploading} />
          {uploadError && <p style={{ color: 'var(--color-error-primary)', marginTop: 12 }}>Falha no envio: {uploadError}</p>}
          {lastUploadId && (
            <p style={{ color: 'var(--color-success-primary)', marginTop: 12, fontSize: 13 }}>
              Comprovante enviado: <code>{lastUploadId}</code> — status: <b>{lastUploadStatus || 'pending'}</b>
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