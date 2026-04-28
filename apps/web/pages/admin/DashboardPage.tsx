/**
 * Dashboard Page - KPI overview
 * Refactored to use DESIGN_SYSTEM.md tokens and global.css classes
 */

import React, { useState, useEffect } from 'react';
import { adminApi, AdminMetrics } from '../../services/admin-api';

type DashboardStatus = 'loading' | 'success' | 'error';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [status, setStatus] = useState<DashboardStatus>('loading');

  useEffect(() => {
    async function loadMetrics() {
      const response = await adminApi.getMetrics();
      if (response.success && response.data) {
        setMetrics(response.data);
        setStatus('success');
      } else {
        setStatus('error');
      }
    }
    loadMetrics();
  }, []);

  if (status === 'loading') {
    return <div className="loading-state">Carregando métricas...</div>;
  }

  if (status === 'error' || !metrics) {
    return <div className="alert-box alert-error">Erro ao carregar métricas</div>;
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem' }}>Dashboard</h1>

      <div className="g-row">
        <div className="g-col-2-4">
          <KpiCard label="Casas Parceiras" value={metrics.houses_count} />
        </div>
        <div className="g-col-2-4">
          <KpiCard label="Planos Ativos" value={metrics.plans_count} />
        </div>
        <div className="g-col-2-4">
          <KpiCard label="Assinaturas Ativas" value={metrics.active_subscriptions_count} />
        </div>
        <div className="g-col-2-4">
          <KpiCard label="Assinantes" value={metrics.active_subscribers_count} />
        </div>
        <div className="g-col-2-4">
          <KpiCard label="Tips Enviadas" value={metrics.tips_count} />
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        {label}
      </p>
      <p className="kpi-value">{value}</p>
    </div>
  );
}