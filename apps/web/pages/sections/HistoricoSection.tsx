import React, { useEffect, useState, useMemo } from 'react';
import ProofTable, { ProofRow } from '../../components/ProofTable';
import ProofUpload from '../../components/ProofUpload';
import createApiClient from '../../services/api';

const api = createApiClient('');

const HistoricoSection: React.FC = () => {
  const [proofs, setProofs] = useState<ProofRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastUploadId, setLastUploadId] = useState<string | null>(null);
  const [lastUploadStatus, setLastUploadStatus] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [campaignFilter, setCampaignFilter] = useState<string>('');

  useEffect(() => {
    const fetchProofs = async () => {
      try {
        const data = await api.getRecentProofs();
        // Map API response to ProofRow format
        const mappedProofs: ProofRow[] = data.map((p: any) => ({
          id: p.id,
          date: new Date(p.submitted_at).toISOString().replace('T', ' ').slice(0, 16),
          user: p.user_id,
          amount: null,
          status: p.status || 'pending',
          confidence: p.confidence_score,
          risk: null,
          campaign: null,
          type: 'original',
        }));
        setProofs(mappedProofs);
      } catch (err) {
        console.error('Failed to fetch proofs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProofs();
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const res = await api.submitProof(file);
      setLastUploadId(res.proof_id);
      setLastUploadStatus(res.status);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setUploading(false);
    }
  };

  const filtered = useMemo(() => {
    return proofs.filter(p => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (campaignFilter && p.campaign !== campaignFilter) return false;
      return true;
    });
  }, [proofs, statusFilter, campaignFilter]);

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
        {filtered.length > 0 ? (
          <ProofTable rows={filtered} />
        ) : (
          <div className="card g-col-12">
            <div className="empty-state">
              <p>Nenhum comprovante encontrado</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default HistoricoSection;