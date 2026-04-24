import React, { useCallback, useEffect, useRef, useState } from 'react';
import createApiClient, { ProofListItem } from '../../services/api';

const api = createApiClient('');

const POLL_INTERVAL_MS = 5000;

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  approved:      { label: 'Aprovado',    cls: 'badge badge-success' },
  rejected:      { label: 'Rejeitado',   cls: 'badge badge-error' },
  manual_review: { label: 'Revisão',     cls: 'badge badge-purple' },
  processing:    { label: 'Em análise',  cls: 'badge badge-warning' },
  pending:       { label: 'Enviado',     cls: 'badge badge-gray' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, cls: 'badge badge-gray' };
  return <span className={s.cls}>{s.label}</span>;
}

const HistoricoSection: React.FC = () => {
  const [items, setItems] = useState<ProofListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const intervalRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getRecentProofs();
      setItems(data);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar histórico';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
    intervalRef.current = window.setInterval(load, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [load]);

  if (loading && items === null) {
    return (
      <section>
        <div className="loading-state" style={{ padding: 48, textAlign: 'center' }}>
          <p>Carregando histórico…</p>
        </div>
      </section>
    );
  }

  if (error && items === null) {
    return (
      <section>
        <div className="card g-col-12" style={{ padding: 32 }}>
          <h3 className="card-title">Histórico</h3>
          <p style={{ color: 'var(--color-error-primary)' }}>{error}</p>
          <button className="btn btn-secondary" onClick={load} style={{ marginTop: 12 }}>
            Tentar novamente
          </button>
        </div>
      </section>
    );
  }

  const rows = items ?? [];

  return (
    <section>
      <div className="card g-col-12" style={{ padding: 0, overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '24px 24px 0' }}>
          <h3 className="card-title">Meus comprovantes</h3>
          {error && (
            <span style={{ color: 'var(--color-warning-primary)', fontSize: 12 }}>
              Atualização falhou: {error}
            </span>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="empty-state" style={{ padding: 48, textAlign: 'center' }}>
            <p>Você ainda não enviou comprovantes.</p>
          </div>
        ) : (
          <table className="table-engine">
            <thead>
              <tr>
                <th>Data</th>
                <th>ID</th>
                <th>Status</th>
                <th>Confiança</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.proof_id}>
                  <td className="mono">{formatDate(row.submitted_at)}</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {row.proof_id.slice(0, 8)}…
                  </td>
                  <td><StatusBadge status={row.status} /></td>
                  <td>{row.confidence_score != null ? row.confidence_score.toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};

export default HistoricoSection;
