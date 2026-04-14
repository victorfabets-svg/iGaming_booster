import React from 'react';

export interface FunnelStep {
  label: string;
  value: number;
  pct: number;        // 0..100 width
  drop?: number;      // % drop vs previous
  color?: string;
  highlight?: boolean;
}

interface Props { steps: FunnelStep[]; }

const fmt = (n: number) => n.toLocaleString('pt-BR');

const FunnelChart: React.FC<Props> = ({ steps }) => (
  <div className="card g-col-8">
    <h3 className="card-title">Diagnóstico de Fluxo de Usuário</h3>
    {steps.map((s, i) => (
      <div className="funnel-row" key={i}>
        <span
          className="funnel-lbl"
          style={s.highlight ? { color: 'var(--color-success-primary)' } : undefined}
        >
          {s.label}
          {typeof s.drop === 'number' && (
            <span style={{ color: 'var(--color-error-primary)', fontSize: 11, marginLeft: 6 }}>
              ↓{s.drop}%
            </span>
          )}
        </span>
        <div className="f-bar-bg">
          <div
            className="f-bar-fg"
            style={{
              width: `${s.pct}%`,
              background: s.color || 'var(--color-primary-primary)',
              boxShadow: s.highlight ? '0 0 10px var(--color-success-glow)' : undefined,
            }}
          />
        </div>
        <span className="funnel-val">{fmt(s.value)}</span>
      </div>
    ))}
  </div>
);

export default FunnelChart;
