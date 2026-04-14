import React from 'react';
import AlertCard from '../../components/AlertCard';

const RiskSection: React.FC = () => (
  <section>
    <div className="g-row">
      <div className="card g-col-6">
        <h3 className="card-title">Visão Geral de Risco</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Fraud Score Médio</span>
            <div style={{ fontSize: 24, fontFamily: 'var(--font-display)', color: 'var(--color-warning-primary)' }}>0.68</div>
          </div>
          <div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Suspicious Rate</span>
            <div style={{ fontSize: 24, fontFamily: 'var(--font-display)', color: 'var(--color-error-primary)' }}>14%</div>
          </div>
          <div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Duplicate Rate</span>
            <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', color: 'var(--color-warning-primary)' }}>6%</div>
          </div>
          <div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Multi-conta</span>
            <div style={{ marginTop: 4 }}><span className="badge badge-warning">Detectado</span></div>
          </div>
        </div>
      </div>
      <div className="card g-col-6">
        <h3 className="card-title">Alertas</h3>
        <AlertCard tone="error" title="Approval rate caiu 18% (últimas 2h)" description="Impacto estimado: -R$ 2.1k" />
        <AlertCard tone="error" title="Pico de fraude detectado" description="Source: FB-23" />
        <AlertCard tone="warning" title="Latência acima do normal nas validações" />
      </div>
    </div>
  </section>
);

export default RiskSection;
