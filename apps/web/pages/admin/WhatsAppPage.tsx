/**
 * WhatsApp Admin Page
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

  useEffect(() => {
    loadData();
  }, [tab, subscriberFilter]);

  async function loadData() {
    setStatus('loading');
    if (tab === 'subscribers') {
      const filters: { status?: string } = {};
      if (subscriberFilter.status) filters.status = subscriberFilter.status;
      const response = await adminApi.listWhatsAppSubscribers(filters);
      if (response.success && response.data) {
        setSubscribers(response.data.subscribers);
        setStatus('success');
      } else {
        setStatus('error');
      }
    } else {
      const response = await adminApi.listWhatsAppDeliveries({});
      if (response.success && response.data) {
        setDeliveries(response.data.deliveries);
        setStatus('success');
      } else {
        setStatus('error');
      }
    }
  }

  async function handleOptOut(id: string) {
    if (!confirm('Opt-out deste inscrito?')) return;
    await adminApi.optOutWhatsAppSubscriber(id, 'admin_action');
    loadData();
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 1rem', fontSize: '1.5rem' }}>WhatsApp</h1>

      {/* Tabs */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => setTab('subscribers')}
          style={{
            padding: '0.5rem 1rem',
            background: tab === 'subscribers' ? '#0066cc' : '#eee',
            color: tab === 'subscribers' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer',
          }}
        >
          Inscritos
        </button>
        <button
          onClick={() => setTab('deliveries')}
          style={{
            padding: '0.5rem 1rem',
            background: tab === 'deliveries' ? '#0066cc' : '#eee',
            color: tab === 'deliveries' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer',
          }}
        >
          Entregas
        </button>
      </div>

      {/* Filters for subscribers */}
      {tab === 'subscribers' && (
        <div style={{ marginBottom: '1rem' }}>
          <select
            value={subscriberFilter.status}
            onChange={(e) => setSubscriberFilter({ status: e.target.value })}
            style={{ padding: '0.5rem' }}
          >
            <option value="">Todos</option>
            <option value="active">Ativos</option>
            <option value="opted_out">Opt-out</option>
          </select>
        </div>
      )}

      {status === 'loading' ? (
        <div>Carregando...</div>
      ) : status === 'error' ? (
        <div>Erro ao carregar</div>
      ) : tab === 'subscribers' ? (
        subscribers.length === 0 ? (
          <p>Nenhum inscrito encontrado.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Telefone</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Tier</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Criado em</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((sub) => (
                <tr key={sub.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.75rem' }}>
                    <code>{sub.id.slice(0, 8)}</code>
                  </td>
                  <td style={{ padding: '0.75rem' }}>{sub.phone_number}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    {sub.status === 'active' ? '✅' : '❌'}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>{sub.tier || '-'}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    {formatDate(sub.created_at)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    {sub.status === 'active' && (
                      <button onClick={() => handleOptOut(sub.id)}>Opt-out</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : (
        deliveries.length === 0 ? (
          <p>Nenhuma entrega encontrada.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Telefone</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Mensagem</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Enviado em</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((del) => (
                <tr key={del.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.75rem' }}>
                    <code>{del.id.slice(0, 8)}</code>
                  </td>
                  <td style={{ padding: '0.75rem' }}>{del.phone_number}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    {deliveryStatus(del.status)}
                  </td>
                  <td style={{ padding: '0.75rem' }}>{del.message?.slice(0, 50) || '-'}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    {formatDate(del.sent_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}

function deliveryStatus(status: string): string {
  const labels: Record<string, string> = {
    sent: '📤 Enviado',
    delivered: '✅ Entregue',
    failed: '❌ Falhou',
  };
  return labels[status] || status;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}