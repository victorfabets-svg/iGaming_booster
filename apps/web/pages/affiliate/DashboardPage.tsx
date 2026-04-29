/**
 * Affiliate Dashboard Page — funnel KPIs.
 */

import React, { useState, useEffect } from 'react';
import { affiliateApi, MyFunnelTotals } from '../../services/affiliate-api';

type PageStatus = 'loading' | 'success' | 'error';

export default function AffiliateDashboardPage() {
  const [totals, setTotals] = useState<MyFunnelTotals | null>(null);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    // Default to last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    setTo(now.toISOString().split('T')[0]);
    setFrom(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  const loadFunnel = async () => {
    if (!from || !to) return;
    setStatus('loading');
    const response = await affiliateApi.getMyFunnel({ from, to });
    if (response.success && response.data) {
      setTotals(response.data.totals);
      setStatus('success');
    } else {
      setStatus('error');
    }
  };

  useEffect(() => {
    if (from && to) {
      loadFunnel();
    }
  }, [from, to]);

  const formatNumber = (n: number) => n.toLocaleString('pt-BR');

  const calcRate = (a: number, b: number) => {
    if (b === 0) return '0%';
    return `${((a / b) * 100).toFixed(1)}%`;
  };

  if (status === 'loading') return <div className="empty-state">Carregando…</div>;
  if (status === 'error') return <div className="alert-box alert-error">Erro ao carregar dados.</div>;
  if (!totals) return <div className="empty-state">Nenhum dado disponível.</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Seu funil de afiliados.</p>
        </div>
      </div>

      <div className="card mb-4">
        <div className="flex gap-3">
          <div className="field">
            <label>De</label>
            <input
              className="input"
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Até</label>
            <input
              className="input"
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-4" style={{ flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '1 1 200px', minWidth: '180px' }}>
          <p className="text-muted text-sm uppercase mb-1">Cliques</p>
          <p className="text-3xl mono">{formatNumber(totals.clicks)}</p>
        </div>
        <div className="card" style={{ flex: '1 1 200px', minWidth: '180px' }}>
          <p className="text-muted text-sm uppercase mb-1">Cadastros</p>
          <p className="text-3xl mono">{formatNumber(totals.registers)}</p>
          <p className="text-sm text-muted">{calcRate(totals.registers, totals.clicks)} dos cliques</p>
        </div>
        <div className="card" style={{ flex: '1 1 200px', minWidth: '180px' }}>
          <p className="text-muted text-sm uppercase mb-1">1ª Prova</p>
          <p className="text-3xl mono">{formatNumber(totals.first_proof)}</p>
          <p className="text-sm text-muted">{calcRate(totals.first_proof, totals.registers)} dos cadastros</p>
        </div>
        <div className="card" style={{ flex: '1 1 200px', minWidth: '180px' }}>
          <p className="text-muted text-sm uppercase mb-1">Aprovadas</p>
          <p className="text-3xl mono">{formatNumber(totals.approved)}</p>
          <p className="text-sm text-muted">{calcRate(totals.approved, totals.first_proof)} das 1ª provas</p>
        </div>
      </div>
    </div>
  );
}