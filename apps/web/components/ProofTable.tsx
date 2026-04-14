import React from 'react';
import Icon from './Icon';

export interface ProofRow {
  id: string;
  date: string;
  user: string;
  amount?: number | null;
  status: 'approved' | 'rejected' | 'manual_review' | 'processing' | 'pending';
  confidence?: number | null;
  risk?: 'low' | 'medium' | 'high' | null;
  campaign?: string | null;
  type?: 'original' | 'revisao';
}

const STATUS_BADGE: Record<ProofRow['status'], { cls: string; label: string }> = {
  approved:      { cls: 'badge badge-success', label: 'Aprovado' },
  rejected:      { cls: 'badge badge-error',   label: 'Rejeitado' },
  manual_review: { cls: 'badge badge-purple',  label: 'Revisão' },
  processing:    { cls: 'badge badge-warning', label: 'Em Análise' },
  pending:       { cls: 'badge badge-gray',    label: 'Enviado' },
};

const RISK_BADGE: Record<NonNullable<ProofRow['risk']>, { cls: string; label: string }> = {
  low:    { cls: 'badge badge-success', label: 'Baixo' },
  medium: { cls: 'badge badge-warning', label: 'Médio' },
  high:   { cls: 'badge badge-error',   label: 'Alto' },
};

const fmtMoney = (v?: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ProofTable: React.FC<{ rows: ProofRow[] }> = ({ rows }) => (
  <div className="card g-col-12" style={{ overflowX: 'auto', padding: 0 }}>
    <div style={{ padding: '24px 24px 0' }}>
      <h3 className="card-title">Registro de Comprovantes</h3>
    </div>
    <table className="table-engine">
      <thead>
        <tr>
          <th>Data</th><th>Usuário</th><th>Valor</th><th>Status</th>
          <th>Confiança</th><th>Risco</th><th>Campanha</th><th>Tipo</th><th>Ações</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr><td colSpan={9} style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum comprovante registrado.</td></tr>
        )}
        {rows.map(r => {
          const sb = STATUS_BADGE[r.status];
          const rb = r.risk ? RISK_BADGE[r.risk] : null;
          const score = r.confidence ?? null;
          const scoreColor =
            score == null ? 'var(--text-muted)' :
            score >= 0.7 ? 'var(--color-success-primary)' :
            score >= 0.4 ? 'var(--color-warning-primary)' :
            'var(--color-error-primary)';
          return (
            <tr key={r.id}>
              <td className="mono">{r.date}</td>
              <td>{r.user}</td>
              <td style={{ fontWeight: 600 }}>{fmtMoney(r.amount)}</td>
              <td><span className={sb.cls}>{sb.label}</span></td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{score == null ? '—' : score.toFixed(2)}</span>
                  <div className="score-bar-bg" style={{ width: 60 }}>
                    <div className="score-bar-fill" style={{ width: `${(score ?? 0) * 100}%`, background: scoreColor }} />
                  </div>
                </div>
              </td>
              <td>{rb ? <span className={rb.cls}>{rb.label}</span> : <span className="badge badge-gray">—</span>}</td>
              <td>{r.campaign ?? '—'}</td>
              <td><span className="badge badge-gray">{r.type === 'revisao' ? 'Revisão' : 'Original'}</span></td>
              <td>
                <button className="action-btn" title="Ver detalhes"><Icon name="eye" size={14} /></button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default ProofTable;
