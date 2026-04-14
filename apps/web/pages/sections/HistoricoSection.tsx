import React, { useMemo, useState } from 'react';
import ProofTable, { ProofRow } from '../../components/ProofTable';
import ProofUpload from '../../components/ProofUpload';

interface Props {
  proofs: ProofRow[];
  onUpload: (file: File) => void;
  uploading: boolean;
  uploadError: string | null;
  lastUploadId?: string | null;
  lastUploadStatus?: string | null;
}

const HistoricoSection: React.FC<Props> = ({ proofs, onUpload, uploading, uploadError, lastUploadId, lastUploadStatus }) => {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [campaignFilter, setCampaignFilter] = useState<string>('');

  const filtered = useMemo(() => proofs.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (campaignFilter && p.campaign !== campaignFilter) return false;
    return true;
  }), [proofs, statusFilter, campaignFilter]);

  return (
    <section>
      <div className="g-row">
        <div className="card g-col-12">
          <h3 className="card-title">Enviar Comprovante</h3>
          <ProofUpload onSubmit={onUpload} loading={uploading} />
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
        <ProofTable rows={filtered} />
      </div>
    </section>
  );
};

export default HistoricoSection;
