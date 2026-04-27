/**
 * Dashboard Page - KPI overview
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
    return <div>Carregando métricas...</div>;
  }

  if (status === 'error' || !metrics) {
    return <div>Erro ao carregar métricas</div>;
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem' }}>Dashboard</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        <KpiCard label="Casas Parceiras" value={metrics.houses_count} />
        <KpiCard label="Planos Ativos" value={metrics.plans_count} />
        <KpiCard label="Assinaturas Ativas" value={metrics.active_subscriptions_count} />
        <KpiCard label="Assinantes" value={metrics.active_subscribers_count} />
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: '#fff',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#666' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: '2rem', fontWeight: 600 }}>{value}</p>
    </div>
  );
}