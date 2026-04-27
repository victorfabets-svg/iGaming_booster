/**
 * Tips Admin Page (read-only)
 */

import React, { useState, useEffect } from 'react';
import { adminApi, Tip } from '../../services/admin-api';

type PageStatus = 'loading' | 'success' | 'error';

export default function TipsPage() {
  const [tips, setTips] = useState<Tip[]>([]);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [filter, setFilter] = useState({ status: '', house_slug: '' });

  useEffect(() => {
    loadTips();
  }, []);

  async function loadTips() {
    setStatus('loading');
    const filters: { status?: string; house_slug?: string } = {};
    if (filter.status) filters.status = filter.status;
    if (filter.house_slug) filters.house_slug = filter.house_slug;
    
    const response = await adminApi.listTips(filters);
    if (response.success && response.data) {
      setTips(response.data.tips);
      setStatus('success');
    } else {
      setStatus('error');
    }
  }

  if (status === 'loading') return <div>Carregando...</div>;
  if (status === 'error') return <div>Erro ao carregar</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 1rem', fontSize: '1.5rem' }}>Tips</h1>

      {/* Filters */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          style={{ padding: '0.5rem' }}
        >
          <option value="">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="won">Ganhou</option>
          <option value="lost">Perdeu</option>
          <option value="void">Anulado</option>
        </select>
      </div>

      {tips.length === 0 ? (
        <p>Nenhum tip encontrado.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ddd' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>ID</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Casa</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '0.75rem', textAlign: 'right' }}>Valor</th>
              <th style={{ padding: '0.75rem', textAlign: 'right' }}>Odds</th>
              <th style={{ padding: '0.75rem', textAlign: 'right' }}>Data</th>
            </tr>
          </thead>
          <tbody>
            {tips.map((tip) => (
              <tr key={tip.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.75rem' }}>
                  <code>{tip.external_id.slice(0, 8)}</code>
                </td>
                <td style={{ padding: '0.75rem' }}>{tip.house_slug}</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  {statusLabel(tip.status)}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                  {tip.amount_cents ? formatCurrency(tip.amount_cents) : '-'}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                  {tip.odds ? `${tip.odds}x` : '-'}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                  {formatDate(tip.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '⏳ Pendente',
    won: '✅ Ganhou',
    lost: '❌ Perdeu',
    void: '➖ Anulado',
  };
  return labels[status] || status;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}