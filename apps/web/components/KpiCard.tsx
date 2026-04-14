import React from 'react';

type Tone = 'success' | 'error' | 'warning';

interface KpiCardProps {
  label: string;
  value: string;
  delta?: string;
  tone?: Tone;
  sparkline?: number[];
}

const sparklinePath = (data: number[]) => {
  if (data.length < 2) return '';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  return data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 20 - ((v - min) / range) * 18 - 1;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
};

const toneVar = (t: Tone) =>
  t === 'success' ? 'var(--color-success-primary)' :
  t === 'error' ? 'var(--color-error-primary)' :
  'var(--color-warning-primary)';

const KpiCard: React.FC<KpiCardProps> = ({ label, value, delta, tone = 'success', sparkline }) => {
  const stroke = toneVar(tone);
  const deltaCls = tone === 'success' ? 'bg-success-soft' : tone === 'error' ? 'bg-error-soft' : 'bg-warning-soft';
  const borderStyle = tone === 'error' ? { borderColor: 'var(--color-error-glow)' } : undefined;
  return (
    <div className="card" style={borderStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{label}</span>
        <span className="dot" style={{ color: stroke }} />
      </div>
      <div className="kpi-row">
        <span className="kpi-value">{value}</span>
        {delta && <span className={`kpi-delta ${deltaCls}`}>{delta}</span>}
      </div>
      {sparkline && (
        <svg className="sparkline" viewBox="0 0 100 20" preserveAspectRatio="none">
          <path d={sparklinePath(sparkline)} fill="none" stroke={stroke} strokeWidth={2} />
        </svg>
      )}
    </div>
  );
};

export default KpiCard;
