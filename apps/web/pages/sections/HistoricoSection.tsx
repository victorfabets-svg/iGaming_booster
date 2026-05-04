import React, { useCallback, useEffect, useRef, useState } from 'react';
import createApiClient, { ProofListItem } from '../../services/api';

const api = createApiClient('');

const POLL_INTERVAL_MS = 5000;
const BRT = 'America/Sao_Paulo';

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
  return d.toLocaleString('pt-BR', {
    timeZone: BRT,
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatDateFull(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    timeZone: BRT,
    dateStyle: 'full',
    timeStyle: 'medium',
  });
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, cls: 'badge badge-gray' };
  return <span className={s.cls}>{s.label}</span>;
}

function DetailModal({ proof, onClose }: { proof: ProofListItem; onClose: () => void }) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Load the file as soon as the modal opens.
  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    setFileLoading(true);
    setFileError(null);
    (async () => {
      try {
        const blob = await api.getProofFileBlob(proof.proof_id);
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setFileUrl(createdUrl);
        setFileType(blob.type || 'application/octet-stream');
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Falha ao carregar arquivo.';
        setFileError(msg);
      } finally {
        if (!cancelled) setFileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [proof.proof_id]);

  const isImage = fileType?.startsWith('image/');
  const isPdf = fileType === 'application/pdf';

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'var(--modal-overlay, rgba(0,0,0,0.6))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="card"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 720, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <h3 className="card-title" style={{ margin: 0 }}>Detalhes do comprovante</h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ background: 'transparent', border: 0, color: 'var(--text-secondary)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
          >×</button>
        </div>

        <dl style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 12, columnGap: 16, margin: '0 0 24px' }}>
          <dt style={{ color: 'var(--text-secondary)' }}>ID</dt>
          <dd style={{ margin: 0, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{proof.proof_id}</dd>

          <dt style={{ color: 'var(--text-secondary)' }}>Enviado em</dt>
          <dd style={{ margin: 0 }}>{formatDateFull(proof.submitted_at)}</dd>

          <dt style={{ color: 'var(--text-secondary)' }}>Status</dt>
          <dd style={{ margin: 0 }}><StatusBadge status={proof.status} /></dd>

          <dt style={{ color: 'var(--text-secondary)' }}>Confiança</dt>
          <dd style={{ margin: 0 }}>
            {proof.confidence_score != null ? proof.confidence_score.toFixed(2) : '—'}
          </dd>
        </dl>

        <div
          style={{
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 8,
            padding: 12,
            background: 'var(--color-surface-primary)',
            minHeight: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {fileLoading && <p style={{ color: 'var(--text-muted)' }}>Carregando arquivo…</p>}
          {fileError && <p style={{ color: 'var(--color-error-primary)' }}>{fileError}</p>}
          {!fileLoading && !fileError && fileUrl && isImage && (
            <img
              src={fileUrl}
              alt="Comprovante"
              style={{ maxWidth: '100%', maxHeight: '60vh', display: 'block' }}
            />
          )}
          {!fileLoading && !fileError && fileUrl && isPdf && (
            <iframe
              src={fileUrl}
              title="Comprovante"
              style={{ width: '100%', height: '60vh', border: 0, background: '#fff' }}
            />
          )}
          {!fileLoading && !fileError && fileUrl && !isImage && !isPdf && (
            <a href={fileUrl} download style={{ color: 'var(--color-success-primary)' }}>
              Baixar arquivo ({fileType})
            </a>
          )}
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          {fileUrl ? (
            <a
              className="btn btn-secondary"
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              Abrir em nova aba
            </a>
          ) : <span />}
          <button className="btn btn-secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

const HistoricoSection: React.FC = () => {
  const [items, setItems] = useState<ProofListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selected, setSelected] = useState<ProofListItem | null>(null);
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

  // ESC closes the modal
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

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
                <th style={{ textAlign: 'right' }}>Ações</th>
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
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 12px', fontSize: 12 }}
                      onClick={() => setSelected(row)}
                    >
                      Visualizar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && <DetailModal proof={selected} onClose={() => setSelected(null)} />}
    </section>
  );
};

export default HistoricoSection;
