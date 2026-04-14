import React from 'react';
import PaymentsDonut from '../../components/PaymentsDonut';

const FAILURES = [
  { label: 'Divergência de OCR', pct: 34 },
  { label: 'Formato inválido', pct: 22 },
  { label: 'Sinalização de fraude', pct: 18 },
  { label: 'Comprovante duplicado', pct: 12 },
  { label: 'Outros', pct: 14 },
];

const PaymentsSection: React.FC = () => (
  <section>
    <div className="g-row">
      <PaymentsDonut id="donut-payments" />
      <div className="card g-col-6">
        <h3 className="card-title">Motivos de Falha</h3>
        {FAILURES.map(f => (
          <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
            <span>{f.label}</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{f.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default PaymentsSection;
