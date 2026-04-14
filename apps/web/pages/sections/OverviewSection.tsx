import React from 'react';
import KpiCard from '../../components/KpiCard';
import FunnelChart from '../../components/FunnelChart';
import ValidationSummary from '../../components/ValidationSummary';
import type { ValidationStats, FunnelStats } from '../../services/api';

interface Props {
  validation: ValidationStats;
  funnel: FunnelStats;
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const OverviewSection: React.FC<Props> = ({ validation, funnel }) => {
  const totalDecided = validation.approved + validation.rejected + validation.manual_review;
  const approvalRate = totalDecided ? Math.round((validation.approved / totalDecided) * 100) : 0;
  const conv = funnel.clicks ? ((funnel.signups / funnel.clicks) * 100).toFixed(1) : '0';

  return (
    <section>
      <div className="g-row">
        <div className="g-col-2-4"><KpiCard label="Receita (NGR)" value={fmtBRL(12450)} delta="+12.4%" tone="success" sparkline={[2,3,2,5,7,9,12]} /></div>
        <div className="g-col-2-4"><KpiCard label="EPC" value="R$ 0,85" delta="+2.1%" tone="success" sparkline={[1,2,1,3,4,3,5]} /></div>
        <div className="g-col-2-4"><KpiCard label="FTD" value={String(validation.approved)} delta="+4.5%" tone="success" sparkline={[2,4,3,6,8,7,10]} /></div>
        <div className="g-col-2-4"><KpiCard label="Taxa de Aprovação" value={`${approvalRate}%`} delta={approvalRate >= 70 ? '+1.5%' : '-4.2%'} tone={approvalRate >= 70 ? 'success' : 'error'} sparkline={[10,8,6,5,4,3,2]} /></div>
        <div className="g-col-2-4"><KpiCard label="Conversão" value={`${conv}%`} delta="+0.5%" tone="warning" sparkline={[4,4,5,5,6,7,7]} /></div>
      </div>

      <div className="g-row">
        <FunnelChart steps={[
          { label: 'Cliques', value: funnel.clicks, pct: 100, color: 'var(--text-secondary)' },
          { label: 'Cadastros', value: funnel.signups, pct: funnel.clicks ? (funnel.signups / funnel.clicks) * 100 : 0, drop: 32, color: 'var(--color-primary-primary)' },
          { label: 'Comprovantes Enviados', value: funnel.proofs_submitted, pct: funnel.clicks ? (funnel.proofs_submitted / funnel.clicks) * 100 : 0, drop: 60, color: 'var(--color-warning-primary)' },
          { label: 'Validados', value: funnel.proofs_validated, pct: funnel.clicks ? (funnel.proofs_validated / funnel.clicks) * 100 : 0, drop: 55, color: 'var(--color-success-primary)', highlight: true },
        ]} />
        <ValidationSummary
          approved={validation.approved}
          rejected={validation.rejected}
          manualReview={validation.manual_review}
        />
      </div>
    </section>
  );
};

export default OverviewSection;
