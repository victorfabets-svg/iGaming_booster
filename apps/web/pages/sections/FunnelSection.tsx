import React from 'react';
import FunnelChart from '../../components/FunnelChart';
import ValidationSummary from '../../components/ValidationSummary';
import type { ValidationStats, FunnelStats } from '../../services/api';

interface Props { validation: ValidationStats; funnel: FunnelStats; }

const FunnelSection: React.FC<Props> = ({ validation, funnel }) => {
  const total = validation.approved + validation.rejected + validation.manual_review;
  const approvalRate = total ? ((validation.approved / total) * 100).toFixed(0) : '0';
  const losses = funnel.clicks - funnel.proofs_validated;
  const convClickReg = funnel.clicks ? ((funnel.signups / funnel.clicks) * 100).toFixed(0) : '0';

  return (
    <section>
      <div className="funnel-kpi-row">
        <div className="funnel-kpi"><div className="fk-label">Total de Cliques</div><div className="fk-value" style={{ color: 'var(--text-secondary)' }}>{funnel.clicks.toLocaleString('pt-BR')}</div></div>
        <div className="funnel-kpi"><div className="fk-label">Conv. Click→Cadastro</div><div className="fk-value" style={{ color: 'var(--color-primary-primary)' }}>{convClickReg}%</div></div>
        <div className="funnel-kpi"><div className="fk-label">Taxa de Aprovação</div><div className="fk-value" style={{ color: 'var(--color-success-primary)' }}>{approvalRate}%</div></div>
        <div className="funnel-kpi"><div className="fk-label">Perdas no Funil</div><div className="fk-value" style={{ color: 'var(--color-warning-primary)' }}>{losses.toLocaleString('pt-BR')}</div></div>
      </div>

      <div className="g-row">
        <FunnelChart steps={[
          { label: 'Cliques', value: funnel.clicks, pct: 100, color: 'var(--text-secondary)' },
          { label: 'Cadastros', value: funnel.signups, pct: funnel.clicks ? (funnel.signups / funnel.clicks) * 100 : 0, drop: 32, color: 'var(--color-primary-primary)' },
          { label: 'Comprovantes Enviados', value: funnel.proofs_submitted, pct: funnel.clicks ? (funnel.proofs_submitted / funnel.clicks) * 100 : 0, drop: 60, color: 'var(--color-warning-primary)' },
          { label: 'Validados', value: funnel.proofs_validated, pct: funnel.clicks ? (funnel.proofs_validated / funnel.clicks) * 100 : 0, drop: 55, color: 'var(--color-success-primary)', highlight: true },
        ]} />
        <ValidationSummary approved={validation.approved} rejected={validation.rejected} manualReview={validation.manual_review} />
      </div>

      <div className="g-row">
        <div className="card g-col-12" style={{ overflowX: 'auto' }}>
          <h3 className="card-title">Histórico do Funil por Campanha</h3>
          <table className="table-engine">
            <thead>
              <tr>
                <th>Campanha</th><th>Cliques</th><th>Cadastros</th><th>Enviados</th>
                <th>Aprovados</th><th>Rejeitados</th><th>Rev. Manual</th>
                <th>Conv.</th><th>Aprov.</th><th>Risco</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>FB-23</td><td>4.200</td><td>1.340</td><td>580</td><td style={{ color: 'var(--color-success-primary)' }}>320</td><td style={{ color: 'var(--color-error-primary)' }}>210</td><td style={{ color: 'var(--color-warning-primary)' }}>50</td><td>31.9%</td><td style={{ color: 'var(--color-error-primary)' }}>55.2%</td><td><span className="badge badge-error">Alto</span></td></tr>
              <tr><td>TT-Promo</td><td>6.100</td><td>2.100</td><td>890</td><td style={{ color: 'var(--color-success-primary)' }}>590</td><td style={{ color: 'var(--color-error-primary)' }}>180</td><td style={{ color: 'var(--color-warning-primary)' }}>120</td><td>34.4%</td><td style={{ color: 'var(--color-success-primary)' }}>66.3%</td><td><span className="badge badge-success">Baixo</span></td></tr>
              <tr><td>GG-Slot</td><td>1.800</td><td>420</td><td>160</td><td style={{ color: 'var(--color-success-primary)' }}>88</td><td style={{ color: 'var(--color-error-primary)' }}>58</td><td style={{ color: 'var(--color-warning-primary)' }}>14</td><td>23.3%</td><td style={{ color: 'var(--color-warning-primary)' }}>55.0%</td><td><span className="badge badge-warning">Médio</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default FunnelSection;
