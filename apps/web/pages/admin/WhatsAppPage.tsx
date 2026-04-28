/**
 * WhatsApp Admin Page — subscribers + deliveries with tabs.
 */

import React, { useState, useEffect } from 'react';
import { adminApi, WhatsAppSubscriber, WhatsAppDelivery } from '../../services/admin-api';

type PageStatus = 'loading' | 'success' | 'error';
type TabType = 'subscribers' | 'deliveries';

export default function WhatsAppPage() {
  const [tab, setTab] = useState<TabType>('subscribers');
  const [subscribers, setSubscribers] = useState<WhatsAppSubscriber[]>([]);
  const [deliveries, setDeliveries] = useState<WhatsAppDelivery[]>([]);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [subscriberFilter, setSubscriberFilter] = useState({ status: '' });

  useEffect(() => { loadData(); }, [tab, subscriberFilter]);

  async function loadData() {
    setStatus('loading');
    if (tab === 'subscribers') {
      const filters: { status?: string } = {};
      if (subscriberFilter.status) filters.status = subscriberFilter.status;
      const response = await adminApi.listWhatsAppSubscribers(filters);
      if (response.success && response.data) {
        setSubscribers(response.data.subscribers);
        setStatus('success');
      } else { setStatus('error'); }
    } else {
      const response = await adminApi.listWhatsAppDeliveries({});
      if (response.success && response.data) {
        setDeliveries(response.data.deliveries);
        setStatus('success');
      } else { setStatus('error'); }
    }
  }

  async function handleOptOut(id: string) {
    if (!confirm('Opt-out deste inscrito?')) return;
    await adminApi.optOutWhatsAppSubscriber(id, 'admin_action');
    loadData();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">WhatsApp</h1>
          <p className="page-subtitle">Inscritos e entregas via plataforma WhatsApp.</p>
        </div>
      </div>

      <div className="tab-bar">
        <button
          type="button"
          className={`tab-item ${tab === 'subscribers' ? 'active' : ''}`}
          onClick={() => setTab('subscribers')}
        >
          Inscritos
        </button>
        <button
          type="button"
          className={`tab-item ${tab === 'deliveries' ? 'active' : ''}`}
          onClick={() => setTab('deliveries')}
        >
          Entregas
        </button>
      </div>

      {tab === 'subscribers' && (
        <div className="filter-bar mb-6">
          <div className="filter-group">
            <span className="filter-label">Status</span>
            <select
              className="input"
              value={subscriberFilter.status}
              onChange={e => setSubscriberFilter({ status: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="active">Ativos</option>
              <option value="opted_out">Opt-out</option>
            </select>
          </div>
        </div>
      )}

      <div className="card">
        {status === 'loading' ? (
          <div className="empty-state">Carregando…</div>
        ) : status === 'error' ? (
          <div className="alert-box alert-error">Erro ao carregar dados.</div>
        ) : tab === 'subscribers' ? (
          subscribers.length === 0 ? (
            <div className="empty-state">Nenhum inscrito encontrado.</div>
          ) : (
            <table className="table-engine">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Telefone</th>
                  <th>Status</th>
                  <th>Tier</th>
                  <th>Criado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map(sub => (
                  <tr key={sub.id}>
                    <td className="mono">{sub.id.slice(0, 8)}</td>
                    <td className="mono">{sub.phone_number}</td>
                    <td>
                      <span className={`badge ${sub.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
                        {sub.status === 'active' ? 'ativo' : 'opt-out'}
                      </span>
                    </td>
                    <td>{sub.tier || '—'}</td>
                    <td className="mono">{formatDate(sub.created_at)}</td>
                    <td>
                      {sub.status === 'active' && (
                        <button type="button" className="action-btn" onClick={() => handleOptOut(sub.id)}>
                          Opt-out
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          deliveries.length === 0 ? (
            <div className="empty-state">Nenhuma entrega encontrada.</div>
          ) : (
            <table className="table-engine">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Telefone</th>
                  <th>Status</th>
                  <th>Mensagem</th>
                  <th>Enviado em</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map(del => (
                  <tr key={del.id}>
                    <td className="mono">{del.id.slice(0, 8)}</td>
                    <td className="mono">{del.phone_number}</td>
                    <td>
                      <span className={`badge ${deliveryBadge(del.status)}`}>{del.status}</span>
                    </td>
                    <td>{del.message ? (del.message.length > 50 ? del.message.slice(0, 50) + '…' : del.message) : '—'}</td>
                    <td className="mono">{formatDate(del.sent_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}

function deliveryBadge(status: string): string {
  if (status === 'delivered' || status === 'read') return 'badge-success';
  if (status === 'failed') return 'badge-error';
  if (status === 'sent') return 'badge-blue';
  return 'badge-gray';
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date));
}
