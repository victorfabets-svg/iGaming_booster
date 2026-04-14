import React from 'react';

interface Props {
  approved: number;
  rejected: number;
  manualReview: number;
}

const Tri: React.FC<{ tone: 'success' | 'error' | 'warning' }> = ({ tone }) => {
  const fill =
    tone === 'success' ? 'var(--color-success-glow)' :
    tone === 'error' ? 'var(--color-error-glow)' :
    'var(--color-warning-glow)';
  const stroke =
    tone === 'success' ? 'var(--color-success-primary)' :
    tone === 'error' ? 'var(--color-error-primary)' :
    'var(--color-warning-primary)';
  const path = tone === 'error' ? 'M12 20L2 4H22L12 20Z' : 'M12 4L2 20H22L12 4Z';
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" style={{ marginLeft: 4, verticalAlign: 'middle' }}>
      <path d={path} fill={fill} stroke={stroke} strokeWidth={2} />
    </svg>
  );
};

const Row: React.FC<{ label: string; value: number; tone: 'success' | 'error' | 'warning' }> = ({ label, value, tone }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--glass-border)' }}>
    <span style={{ fontSize: 14 }}>{label}</span>
    <span><b>{value.toLocaleString('pt-BR')}</b><Tri tone={tone} /></span>
  </div>
);

const ValidationSummary: React.FC<Props> = ({ approved, rejected, manualReview }) => {
  const total = approved + rejected + manualReview || 1;
  const pct = (n: number) => (n / total) * 100;
  return (
    <div className="card g-col-4">
      <h3 className="card-title">Resumo de Validação</h3>
      <Row label="Aprovados" value={approved} tone="success" />
      <Row label="Rejeitados" value={rejected} tone="error" />
      <Row label="Revisão Manual" value={manualReview} tone="warning" />
      <div>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 12 }}>
          Distribuição de Confiança (Proporcional)
        </span>
        <div className="stacked-bar">
          <div className="bar-segment bg-success" style={{ width: `${pct(approved)}%` }} />
          <div className="bar-segment bg-error" style={{ width: `${pct(rejected)}%` }} />
          <div className="bar-segment bg-warning" style={{ width: `${pct(manualReview)}%` }} />
        </div>
      </div>
    </div>
  );
};

export default ValidationSummary;
