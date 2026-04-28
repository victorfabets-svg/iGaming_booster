/**
 * Subscriptions Admin Page
 * Refactored to use DESIGN_SYSTEM.md tokens and global.css classes
 */

import React, { useState, useEffect } from 'react';
import { adminApi, Subscription, SubscriptionFilters } from '../../services/admin-api';

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
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

  if (status === 'loading') return <div className="loading-state">Carregando...</div>;
  if (status === 'error') return <div className="alert-box alert-error">Erro ao carregar</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Assinaturas</h1>
      </div>

      <div className="filter-bar mb-6">
        <select
          value={filter.status || ''}
          onChange={(e) => setFilter({ ...filter, status: e.target.value as any || undefined })}
          className="input filter-select"
        >
          <option value="">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="active">Ativa</option>
          <option value="canceled">Cancelada</option>
          <option value="expired">Expirada</option>
        </select>
      </div>

      {subscriptions.length === 0 ? (
        <div className="card empty-state">Nenhuma assinatura encontrada.</div>
      ) : (
        <div className="card">
          <table className="table-engine">
            <thead>
              <tr>
                <th>External ID</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Início</th>
                <th>Fim</th>
                <th>Valor</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map(sub => (
                <tr key={sub.id}>
                  <td className="mono">{sub.external_id}</td>
                  <td>{sub.plan_slug}</td>
                  <td>
                    <span className={`badge ${
                      sub.status === 'active' ? 'badge-success' :
                      sub.status === 'pending' ? 'badge-warning' :
                      sub.status === 'canceled' ? 'badge-error' : 'badge-gray'
                    }`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="mono">{sub.current_period_start ? new Date(sub.current_period_start).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="mono">{sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="mono">{sub.amount_cents != null ? `${(sub.amount_cents / 100).toFixed(2)} ${sub.currency || ''}` : '—'}</td>
                  <td>
                    {sub.status === 'active' && (
                      <button className="action-btn" onClick={() => handleCancel(sub.id)}>
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
