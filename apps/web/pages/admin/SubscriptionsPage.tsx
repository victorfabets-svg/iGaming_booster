/**
 * Subscriptions Admin Page
 */

import React, { useState, useEffect } from 'react';
import { adminApi, Subscription, SubscriptionFilters } from '../../services/admin-api';

type PageStatus = 'loading' | 'success' | 'error';

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [filter, setFilter] = useState<SubscriptionFilters>({});

  useEffect(() => {
    loadSubscriptions();
  }, [filter]);

  async function loadSubscriptions() {
    setStatus('loading');
    const response = await adminApi.listSubscriptions(filter);
    if (response.success && response.data) {
      setSubscriptions(response.data.subscriptions);
      setStatus('success');
    } else {
      setStatus('error');
    }
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancelar esta assinatura?')) return;
    await adminApi.cancelSubscription(id);
    loadSubscriptions();
  }

  if (status === 'loading') return <div>Carregando...</div>;
  if (status === 'error') return <div>Erro ao carregar</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 1rem', fontSize: '1.5rem' }}>Assinaturas</h1>

      {/* Filters */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <select
          value={filter.status || ''}
          onChange={(e) => setFilter({ ...filter, status: e.target.value as any || undefined })}
          style={{ padding: '0.5rem' }}
        >
          <option value="">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="active">Ativa</option>
          <option value="canceled">Cancelada</option>
          <option value="expired">Expirada</option>
        </select>
      </div>

      {subscriptions.length === 0 ? (
        <p>Nenhuma assinatura encontrada.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ddd' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>ID</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Plano</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>User ID</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '0.75rem', textAlign: 'right' }}>Valor</th>
              <th style={{ padding: '0.75rem', textAlign: 'right' }}>Início</th>
              <th style={{ padding: '0.75rem', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((sub) => (
              <tr key={sub.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.75rem' }}>
                  <code>{sub.id.slice(0, 8)}</code>
                </td>
                <td style={{ padding: '0.75rem' }}>{sub.plan_slug}</td>
                <td style={{ padding: '0.75rem' }}>
                  <code>{sub.user_id?.slice(0, 8) || '-'}</code>
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  {statusLabel(sub.status)}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                  {sub.amount_cents && sub.currency
                    ? formatCurrency(sub.amount_cents, sub.currency)
                    : '-'}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                  {sub.current_period_start ? formatDate(sub.current_period_start) : '-'}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                  {sub.status === 'active' && (
                    <button onClick={() => handleCancel(sub.id)}>Cancelar</button>
                  )}
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
    active: '✅ Ativa',
    canceled: '❌ Cancelada',
    expired: '⏰ Expirada',
  };
  return labels[status] || status;
}

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}