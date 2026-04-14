import React, { useState } from 'react';

type MethodKey = 'all' | 'pix' | 'credit' | 'others';

interface MethodData { generated: number; rejected: number; approvedTickets: number; }

const DATA: Record<MethodKey, MethodData> = {
  all:     { generated: 12450, rejected: 2300, approvedTickets: 704 },
  pix:     { generated: 7800,  rejected: 980,  approvedTickets: 420 },
  credit:  { generated: 3200,  rejected: 980,  approvedTickets: 210 },
  others:  { generated: 1450,  rejected: 340,  approvedTickets: 74 },
};

const C = 2 * Math.PI * 25;

const PaymentsDonut: React.FC<{ id: string }> = ({ id }) => {
  const [method, setMethod] = useState<MethodKey>('all');
  const d = DATA[method];
  const total = d.generated + d.rejected;
  const approvedPct = d.generated / total;
  const rejectedPct = d.rejected / total;

  return (
    <div className="card g-col-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 className="card-title" style={{ marginBottom: 0 }}>Métodos de Pagamento</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Gerado</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>
            R$ {d.generated.toLocaleString('pt-BR')}
          </span>
        </div>
      </div>
      <div className="payment-dynamic-card">
        <div className="payment-selector-list">
          {(['all', 'pix', 'credit', 'others'] as MethodKey[]).map(m => (
            <button
              key={m}
              className={`payment-selector-item${method === m ? ' active' : ''}`}
              onClick={() => setMethod(m)}
            >
              {m === 'all' ? 'Todos' : m === 'pix' ? 'PIX' : m === 'credit' ? 'Cartão' : 'Outros'}
            </button>
          ))}
        </div>
        <div className="payment-legend-list">
          <div className="p-legend-item">
            <div className="p-legend-title"><div className="ldot" style={{ color: 'var(--color-success-primary)' }} />Gerado</div>
            <div className="p-legend-val">R$ {d.generated.toLocaleString('pt-BR')}</div>
          </div>
          <div className="p-legend-item">
            <div className="p-legend-title"><div className="ldot" style={{ color: 'var(--color-error-primary)' }} />Reprovado</div>
            <div className="p-legend-val">R$ {d.rejected.toLocaleString('pt-BR')}</div>
          </div>
          <div className="p-legend-item">
            <div className="p-legend-title"><div className="ldot" style={{ color: 'var(--color-primary-primary)' }} />Aprovado</div>
            <div className="p-legend-val">{d.approvedTickets} tkts</div>
          </div>
        </div>
        <div className="donut-container" id={id}>
          <svg className="donut-svg" viewBox="0 0 100 100">
            <circle className="donut-bg" cx="50" cy="50" r="25" />
            <circle
              className="donut-segment"
              cx="50" cy="50" r="25"
              stroke="var(--color-success-primary)"
              strokeDasharray={`${approvedPct * C} ${C}`}
            />
            <circle
              className="donut-segment"
              cx="50" cy="50" r="25"
              stroke="var(--color-error-primary)"
              strokeDasharray={`${rejectedPct * C} ${C}`}
              strokeDashoffset={-approvedPct * C}
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default PaymentsDonut;
